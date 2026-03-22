import fs from 'node:fs';
import readline from 'node:readline';
import process from 'node:process';
import pg from 'pg';

const { Client } = pg;

function getEnv(name, fallback) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}

function getArgValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return null;
  return process.argv[i + 1] ?? null;
}

async function main() {
  const databaseUrl = getEnv('DATABASE_URL', 'postgresql://jps:jps@localhost:5432/jps');
  const filePath = process.argv[2];
  if (!filePath) {
    throw new Error('Usage: node tools/ingest_raw_job_postings_jsonl.mjs <file.jsonl> --source <sourceName>');
  }

  const sourceName = getArgValue('--source') ?? 'unknown';

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  let inserted = 0;
  let failed = 0;

  try {
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const obj = JSON.parse(trimmed);
        const sourceJobId = obj?.sourceJobId ?? obj?.id ?? obj?.jobId ?? null;

        await client.query(
          'INSERT INTO raw_job_postings(source_name, source_job_id, raw_json) VALUES ($1,$2,$3::jsonb);',
          [sourceName, sourceJobId ? String(sourceJobId) : null, JSON.stringify(obj)],
        );
        inserted += 1;
      } catch (e) {
        failed += 1;
        // eslint-disable-next-line no-console
        console.error(`[WARN] skip line (invalid json or insert failed): ${e?.message ?? e}`);
      }
    }

    // eslint-disable-next-line no-console
    console.log(`OK: raw inserted=${inserted}, failed=${failed}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
