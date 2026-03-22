import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {{code: string, name: string}[]} */
const PREFECTURES = [
  { code: '01', name: '北海道' },
  { code: '02', name: '青森県' },
  { code: '03', name: '岩手県' },
  { code: '04', name: '宮城県' },
  { code: '05', name: '秋田県' },
  { code: '06', name: '山形県' },
  { code: '07', name: '福島県' },
  { code: '08', name: '茨城県' },
  { code: '09', name: '栃木県' },
  { code: '10', name: '群馬県' },
  { code: '11', name: '埼玉県' },
  { code: '12', name: '千葉県' },
  { code: '13', name: '東京都' },
  { code: '14', name: '神奈川県' },
  { code: '15', name: '新潟県' },
  { code: '16', name: '富山県' },
  { code: '17', name: '石川県' },
  { code: '18', name: '福井県' },
  { code: '19', name: '山梨県' },
  { code: '20', name: '長野県' },
  { code: '21', name: '岐阜県' },
  { code: '22', name: '静岡県' },
  { code: '23', name: '愛知県' },
  { code: '24', name: '三重県' },
  { code: '25', name: '滋賀県' },
  { code: '26', name: '京都府' },
  { code: '27', name: '大阪府' },
  { code: '28', name: '兵庫県' },
  { code: '29', name: '奈良県' },
  { code: '30', name: '和歌山県' },
  { code: '31', name: '鳥取県' },
  { code: '32', name: '島根県' },
  { code: '33', name: '岡山県' },
  { code: '34', name: '広島県' },
  { code: '35', name: '山口県' },
  { code: '36', name: '徳島県' },
  { code: '37', name: '香川県' },
  { code: '38', name: '愛媛県' },
  { code: '39', name: '高知県' },
  { code: '40', name: '福岡県' },
  { code: '41', name: '佐賀県' },
  { code: '42', name: '長崎県' },
  { code: '43', name: '熊本県' },
  { code: '44', name: '大分県' },
  { code: '45', name: '宮崎県' },
  { code: '46', name: '鹿児島県' },
  { code: '47', name: '沖縄県' },
];

function getEnv(name, fallback) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function main() {
  const databaseUrl = getEnv('DATABASE_URL', 'postgresql://jps:jps@localhost:5432/jps');
  const allowEmpty = getEnv('ALLOW_EMPTY_STATS', '') === '1';

  const outDir = path.resolve(__dirname, '../assets/generated');
  const outPath = path.join(outDir, 'prefecture_job_stats.json');

  await ensureDir(outDir);

  const sql = `
      SELECT
        p.code AS prefecture_code,
        p.name AS prefecture_name,
        COUNT(j.id) AS job_count,
        AVG(j.salary_min)::numeric(10,2) AS avg_salary_min,
        AVG(j.salary_max)::numeric(10,2) AS avg_salary_max
      FROM prefectures p
      LEFT JOIN municipalities m ON m.prefecture_id = p.id
      LEFT JOIN job_postings j ON j.municipality_id = m.id AND j.is_active = TRUE
      GROUP BY p.code, p.name
      ORDER BY p.code;
    `;

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    const res = await client.query(sql);

    const rows = res.rows.map((r) => ({
      prefectureCode: String(r.prefecture_code).padStart(2, '0'),
      prefectureName: r.prefecture_name,
      jobCount: Number(r.job_count ?? 0),
      avgSalaryMin: r.avg_salary_min === null ? null : Number(r.avg_salary_min),
      avgSalaryMax: r.avg_salary_max === null ? null : Number(r.avg_salary_max),
    }));

    await fs.writeFile(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2), 'utf8');
    // eslint-disable-next-line no-console
    console.log(`Wrote: ${path.relative(process.cwd(), outPath)} (${rows.length} rows)`);
  } catch (err) {
    if (!allowEmpty) throw err;

    const rows = PREFECTURES.map((p) => ({
      prefectureCode: p.code,
      prefectureName: p.name,
      jobCount: 0,
      avgSalaryMin: null,
      avgSalaryMax: null,
    }));

    await fs.writeFile(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), rows, warning: 'DB unavailable; wrote empty stats (ALLOW_EMPTY_STATS=1)' }, null, 2), 'utf8');
    // eslint-disable-next-line no-console
    console.warn(`[WARN] DB unavailable. Wrote empty stats because ALLOW_EMPTY_STATS=1: ${path.relative(process.cwd(), outPath)}`);
  } finally {
    try { await client.end(); } catch { /* ignore */ }
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
