[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSUseApprovedVerbs', '', Justification='Demo helper script')]
param(
  [string]$DatabaseUrl = "postgresql://jps:jps@localhost:5432/jps",
  [string]$PrefecturesGeoJson = "assets/boundaries/prefectures.geojson",
  [int]$Port = 8000,
  [string]$Bind = "127.0.0.1"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Write-Title([string]$text) {
  Write-Host "\n==== $text ====" -ForegroundColor Cyan
}

function Test-CommandAvailable([string]$cmd, [string]$hint) {
  if (Get-Command $cmd -ErrorAction SilentlyContinue) {
    return $true
  }

  Write-Host "\n[ERROR] '$cmd' が見つかりません。" -ForegroundColor Red
  Write-Host $hint
  return $false
}

function Invoke-DockerPsqlFile([string]$sqlFilePath) {
  $full = Resolve-Path $sqlFilePath
  Write-Host "- apply: $sqlFilePath"
  Get-Content -Raw $full | docker exec -i jpsearch-db psql -U jps -d jps
}

function Ensure-RootNodeModulesLink() {
  $jsonNodeModules = Join-Path $repoRoot "json\node_modules"
  $rootNodeModules = Join-Path $repoRoot "node_modules"

  if (-not (Test-Path $jsonNodeModules)) { return }
  if (Test-Path $rootNodeModules) { return }

  try {
    New-Item -ItemType Junction -Path $rootNodeModules -Target $jsonNodeModules | Out-Null
  } catch {
    cmd /c "mklink /J \"$rootNodeModules\" \"$jsonNodeModules\"" | Out-Null
  }
}

Write-Title "前提チェック"
if (-not (Test-CommandAvailable "docker" "Docker Desktop をインストールして起動してください。`nhttps://www.docker.com/products/docker-desktop/")) { exit 1 }
if (-not (Test-CommandAvailable "npm" "Node.js が必要です（このPCには入っているはずです）。")) { exit 1 }
if (-not (Test-CommandAvailable "python" "python が見つかりません。ローカルサーバー起動に必要です。`nhttps://www.python.org/downloads/")) { exit 1 }

Write-Title "境界GeoJSONの確認"
if (-not (Test-Path $PrefecturesGeoJson)) {
  Write-Host "\n[WARN] 都道府県境界GeoJSONが見つかりません: $PrefecturesGeoJson" -ForegroundColor Yellow
  Write-Host "本物の境界データはライセンス確認が必要なので同梱していません。" -ForegroundColor Yellow
  Write-Host "代わりに『擬似（タイル型）都道府県地図』を自動生成して続行します。" -ForegroundColor Yellow
  node tools/generate_prefecture_tilemap_geojson.mjs $PrefecturesGeoJson
}

Write-Title "DB起動 (docker compose up -d)"
docker compose up -d

Write-Title "DB起動待ち (pg_isready)"
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  try {
    docker exec jpsearch-db pg_isready -U jps -d jps | Out-Null
    $ready = $true
    break
  } catch {
    Start-Sleep -Seconds 1
  }
}
if (-not $ready) {
  Write-Host "\n[ERROR] DBが起動しませんでした。Docker Desktopが起動しているか確認してください。" -ForegroundColor Red
  exit 1
}

Write-Title "スキーマ/seed投入"
Invoke-DockerPsqlFile "db/schema_postgis.sql"
Invoke-DockerPsqlFile "db/seed_prefectures.sql"
Invoke-DockerPsqlFile "db/seed_municipalities_saitama.sql"
Invoke-DockerPsqlFile "db/seed_sample_data_saitama.sql"

Write-Title "Node依存関係のインストール"
# 初回だけ少し時間がかかります
npm --prefix json i
Ensure-RootNodeModulesLink

Write-Title "統計JSON生成 (assets/generated/prefecture_job_stats.json)"
$env:DATABASE_URL = $DatabaseUrl
node tools/export_prefecture_stats.mjs

Write-Title "境界GeoJSONへ統計をマージ (assets/generated/prefectures_jobcount.geojson)"
$env:PREFECTURES_GEOJSON = $PrefecturesGeoJson
node tools/merge_prefecture_stats_into_geojson.mjs

Write-Title "地図を開く"
# ローカルサーバー起動（fetchが file:// だと失敗しやすいので）
& "$PSScriptRoot/start_localhost.ps1" -Port $Port -Bind $Bind | Out-Null

$mapUrl = "http://$Bind`:$Port/assets/choropleth_prefectures.html"
Start-Process $mapUrl

Write-Host "\nOK: 色分け地図をブラウザで開きました。" -ForegroundColor Green


