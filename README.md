## 分析基盤DB（傾向分析/地図）

都道府県別の傾向分析・統計・図表・色分け地図まで見据えたDBスキーマを `db/` に用意しています。

- スキーマ: `db/schema.sql`（PostGISなし） / `db/schema_postgis.sql`（PostGISあり）
- 集計/MV/GeoJSON例: `db/materialized_views.sql` / `db/sample_queries.sql`
- ローカルDB: `docker-compose.yml`（PostGIS入り）

起動例:

- `docker compose up -d`
- `psql "postgresql://jps:jps@localhost:5432/jps" -f db/schema_postgis.sql`

### マスタ/デモデータ投入（任意）

- `psql "postgresql://jps:jps@localhost:5432/jps" -f db/seed_prefectures.sql`
- `psql "postgresql://jps:jps@localhost:5432/jps" -f db/seed_municipalities_saitama.sql`
- `psql "postgresql://jps:jps@localhost:5432/jps" -f db/seed_sample_data_saitama.sql`

### 色分け地図（最小デモ）

このリポジトリには、DB集計 → GeoJSON → 色分け地図 の最小パスを用意しています。

1) 都道府県の境界GeoJSONを配置（同梱しません）
- `assets/boundaries/prefectures.geojson` を置く
	- 置いた後に、検証（任意だが推奨）:
		- `npm --prefix json run geojson:validate:pref-boundaries`

2) 統計JSON→GeoJSONを生成
- `npm --prefix json i`
- `npm --prefix json run demo:choropleth`

DBが無い/起動できないPCで「地図の形・色分けだけ」確認したい場合は、空の統計（全都道府県 0件）で生成できます:
- PowerShell例: `$env:ALLOW_EMPTY_STATS=1; npm --prefix json run demo:choropleth`

3) 地図を開く
- `assets/choropleth_prefectures.html`

ど素人向け: PowerShell 1コマンドで通す場合は [PS1/README_demo.md](PS1/README_demo.md) を参照。

### APIでGeoJSON/統計を返す（フロント結合）

ローカルで「GeoJSONを生成して assets/ を読む」方式に加えて、
APIから直接 GeoJSON/統計 を返して地図ページと結合する最小実装を入れています。

- API: `server/index.mjs`
- 統計: `GET /api/prefectures/stats`
- GeoJSON（境界 + 統計マージ済み）: `GET /api/prefectures/geojson`

起動:

- `npm --prefix json i`
- `set DATABASE_URL=postgresql://jps:jps@localhost:5432/jps`（PowerShellなら `$env:DATABASE_URL=...`）
- `npm --prefix json run api:start`

※ `Error: listen EADDRINUSE ... 3000` が出る場合は、3000番ポートが既に使われています。
- 例（PowerShell）: `$env:PORT=3001; npm --prefix json run api:start`
- もしくは 3000 を使っているプロセスを停止してください。

地図:

- `http://127.0.0.1:3000/assets/choropleth_prefectures.html`

（このHTMLは、まず `/api/prefectures/geojson` を試し、失敗したら `assets/generated/*.geojson` にフォールバックします）

### 勤務地モーダルUIデモ（静的HTML）

勤務地/職種などの検索条件モーダル（静的HTML + JS + CSS）のデモは `HTML/` 配下にあります。

起動（例）:

- `powershell -NoProfile -ExecutionPolicy Bypass -File PS1/restart_localhost.ps1`

開くURL:

- `http://127.0.0.1:8000/HTML/work_location_modal_demo_entry.html`
- `http://127.0.0.1:8000/HTML/work_location_modal_demo_all_regions_aomori_grouped.html?tab=work`

埼玉県マップ（写真）:

- `http://127.0.0.1:8000/assets/saitama_map.html`（`assets/saitama_map.png` を置くか、「写真を選ぶ」でローカル画像を表示）

### raw→正規化ETL（次フェーズの土台）

raw投入→正規化→集計更新の最小手順は [db/etl.md](db/etl.md) を参照。

### 定期集計更新（MV refresh / 日次集計テーブル）

DB側に以下を追加しています:

- `db/refresh_aggregate_tables.sql`（`CALL refresh_aggregate_tables(...)`）
- `db/refresh_materialized_views.sql`（`CALL refresh_materialized_views()`）

Nodeツール:

- `node tools/refresh_aggregates.mjs 2026-03-01 2026-03-12`
- `npm --prefix json run db:refresh:aggregates`

Windowsで毎日回す例（タスクスケジューラ）:

- 例: 毎日 01:30 に直近7日分を更新
	- `schtasks /Create /F /SC DAILY /ST 01:30 /TN "jpsearch-refresh-aggregates" /TR "powershell -NoProfile -ExecutionPolicy Bypass -File \"%CD%\\PS1\\refresh_aggregates.ps1\""`

# JPSearch
日本のIT求人に関する検索条件機能
