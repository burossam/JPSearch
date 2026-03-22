# 分析基盤DB（JPSearch）

目的: 検索UIの保存先ではなく、都道府県/市区町村/職種/スキル別の傾向分析・統計・図表・色分け地図（choropleth）まで見据えたデータモデルを最初から用意します。

このディレクトリには以下を置きます。

- `schema.sql`: PostgreSQL（PostGISなし）で動く最小スキーマ
- `schema_postgis.sql`: PostGISあり（geometry/地図向け）スキーマ
- `materialized_views.sql`: 集計を高速化する materialized view の例
- `aggregate_tables.sql`: 集計テーブル（日次）DDL（MVの代替/補完）
- `sample_queries.sql`: 集計・GeoJSON出力の例
- `etl.md`: raw→正規化ETLの最小フォーマット/手順
- `seed_prefectures.sql`: 都道府県マスタ（47件）投入
- `seed_municipalities_saitama.sql`: 埼玉（デモ）市区町村投入
- `seed_sample_data_saitama.sql`: デモ求人（埼玉のみ）投入

## 方針（重要）

- **事実（facts）**: `job_postings`（求人本体）/ 中間表（求人×スキル、求人×駅）
- **マスタ（dimensions）**: `prefectures` / `municipalities` / `job_categories` / `employment_types` / `skills` / `companies` / `stations`
- **生データ（raw）**: `raw_job_postings`（JSONBで保存）
- **分析結果（aggregates）**: MVや日次集計テーブル（将来の増分更新を見据える）

「検索UIの選択肢」をそのまま1テーブルで持たず、マスタと事実に分けます。

## 使い方（ローカル）

1. ルートの `docker-compose.yml` でDBを起動
2. `psql` で `db/schema_postgis.sql`（推奨）を流す
3. `db/seed_*.sql` を流してマスタ/デモデータを投入
4. 必要なら `db/materialized_views.sql` も流す

例（psql が入っている前提）:

- PostGISあり:
  - `psql "postgresql://jps:jps@localhost:5432/jps" -f db/schema_postgis.sql`
- seed（都道府県/埼玉/デモ求人）:
  - `psql "postgresql://jps:jps@localhost:5432/jps" -f db/seed_prefectures.sql`
  - `psql "postgresql://jps:jps@localhost:5432/jps" -f db/seed_municipalities_saitama.sql`
  - `psql "postgresql://jps:jps@localhost:5432/jps" -f db/seed_sample_data_saitama.sql`
- PostGISなし:
  - `psql "postgresql://jps:jps@localhost:5432/jps" -f db/schema.sql`

## 次のステップ（おすすめ順）

- まず `prefectures` / `municipalities` を投入（codeの統一が命）
- `raw_job_postings` に収集結果を格納
- パーサで `job_postings` と中間表へ正規化（手順: `db/etl.md`）
- MV/集計テーブルで都道府県×スキルなどを高速に参照
  - `db/refresh_aggregate_tables.sql`（`CALL refresh_aggregate_tables(...)`）
  - `db/refresh_materialized_views.sql`（`CALL refresh_materialized_views()`）
- 境界GeoJSONをDBへ取り込む（任意）
  - `tools/import_prefecture_boundaries_to_postgis.mjs`（`prefectures.geom` を更新）
- `ST_AsGeoJSON(geom)` またはAPIで GeoJSON を返してフロントで色分け
