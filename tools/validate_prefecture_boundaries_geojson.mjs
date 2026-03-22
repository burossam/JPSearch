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

function normalizePrefCode(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v).padStart(2, '0');

  const s = String(v).trim();
  if (!s) return null;

  if (/^\d{1,2}$/.test(s)) return s.padStart(2, '0');
  if (/^\d{2}$/.test(s)) return s;

  // Some datasets embed codes in longer strings.
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

function collectPropertyKeys(features, maxFeatures = 50) {
  const keys = new Set();
  const n = Math.min(features.length, maxFeatures);
  for (let i = 0; i < n; i += 1) {
    const props = features[i]?.properties;
    if (!props || typeof props !== 'object') continue;
    for (const k of Object.keys(props)) keys.add(k);
  }
  return Array.from(keys).sort((a, b) => a.localeCompare(b));
}

async function main() {
  const boundariesPath = path.resolve(
    repoRoot,
    getEnv('PREFECTURES_GEOJSON', 'assets/boundaries/prefectures.geojson'),
  );

  const raw = await fs.readFile(boundariesPath, 'utf8');
  const geojson = JSON.parse(raw);

  if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
    throw new Error('Invalid GeoJSON: expected FeatureCollection with features[]');
  }

  const features = geojson.features;
  const featureCount = features.length;

  const uniqueCodes = new Set();
  let recognizedFeatures = 0;

  /** @type {{idx: number, reason: string, sampleKeys: string[]}[]} */
  const unknown = [];

  for (let i = 0; i < features.length; i += 1) {
    const f = features[i];
    const code = getPrefCodeFromFeature(f);

    if (code) {
      uniqueCodes.add(code);
      recognizedFeatures += 1;
      continue;
    }

    const sampleKeys = f?.properties && typeof f.properties === 'object'
      ? Object.keys(f.properties).slice(0, 12)
      : [];

    unknown.push({ idx: i, reason: 'cannot-identify-prefecture', sampleKeys });
  }

  const missingCodes = PREFECTURES
    .map((p) => p.code)
    .filter((c) => !uniqueCodes.has(c));

  const relPath = path.relative(repoRoot, boundariesPath);

  // eslint-disable-next-line no-console
  console.log('=== Prefecture boundaries GeoJSON validation ===');
  // eslint-disable-next-line no-console
  console.log(`File: ${relPath}`);
  // eslint-disable-next-line no-console
  console.log(`Features: ${featureCount}`);
  // eslint-disable-next-line no-console
  console.log(`Recognized features: ${recognizedFeatures} (${Math.round((recognizedFeatures / Math.max(featureCount, 1)) * 100)}%)`);
  // eslint-disable-next-line no-console
  console.log(`Unique prefecture codes recognized: ${uniqueCodes.size} / 47`);

  const keys = collectPropertyKeys(features);
  // eslint-disable-next-line no-console
  console.log(`Property keys seen (first ${Math.min(features.length, 50)} features): ${keys.join(', ') || '(none)'}`);

  if (missingCodes.length) {
    // eslint-disable-next-line no-console
    console.log(`Missing prefecture codes (not detected): ${missingCodes.join(', ')}`);
    // eslint-disable-next-line no-console
    console.log('Hint: include one of these properties per Feature: prefectureCode / code / JIS_CODE / N03_007 / name / N03_001');
  }

  if (unknown.length) {
    // eslint-disable-next-line no-console
    console.log(`Unrecognized features: ${unknown.length} (showing up to 10)`);
    for (const u of unknown.slice(0, 10)) {
      // eslint-disable-next-line no-console
      console.log(`- idx=${u.idx} reason=${u.reason} keys=[${u.sampleKeys.join(', ')}]`);
    }
  }

  // eslint-disable-next-line no-console
  console.log('OK (structure parsed).');
}

main().catch((err) => {
  if (err && typeof err === 'object' && err.code === 'ENOENT') {
    // eslint-disable-next-line no-console
    console.error('File not found.');
    // eslint-disable-next-line no-console
    console.error(`- Put your boundaries GeoJSON at: assets/boundaries/prefectures.geojson`);
    // eslint-disable-next-line no-console
    console.error(`- Or set env PREFECTURES_GEOJSON to an alternative path.`);
    // eslint-disable-next-line no-console
    console.error(`- Missing path: ${err.path || '(unknown)'}`);
    process.exitCode = 1;
    return;
  }

  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
