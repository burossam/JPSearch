[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSUseApprovedVerbs', '', Justification='Demo helper script')]
param(
  [string]$DatabaseUrl = "postgresql://jps:jps@localhost:5432/jps",
  [int]$Days = 7
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

if (-not (Test-CommandAvailable "node" "Node.js が必要です。")) { exit 1 }

# Ensure tools/ scripts can resolve deps installed under json/node_modules.
node tools/lib/ensure_root_node_modules.mjs

$from = (Get-Date).AddDays(-1 * $Days).ToString('yyyy-MM-dd')
$to = (Get-Date).ToString('yyyy-MM-dd')

$env:DATABASE_URL = $DatabaseUrl
node tools/refresh_aggregates.mjs $from $to


