# raw → 正規化 ETL（最小）

このリポジトリは「まず `raw_job_postings` に全部入れる → 正規化テーブルへ変換 → 集計更新」の流れを想定しています。

## 1) rawの投入（JSONL）

1行=1求人のJSON（JSON Lines）を想定。

最低限、以下があると正規化まで通せます。

- `sourceJobId`（文字列）: ソース内の求人ID
- `title`（文字列）
- `collectedAt`（YYYY-MM-DD か ISO）

推奨:

- `companyName`（文字列） または `company.name`
- `industry`（文字列） または `company.industry`
- `employmentType`（例: 正社員）
- `jobCategory`（例: フロントエンド）
- `municipalityCode`（例: 11103）
- `salaryMin` / `salaryMax`（数値）
- `description`（文字列）
- `postedAt`（YYYY-MM-DD）
- `isActive`（boolean）
- `skills`（文字列配列）

投入コマンド例:

- `node tools/ingest_raw_job_postings_jsonl.mjs path/to/jobs.jsonl --source mysource`

## 2) 正規化（raw → job_postings 等）

- `node tools/etl_normalize_raw_job_postings.mjs`

### 実データのキー名に合わせる（編集なしで差し替え）

実rawのキー名が想定と違う場合は、`ETL_MAPPING_PATH` で「どのキーを見に行くか」をJSONで差し替えできます。

- 例（PowerShell）:
	- `$env:ETL_MAPPING_PATH = "json/etl_mapping.example.json"`
	- `node tools/etl_normalize_raw_job_postings.mjs`

`ETL_MAPPING_PATH` のJSONは、以下のように「フィールド名 → パス配列」です（先頭から順に探索します）。

```json
{
	"title": ["title", "jobTitle"],
	"sourceJobId": ["sourceJobId", "id", "jobId"],
	"companyName": ["companyName", "company.name"],
	"municipalityCode": ["municipalityCode", "location.municipalityCode"]
}
```

処理済み判定:
- `raw_job_postings.processed_at` がNULLの行だけ処理します。
- 失敗した行も `processed_at` は埋まり、`processing_error` に理由が入ります。

## 3) 集計更新

- MV運用: `CALL refresh_materialized_views();`
- 日次集計テーブル運用: `CALL refresh_aggregate_tables('2026-03-01','2026-03-12');`

ツール:
- `node tools/refresh_aggregates.mjs 2026-03-01 2026-03-12`

### 定期実行（Windows例）

最小は「Windows タスク スケジューラ」で、毎日1回このコマンドを実行する形です。

- `powershell -NoProfile -ExecutionPolicy Bypass -File PS1/refresh_aggregates.ps1`

※DB起動（Docker Desktop起動）と、`DATABASE_URL` の設定が必要です。
