import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function getEnv(name, fallback) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
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

function normalizePrefCode(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v).padStart(2, '0');
  const s = String(v).trim();
  if (!s) return null;

  // numeric string
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, '0');
  if (/^\d{2}$/.test(s)) return s;

  // sometimes like '01'
  const m = s.match(/(\d{1,2})/);
  if (m) return m[1].padStart(2, '0');

  return null;
}

function pickFirst(obj, keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
  }
  return undefined;
}

function getPrefCodeFromFeature(feature) {
  const props = feature && feature.properties ? feature.properties : undefined;

  // common candidates
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

  // Some datasets keep '東京都' without suffix? (rare). Try partial match.
  if (name) {
    for (const [fullName, code] of codeByName.entries()) {
      if (name.includes(fullName) || fullName.includes(name)) return code;
    }
  }

  return null;
}

async function main() {
  const boundariesPath = path.resolve(
    repoRoot,
    getEnv('PREFECTURES_GEOJSON', 'assets/boundaries/prefectures.geojson'),
  );

  const statsPath = path.resolve(repoRoot, 'assets/generated/prefecture_job_stats.json');

  const outDir = path.resolve(__dirname, '../assets/generated');
  const outPath = path.join(outDir, 'prefectures_jobcount.geojson');

  await ensureDir(outDir);

  let geojsonRaw;
  try {
    geojsonRaw = await fs.readFile(boundariesPath, 'utf8');
  } catch (err) {
    if (err && typeof err === 'object' && err.code === 'ENOENT') {
      const tilemap = buildTilemapGeojson();
      await fs.mkdir(path.dirname(boundariesPath), { recursive: true });
      await fs.writeFile(boundariesPath, JSON.stringify(tilemap, null, 2), 'utf8');
      // eslint-disable-next-line no-console
      console.warn(`[WARN] Boundaries GeoJSON not found. Generated tilemap instead: ${path.relative(repoRoot, boundariesPath)}`);
      geojsonRaw = JSON.stringify(tilemap);
    } else {
      throw err;
    }
  }

  const statsRaw = await fs.readFile(statsPath, 'utf8');

  const geojson = JSON.parse(geojsonRaw);
  const statsJson = JSON.parse(statsRaw);

  const rows = Array.isArray(statsJson?.rows) ? statsJson.rows : [];
  const statsByCode = new Map(rows.map((r) => [String(r.prefectureCode).padStart(2, '0'), r]));

  if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
    throw new Error('Invalid GeoJSON: expected FeatureCollection with features[]');
  }

  const enrichedFeatures = geojson.features.map((f) => {
    const code = getPrefCodeFromFeature(f);
    const stat = code ? statsByCode.get(code) : undefined;

    const props = (f && f.properties && typeof f.properties === 'object') ? f.properties : {};

    const nextProps = {
      ...props,
      prefectureCode: code ?? props.prefectureCode ?? null,
      prefectureName: (stat && stat.prefectureName) ? stat.prefectureName : (props.prefectureName ?? props.name ?? null),
      jobCount: stat ? stat.jobCount : 0,
      avgSalaryMin: stat ? stat.avgSalaryMin : null,
      avgSalaryMax: stat ? stat.avgSalaryMax : null,
    };

    return { ...f, properties: nextProps };
  });

  const out = {
    type: 'FeatureCollection',
    generatedAt: new Date().toISOString(),
    source: {
      boundariesPath: path.relative(repoRoot, boundariesPath),
      statsPath: path.relative(repoRoot, statsPath),
    },
    features: enrichedFeatures,
  };

  await fs.writeFile(outPath, JSON.stringify(out, null, 2), 'utf8');

  // eslint-disable-next-line no-console
  console.log(`Wrote: ${path.relative(repoRoot, outPath)} (features: ${enrichedFeatures.length})`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
