import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import express from 'express';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function getEnv(name, fallback) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}

function redactDbUrl(databaseUrl) {
  if (!databaseUrl) return '';
  const s = String(databaseUrl);
  try {
    const u = new URL(s);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    // Fallback for non-standard connection strings
    return s.replace(/\/\/([^:\/]+):([^@\/]+)@/g, '//$1:***@');
  }
}

function formatError(err, { databaseUrl } = {}) {
  try {
    if (err === null || err === undefined) return 'Unknown error';
    if (typeof err === 'string') return err;

    const message = typeof err?.message === 'string' ? err.message.trim() : '';
    if (message) return message;

    const parts = [];
    if (typeof err?.name === 'string' && err.name) parts.push(err.name);
    if (typeof err?.code === 'string' && err.code) parts.push(`code=${err.code}`);
    if (typeof err?.errno === 'number') parts.push(`errno=${err.errno}`);
    if (typeof err?.syscall === 'string' && err.syscall) parts.push(`syscall=${err.syscall}`);
    if (typeof err?.address === 'string' && err.address) parts.push(`address=${err.address}`);
    if (typeof err?.port === 'number') parts.push(`port=${err.port}`);

    const base = parts.length ? parts.join(' ') : 'Unknown error';

    if (databaseUrl) {
      return `${base} (DATABASE_URL=${redactDbUrl(databaseUrl)})`;
    }

    return base;
  } catch {
    return 'Unknown error';
  }
}

function normalizePrefCode(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v).padStart(2, '0');
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, '0');
  if (/^\d{2}$/.test(s)) return s;
  const m = s.match(/(\d{1,2})/);
  if (m) return m[1].padStart(2, '0');
  return null;
}

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

const codeByName = new Map(PREFECTURES.map((p) => [p.name, p.code]));

function pickFirst(obj, keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
  }
  return undefined;
}

function getPrefCodeFromFeature(feature) {
  const props = feature && feature.properties ? feature.properties : undefined;
  const codeCandidate = pickFirst(props, [
    'prefectureCode',
    'pref_code',
    'prefCode',
    'code',
    'JIS_CODE',
    'jis_code',
    'N03_007',
    'N03_006',
  ]);

  const normalized = normalizePrefCode(codeCandidate);
  if (normalized) return normalized;

  const nameCandidate = pickFirst(props, ['prefectureName', 'prefName', 'name', 'N03_001']);
  const name = nameCandidate ? String(nameCandidate).trim() : '';
  if (name && codeByName.has(name)) return codeByName.get(name) ?? null;

  if (name) {
    for (const [fullName, code] of codeByName.entries()) {
      if (name.includes(fullName) || fullName.includes(name)) return code;
    }
  }

  return null;
}

function rectPolygon([minLon, minLat, maxLon, maxLat]) {
  return {
    type: 'Polygon',
    coordinates: [[
      [minLon, minLat],
      [maxLon, minLat],
      [maxLon, maxLat],
      [minLon, maxLat],
      [minLon, minLat],
    ]],
  };
}

function buildTilemapGeojson() {
  const cols = 10;
  const cellW = 3.0;
  const cellH = 2.0;
  const originLon = 123.0;
  const originLat = 24.0;

  const features = PREFECTURES.map((p, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);

    const minLon = originLon + col * cellW;
    const minLat = originLat + row * cellH;
    const maxLon = minLon + (cellW * 0.9);
    const maxLat = minLat + (cellH * 0.9);

    return {
      type: 'Feature',
      properties: {
        prefectureCode: p.code,
        prefectureName: p.name,
      },
      geometry: rectPolygon([minLon, minLat, maxLon, maxLat]),
    };
  });

  return {
    type: 'FeatureCollection',
    generatedAt: new Date().toISOString(),
    note: 'This is a schematic tilemap for demo purposes. Replace with real boundaries when ready.',
    features,
  };
}

/**
 * Small in-memory cache for boundaries GeoJSON.
 * @type {{path: string|null, mtimeMs: number|null, geojson: any}|null}
 */
let boundariesCache = null;

async function loadBoundariesGeojson(boundariesPath) {
  try {
    const stat = await fs.stat(boundariesPath);
    if (
      boundariesCache
      && boundariesCache.path === boundariesPath
      && boundariesCache.mtimeMs === stat.mtimeMs
      && boundariesCache.geojson
    ) {
      return boundariesCache.geojson;
    }

    const raw = await fs.readFile(boundariesPath, 'utf8');
    const geojson = JSON.parse(raw);

    if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
      throw new Error('Invalid GeoJSON: expected FeatureCollection with features[]');
    }

    boundariesCache = { path: boundariesPath, mtimeMs: stat.mtimeMs, geojson };
    return geojson;
  } catch {
    boundariesCache = { path: null, mtimeMs: null, geojson: null };
    return buildTilemapGeojson();
  }
}

