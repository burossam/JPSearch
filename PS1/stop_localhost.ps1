param(
  [int]$Port = 8000
)

$ErrorActionPreference = 'Stop'

$conn = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $conn) {
  Write-Host "Port ${Port}: no listener"
  exit 0
}

$listenerPid = $conn.OwningProcess
$proc = Get-Process -Id $listenerPid -ErrorAction SilentlyContinue
$name = if ($proc) { $proc.ProcessName } else { "(unknown)" }

Write-Host "Stopping listener on port ${Port}: PID=$listenerPid Name=$name"


if ($name -ne 'python' -and $name -ne 'py') {
  $ans = Read-Host "This doesn't look like a Python dev server. Stop it anyway? (y/N)"
  if ($ans -notin @('y','Y','yes','YES')) {
    Write-Host "Canceled"
    exit 1
  }
}

Stop-Process -Id $listenerPid -Force
Write-Host "Stopped"
