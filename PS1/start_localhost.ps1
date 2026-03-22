param(
  [int]$Port = 8000,
  [string]$Bind = "127.0.0.1"
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
  # このスクリプトを PS1/ に移動しても、常にリポジトリ直下を配信する
  $RepoRoot = Split-Path -Parent $PSScriptRoot
  Set-Location $RepoRoot

  $conn = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($conn) {
    $listenerPid = $conn.OwningProcess
    $proc = Get-Process -Id $listenerPid -ErrorAction SilentlyContinue
    $name = if ($proc) { $proc.ProcessName } else { "(unknown)" }
    Write-Host "Port $Port is already in use: PID=$listenerPid Name=$name"
  } else {
    $python = Get-Command python -ErrorAction SilentlyContinue
    if (-not $python) {
      throw "python not found. Install Python or add it to PATH (make sure 'python --version' works)."
    }
    $args = @('-m','http.server',"$Port",'--bind',"$Bind")
    Write-Host "Starting: python $($args -join ' ')"
    Start-Process -FilePath "python" -ArgumentList $args -WorkingDirectory $RepoRoot
  }

  $url = "http://$Bind`:$Port/"
  Write-Host "Opening: $url"
  Start-Process $url
} catch {
  Write-ExceptionDetails $_
  exit 1
}
