# 色分け地図デモ（ど素人向け）

## 1) 最初にやること（1回だけ）

1. Docker Desktop をインストールして起動
   - https://www.docker.com/products/docker-desktop/
2. 都道府県の境界GeoJSONを用意
   - このリポジトリには同梱していません（ライセンス確認が必要なため）
   - `assets/boundaries/prefectures.geojson` として置く
   - 期待する属性は `assets/boundaries/README.md` を参照
   - ※無い場合でも、デモは「擬似タイル地図」を自動生成して続行できます

## 2) 実行（毎回）

PowerShellでこのコマンドを実行:

- `powershell -NoProfile -ExecutionPolicy Bypass -File PS1/run_choropleth_demo.ps1`

API版（GeoJSON/統計をAPIから返してフロントと結合）:

- `powershell -NoProfile -ExecutionPolicy Bypass -File PS1/run_choropleth_api_demo.ps1`

うまくいくと:
- DBが起動
- スキーマ/デモデータ投入
- `assets/generated/` に統計JSON/GeoJSONが生成
- ローカルサーバー（python）が起動し、地図ページがブラウザで開く

## よくあるエラー

- `docker` が見つからない
  - Docker Desktop を入れて起動してください
- `prefectures.geojson` が見つからない
   - 無くても続行できます（擬似タイル地図を生成）
