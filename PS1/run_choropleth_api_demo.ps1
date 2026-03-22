[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSUseApprovedVerbs', '', Justification='Demo helper script')]
param(
  [string]$DatabaseUrl = "postgresql://jps:jps@localhost:5432/jps",
  [string]$PrefecturesGeoJson = "assets/boundaries/prefectures.geojson",
  [int]$Port = 3000,
  [string]$Bind = "127.0.0.1"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Write-Title([string]$text) {
  Write-Host "`n==== $text ====" -ForegroundColor Cyan
}

function Test-CommandAvailable([string]$cmd, [string]$hint) {
  if (Get-Command $cmd -ErrorAction SilentlyContinue) {
    return $true
  }

  Write-Host "`n[ERROR] '$cmd' が見つかりません。" -ForegroundColor Red
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

function Get-ListenerPid([int]$p) {
  $conn = Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -eq $conn) { return $null }
  return $conn.OwningProcess
}

function Assert-PortAvailable([int]$p) {
  $pid = Get-ListenerPid $p
  if ($null -eq $pid) { return }

  $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
  $name = if ($proc) { $proc.ProcessName } else { "(unknown)" }

  Write-Host "`n[ERROR] Port ${p} は既に使用中です: PID=$pid Name=$name" -ForegroundColor Red
  Write-Host "- 対処: -Port を別の値にする（例: -Port 3001）か、該当プロセスを停止してください。"
  exit 1
}

Write-Title "前提チェック"
if (-not (Test-CommandAvailable "docker" "Docker Desktop をインストールして起動してください。`nhttps://www.docker.com/products/docker-desktop/")) { exit 1 }
if (-not (Test-CommandAvailable "npm" "Node.js が必要です。")) { exit 1 }

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
  Write-Host "`n[ERROR] DBが起動しませんでした。Docker Desktopが起動しているか確認してください。" -ForegroundColor Red
  exit 1
}

Write-Title "スキーマ/seed投入（+ 集計更新プロシージャ）"
Invoke-DockerPsqlFile "db/schema_postgis.sql"
Invoke-DockerPsqlFile "db/aggregate_tables.sql"
Invoke-DockerPsqlFile "db/materialized_views.sql"
Invoke-DockerPsqlFile "db/refresh_aggregate_tables.sql"
Invoke-DockerPsqlFile "db/refresh_materialized_views.sql"
Invoke-DockerPsqlFile "db/seed_prefectures.sql"
Invoke-DockerPsqlFile "db/seed_municipalities_saitama.sql"
Invoke-DockerPsqlFile "db/seed_sample_data_saitama.sql"

Write-Title "集計更新（直近7日）"
$env:DATABASE_URL = $DatabaseUrl
npm --prefix json i
Ensure-RootNodeModulesLink
node tools/refresh_aggregates.mjs

Write-Title "APIサーバー起動"
$env:PREFECTURES_GEOJSON = $PrefecturesGeoJson
$env:PORT = $Port
$env:BIND = $Bind

Assert-PortAvailable -p $Port

Start-Process "http://$Bind`:$Port/assets/choropleth_prefectures.html"
node server/index.mjs