async function queryPrefectureStats(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
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

    const res = await client.query(sql);
    return res.rows.map((r) => ({
      prefectureCode: String(r.prefecture_code).padStart(2, '0'),
      prefectureName: r.prefecture_name,
      jobCount: Number(r.job_count ?? 0),
      avgSalaryMin: r.avg_salary_min === null ? null : Number(r.avg_salary_min),
      avgSalaryMax: r.avg_salary_max === null ? null : Number(r.avg_salary_max),
    }));
  } finally {
    await client.end();
  }
}

function mergeStatsIntoGeojson(geojson, rows) {
  const statsByCode = new Map(rows.map((r) => [String(r.prefectureCode).padStart(2, '0'), r]));

  const enrichedFeatures = geojson.features.map((f) => {
    const code = getPrefCodeFromFeature(f);
    const stat = code ? statsByCode.get(code) : undefined;

    const props = (f && f.properties && typeof f.properties === 'object') ? f.properties : {};

    return {
      ...f,
      properties: {
        ...props,
        prefectureCode: code ?? props.prefectureCode ?? null,
        prefectureName: (stat && stat.prefectureName) ? stat.prefectureName : (props.prefectureName ?? props.name ?? null),
        jobCount: stat ? stat.jobCount : 0,
        avgSalaryMin: stat ? stat.avgSalaryMin : null,
        avgSalaryMax: stat ? stat.avgSalaryMax : null,
      },
    };
  });

  return {
    type: 'FeatureCollection',
    generatedAt: new Date().toISOString(),
    features: enrichedFeatures,
  };
}

async function main() {
  const databaseUrl = getEnv('DATABASE_URL', 'postgresql://jps:jps@localhost:5432/jps');
  const bind = getEnv('BIND', '127.0.0.1');
  const port = Number(getEnv('PORT', '3000'));
  const boundariesPath = path.resolve(
    repoRoot,
    getEnv('PREFECTURES_GEOJSON', 'assets/boundaries/prefectures.geojson'),
  );

  const app = express();

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  app.get('/api/prefectures/stats', async (_req, res) => {
    try {
      const rows = await queryPrefectureStats(databaseUrl);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ generatedAt: new Date().toISOString(), rows });
    } catch (err) {
      res.status(500).json({ error: formatError(err, { databaseUrl }) });
    }
  });

  app.get('/api/prefectures/geojson', async (_req, res) => {
    try {
      const boundaries = await loadBoundariesGeojson(boundariesPath);

      let rows = [];
      let warning = null;
      try {
        rows = await queryPrefectureStats(databaseUrl);
      } catch (err) {
        warning = formatError(err, { databaseUrl });
      }

      const merged = mergeStatsIntoGeojson(boundaries, rows);
      if (warning) merged.warning = `Stats unavailable: ${warning}`;
      res.setHeader('Cache-Control', 'no-store');
      res.json(merged);
    } catch (err) {
      res.status(500).json({ error: formatError(err, { databaseUrl }) });
    }
  });

  // Static hosting for local demo (same origin, no CORS issues)
  app.use('/assets', express.static(path.resolve(repoRoot, 'assets')));
  app.use('/CSS', express.static(path.resolve(repoRoot, 'CSS')));
  app.use('/HTML', express.static(path.resolve(repoRoot, 'HTML')));
  app.use('/JS', express.static(path.resolve(repoRoot, 'JS')));

  const server = app.listen(port, bind, () => {
    // eslint-disable-next-line no-console
    console.log(`API server: http://${bind}:${port}`);
    // eslint-disable-next-line no-console
    console.log(`Map:        http://${bind}:${port}/assets/choropleth_prefectures.html`);
  });

  server.on('error', (err) => {
    if (err && typeof err === 'object' && err.code === 'EADDRINUSE') {
      // eslint-disable-next-line no-console
      console.error(`[ERROR] Port ${port} is already in use on ${bind}.`);
      // eslint-disable-next-line no-console
      console.error('Try one of:');
      // eslint-disable-next-line no-console
      console.error(`- Use another port: set PORT=3001 (PowerShell: $env:PORT=3001) then start again`);
      // eslint-disable-next-line no-console
      console.error(`- Stop the process using ${bind}:${port}`);
      process.exit(1);
    }

    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
