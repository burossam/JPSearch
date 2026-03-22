param(
  [int]$Port = 8000
)

$ErrorActionPreference = 'Stop'

function Write-ExceptionDetails([object]$err) {
  try {
    $e = $err.Exception
    Write-Host "[error] $($e.GetType().FullName): $($e.Message)" -ForegroundColor Red
    if ($err.InvocationInfo) {
      Write-Host "[error] at: $($err.InvocationInfo.PositionMessage)" -ForegroundColor Red
    }
    if ($err.ScriptStackTrace) {
      Write-Host "[error] ScriptStackTrace:`n$($err.ScriptStackTrace)" -ForegroundColor DarkRed
    }
    $inner = $e.InnerException
    $depth = 0
    while ($inner -and $depth -lt 8) {
      $depth++
      Write-Host "[error] InnerException#${depth}: $($inner.GetType().FullName): $($inner.Message)" -ForegroundColor DarkRed
      $inner = $inner.InnerException
    }
  } catch {
    Write-Host "[error] Failed to format error: $($_.Exception.Message)" -ForegroundColor Red
  }
}

try {
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
} catch {
  Write-ExceptionDetails $_
  exit 1
}
