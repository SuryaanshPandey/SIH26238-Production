$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host '=== SIH26238 final product validation ===' -ForegroundColor Cyan
& (Join-Path $root 'CHECK.ps1')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host 'PASS: core service health.' -ForegroundColor Green
Write-Host 'For UI validation, open http://localhost:3000 and exercise Dashboard -> Scholarships -> Applications -> Documents -> Verification -> JAGO.' -ForegroundColor White
Write-Host 'Operations console: http://localhost:3001' -ForegroundColor White
Write-Host 'Verification API: http://localhost:8000/docs' -ForegroundColor White
