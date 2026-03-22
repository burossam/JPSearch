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

function Test-CommandAvailable([string]$cmd, [string]$hint) {
  if (Get-Command $cmd -ErrorAction SilentlyContinue) {
    return $true
  }

  Write-Host "`n[ERROR] '$cmd' が見つかりません。" -ForegroundColor Red
  Write-Host $hint
  return $false
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

if (-not (Test-CommandAvailable "node" "Node.js が必要です。")) { exit 1 }
if (-not (Test-CommandAvailable "npm" "Node.js の npm が必要です。")) { exit 1 }

npm --prefix json i
Ensure-RootNodeModulesLink

Assert-PortAvailable -p $Port

$env:DATABASE_URL = $DatabaseUrl
$env:PREFECTURES_GEOJSON = $PrefecturesGeoJson
$env:PORT = $Port
$env:BIND = $Bind

node server/index.mjs


