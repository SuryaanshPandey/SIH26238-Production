$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $root '.runtime\pids.json'
if (Test-Path $pidFile) {
  $items = Get-Content $pidFile -Raw | ConvertFrom-Json
  foreach ($item in @($items)) {
    if ($item.pid) { Stop-Process -Id ([int]$item.pid) -Force -ErrorAction SilentlyContinue }
  }
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}
# Kill only processes launched from this product tree; do not touch unrelated node/python processes.
Get-CimInstance Win32_Process | ForEach-Object {
  $cmd = $_.CommandLine
  if ($cmd -and (($cmd -like "*$root*verification*uvicorn*") -or ($cmd -like "*$root*operations*npm.cmd run dev*") -or ($cmd -like "*$root*student-app*npm.cmd run dev*"))) {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
}
Write-Host 'SIH26238 services stopped.' -ForegroundColor Green
