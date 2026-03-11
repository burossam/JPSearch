param(
  [int]$Port = 8000,
  [string]$Bind = "127.0.0.1"
)

$ErrorActionPreference = 'Stop'

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
  $args = @('-m','http.server',"$Port",'--bind',"$Bind")
  Write-Host "Starting: python $($args -join ' ')"
  Start-Process -FilePath "python" -ArgumentList $args -WorkingDirectory $RepoRoot
}

$url = "http://$Bind`:$Port/"
Write-Host "Opening: $url"
Start-Process $url
