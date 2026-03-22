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

# このスクリプトを PS1/ に移動しても、常にリポジトリ直下を配信する
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Get-ListenerPid([int]$p) {
  $conn = Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -eq $conn) { return $null }
  return $conn.OwningProcess
}

function Stop-Listener([int]$p) {
  $listenerPid = Get-ListenerPid $p
  if ($null -eq $listenerPid) {
    Write-Host "[stop] Port ${p}: no listener"
    return
  }

  $proc = Get-Process -Id $listenerPid -ErrorAction SilentlyContinue
  $name = if ($proc) { $proc.ProcessName } else { "(unknown)" }

  Write-Host "[stop] Port ${p}: PID=$listenerPid Name=$name"

  if ($name -ne 'python' -and $name -ne 'py') {
    $ans = Read-Host "This doesn't look like a Python dev server. Stop it anyway? (y/N)"
    if ($ans -notin @('y','Y','yes','YES')) {
      Write-Host "[stop] canceled"
      return
    }
  }

  Stop-Process -Id $listenerPid -Force
  Start-Sleep -Milliseconds 300
  Write-Host "[stop] done"
}

function Start-Server([int]$p, [string]$b) {
  $listenerPid = Get-ListenerPid $p
  if ($listenerPid) {
    Write-Host "[start] Port $p already in use (PID=$listenerPid)."
    return
  }

  $python = Get-Command python -ErrorAction SilentlyContinue
  if (-not $python) {
    throw "python not found. Install Python or add it to PATH (make sure 'python --version' works)."
  }

  $args = @('-m','http.server',"$p",'--bind',"$b")
  Write-Host "[start] python $($args -join ' ')"

  Start-Process -FilePath "python" -ArgumentList $args -WorkingDirectory $RepoRoot
  Start-Sleep -Milliseconds 300

  $url = "http://$b`:$p/"
  Write-Host "[open] $url"
  Start-Process $url
}

try {
  Stop-Listener -p $Port
  Start-Server -p $Port -b $Bind
} catch {
  Write-ExceptionDetails $_
  exit 1
}

