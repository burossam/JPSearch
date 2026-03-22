# 境界GeoJSON（ユーザー配置）

このリポジトリは、都道府県/市区町村の境界データ（GeoJSON）自体は同梱しません。
（データ提供元のライセンス確認が必要なため）

## 必要なファイル

- `assets/boundaries/prefectures.geojson`

ファイルが無い場合でも、デモ実行スクリプト（[PS1/run_choropleth_demo.ps1](../../PS1/run_choropleth_demo.ps1)）が
擬似のタイル型GeoJSONを自動生成して色分け確認できるようにしています。

## 期待する属性（どれかが入っていればOK）

[tools/merge_prefecture_stats_into_geojson.mjs](../../tools/merge_prefecture_stats_into_geojson.mjs) は、以下のいずれかで都道府県を同定します。

- コード系: `prefectureCode` / `code` / `JIS_CODE` / `N03_007` / `N03_006`
- 名称系: `prefectureName` / `name` / `N03_001`

どれも無い場合でも「名称が含まれる」形なら推測します（例: `name: "東京都"`）。

## 次にやると良いこと

- 置いたファイルが想定どおり読めるか確認:
  - `npm --prefix json run geojson:validate:pref-boundaries`

## 入手元の例（※必ずライセンス確認）

境界データは提供元ごとに利用条件が異なるため、このリポジトリではダウンロードや同梱をしません。

よく使われる入手元の例:

- e-Stat（政府統計の総合窓口）系の境界データ
- 国土地理院（GSI）系の行政区域データ

どれを使う場合も、配布ページの利用規約・出典表記・二次配布可否を確認して、問題ない形で `assets/boundaries/prefectures.geojson` を用意してください。

## 変換の最低条件

- GeoJSON の `FeatureCollection` で、`features[]` がある
- 各Featureに都道府県を特定できるプロパティが入っている（コード推奨）

推奨（このどれかが入ると確実）:

- `prefectureCode`（01〜47）
- `JIS_CODE`（1〜47 / 01〜47 どちらでも可。内部で正規化します）

名称しか無い場合でも以下なら動きます:

- `name: "東京都"` のように都道府県名が入っている

※このデモは「都道府県を同定できるか」がすべてなので、境界の精度は後で差し替え可能です。

- 地図を DB 側の `prefectures.geom` / `municipalities.geom` に取り込む場合は、
  GeoJSON→PostGIS 取り込みの手順を追加します（必要になったら言ってください）。
