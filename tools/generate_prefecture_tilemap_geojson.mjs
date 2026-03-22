import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

/**
 * 擬似「都道府県地図」(tilemap) を GeoJSON として生成する。
 * - 本物の境界データはライセンス確認が必要なので同梱しない
 * - 代わりに、47都道府県をグリッド上の矩形ポリゴンにして色分け確認ができるようにする
 */

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

function rectPolygon([minLon, minLat, maxLon, maxLat]) {
  // GeoJSON polygon ring must be closed
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

async function main() {
  const outPath = process.argv[2]
    ? path.resolve(repoRoot, process.argv[2])
    : path.resolve(repoRoot, 'assets/boundaries/prefectures.geojson');
  await fs.mkdir(path.dirname(outPath), { recursive: true });

  // Arrange 47 tiles in a 10x5 grid over roughly Japan's bbox.
  const cols = 10;
  const cellW = 3.0;  // degrees lon (rough)
  const cellH = 2.0;  // degrees lat (rough)
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

  const fc = {
    type: 'FeatureCollection',
    generatedAt: new Date().toISOString(),
    note: 'This is a schematic tilemap for demo purposes. Replace with real boundaries when ready.',
    features,
  };

  await fs.writeFile(outPath, JSON.stringify(fc, null, 2), 'utf8');
  // eslint-disable-next-line no-console
  console.log(`Wrote: ${path.relative(repoRoot, outPath)} (tilemap, features: ${features.length})`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
