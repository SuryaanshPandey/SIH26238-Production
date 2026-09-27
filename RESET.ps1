$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $root 'STOP.ps1')
Remove-Item (Join-Path $root '.runtime') -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $root 'verification/.venv') -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $root 'verification/data/sih26238.db') -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $root 'operations/dev.db') -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $root 'operations/dev.db-journal') -Force -ErrorAction SilentlyContinue
Write-Host 'Runtime data and local environments reset. Run START.bat for a fresh demo.' -ForegroundColor Green
