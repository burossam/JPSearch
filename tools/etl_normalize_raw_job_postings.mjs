import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;

function getEnv(name, fallback) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}

function asDateOnly(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function pick(obj, paths) {
  for (const p of paths) {
    const parts = p.split('.');
    let cur = obj;
    let ok = true;
    for (const part of parts) {
      if (!cur || typeof cur !== 'object' || !(part in cur)) {
        ok = false;
        break;
      }
      cur = cur[part];
    }
    if (ok) return cur;
  }
  return undefined;
}

function normalizeMappingValue(v) {
  if (!Array.isArray(v)) return null;
  const out = v
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter((x) => x);
  return out.length ? out : null;
}

async function loadMapping() {
  /** @type {Record<string, string[]>} */
  const defaults = {
    title: ['title', 'jobTitle'],
    collectedAt: ['collectedAt', 'collected_at'],
    sourceJobId: ['sourceJobId', 'id', 'jobId'],
    companyName: ['companyName', 'company.name'],
    industry: ['industry', 'company.industry'],
    employmentType: ['employmentType', 'employment.type'],
    jobCategory: ['jobCategory', 'category'],
    municipalityCode: ['municipalityCode', 'location.municipalityCode'],
    salaryMin: ['salaryMin', 'salary.min'],
    salaryMax: ['salaryMax', 'salary.max'],
    description: ['description'],
    postedAt: ['postedAt', 'posted_at'],
    isActive: ['isActive', 'active'],
    skills: ['skills'],
  };

  const mappingPathRaw = getEnv('ETL_MAPPING_PATH', '');
  if (!mappingPathRaw) return defaults;

  try {
    const mappingPath = path.resolve(process.cwd(), mappingPathRaw);
    const raw = await fs.readFile(mappingPath, 'utf8');
    const json = JSON.parse(raw);

    if (!json || typeof json !== 'object') return defaults;

    for (const [k, v] of Object.entries(json)) {
      const norm = normalizeMappingValue(v);
      if (norm) defaults[k] = norm;
    }

    return defaults;
  } catch {
    return defaults;
  }
}

async function getOrCreateIdByName(client, table, nameCol, name, extraCols = {}) {
  const existing = await client.query(`SELECT id FROM ${table} WHERE ${nameCol} = $1 LIMIT 1;`, [name]);
  if (existing.rows.length) return existing.rows[0].id;

  const keys = [nameCol, ...Object.keys(extraCols)];
  const values = [name, ...Object.values(extraCols)];
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
  const cols = keys.join(',');

  const inserted = await client.query(
    `INSERT INTO ${table}(${cols}) VALUES (${placeholders}) RETURNING id;`,
    values,
  );
  return inserted.rows[0].id;
}

async function getEmploymentTypeId(client, name) {
  if (!name) return null;
  const res = await client.query(
    'INSERT INTO employment_types(name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id;',
    [name],
  );
  return res.rows[0].id;
}

async function getSkillId(client, name) {
  if (!name) return null;
  const res = await client.query(
    'INSERT INTO skills(name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id;',
    [name],
  );
  return res.rows[0].id;
}

async function main() {
  const databaseUrl = getEnv('DATABASE_URL', 'postgresql://jps:jps@localhost:5432/jps');
  const limit = Number.parseInt(getEnv('ETL_LIMIT', '200'), 10);
  const mapping = await loadMapping();

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  let ok = 0;
  let failed = 0;

  try {
    const rawRows = await client.query(
      'SELECT id, source_name, source_job_id, raw_json FROM raw_job_postings WHERE processed_at IS NULL ORDER BY id ASC LIMIT $1;',
      [limit],
    );

    for (const row of rawRows.rows) {
      const rawId = row.id;
      const sourceName = row.source_name;
      const sourceJobId = row.source_job_id;
      const raw = row.raw_json;

      try {
        const title = pick(raw, mapping.title);
        const collectedAt = pick(raw, mapping.collectedAt);

        const resolvedSourceJobId = sourceJobId ?? pick(raw, mapping.sourceJobId);
        if (!resolvedSourceJobId) throw new Error('missing sourceJobId');
        if (!title) throw new Error('missing title');

        const companyName = pick(raw, mapping.companyName);
        const industry = pick(raw, mapping.industry);
        const employmentType = pick(raw, mapping.employmentType);
        const jobCategory = pick(raw, mapping.jobCategory);
        const municipalityCode = pick(raw, mapping.municipalityCode);
        const salaryMin = pick(raw, mapping.salaryMin);
        const salaryMax = pick(raw, mapping.salaryMax);
        const description = pick(raw, mapping.description);
        const postedAt = pick(raw, mapping.postedAt);
        const isActive = pick(raw, mapping.isActive);
        const skills = pick(raw, mapping.skills);

        await client.query('BEGIN;');

        const companyId = companyName
          ? await getOrCreateIdByName(client, 'companies', 'name', String(companyName), { industry: industry ? String(industry) : null })
          : null;

        const employmentTypeId = employmentType ? await getEmploymentTypeId(client, String(employmentType)) : null;
        const jobCategoryId = jobCategory
          ? await getOrCreateIdByName(client, 'job_categories', 'name', String(jobCategory))
          : null;

        const municipalityId = municipalityCode
          ? (await client.query('SELECT id FROM municipalities WHERE code=$1 LIMIT 1;', [String(municipalityCode)])).rows[0]?.id ?? null
          : null;

        const collectedDate = asDateOnly(collectedAt) ?? new Date().toISOString().slice(0, 10);
        const postedDate = asDateOnly(postedAt);

        const insertJob = await client.query(
          `
          INSERT INTO job_postings(
            source_name, source_job_id, title,
            company_id, municipality_id, job_category_id, employment_type_id,
            salary_min, salary_max, description,
            posted_at, collected_at, is_active
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          ON CONFLICT (source_name, source_job_id) DO UPDATE
          SET
            title = EXCLUDED.title,
            company_id = EXCLUDED.company_id,
            municipality_id = EXCLUDED.municipality_id,
            job_category_id = EXCLUDED.job_category_id,
            employment_type_id = EXCLUDED.employment_type_id,
            salary_min = EXCLUDED.salary_min,
            salary_max = EXCLUDED.salary_max,
            description = EXCLUDED.description,
            posted_at = EXCLUDED.posted_at,
            collected_at = EXCLUDED.collected_at,
            is_active = EXCLUDED.is_active
          RETURNING id;
          `,
          [
            String(sourceName),
            String(resolvedSourceJobId),
            String(title),
            companyId,
            municipalityId,
            jobCategoryId,
            employmentTypeId,
            salaryMin === undefined ? null : Number(salaryMin),
            salaryMax === undefined ? null : Number(salaryMax),
            description === undefined ? null : String(description),
            postedDate,
            collectedDate,
            isActive === undefined ? true : Boolean(isActive),
          ],
        );

        const jobPostingId = insertJob.rows[0].id;

        if (Array.isArray(skills)) {
          for (const s of skills) {
            if (!s) continue;
            const skillId = await getSkillId(client, String(s));
            if (!skillId) continue;
            await client.query(
              'INSERT INTO job_posting_skills(job_posting_id, skill_id) VALUES ($1,$2) ON CONFLICT DO NOTHING;',
              [jobPostingId, skillId],
            );
          }
        }

        await client.query(
          'UPDATE raw_job_postings SET processed_at=NOW(), processing_error=NULL, normalized_job_posting_id=$2 WHERE id=$1;',
          [rawId, jobPostingId],
        );

        await client.query('COMMIT;');
        ok += 1;
      } catch (err) {
        failed += 1;
        try { await client.query('ROLLBACK;'); } catch { /* ignore */ }

        const msg = String(err?.message ?? err);
        await client.query(
          'UPDATE raw_job_postings SET processed_at=NOW(), processing_error=$2 WHERE id=$1;',
          [rawId, msg],
        );
      }
    }

    // eslint-disable-next-line no-console
    console.log(`OK: normalized=${ok}, failed=${failed}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
