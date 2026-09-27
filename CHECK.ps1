$ErrorActionPreference = 'Continue'
$checks = @(
  @{name='Verification health'; url='http://127.0.0.1:8000/health'},
  @{name='Verification connector registry'; url='http://127.0.0.1:8000/connectors'},
  @{name='Operations service health'; url='http://127.0.0.1:3001/api/v1/health'},
  @{name='Official NSP scholarship catalogue'; url='http://127.0.0.1:3001/api/v1/scholarships'},
  @{name='Student login page'; url='http://127.0.0.1:3000/login'}
)
$failed = 0
foreach ($check in $checks) {
  try {
    $r = Invoke-WebRequest -Uri $check.url -UseBasicParsing -TimeoutSec 15
    if ($r.StatusCode -lt 400) { Write-Host "[PASS] $($check.name) ($($r.StatusCode))" -ForegroundColor Green }
    else { Write-Host "[FAIL] $($check.name) ($($r.StatusCode))" -ForegroundColor Red; $failed++ }
  } catch {
    Write-Host "[FAIL] $($check.name)" -ForegroundColor Red
    Write-Host "       $($_.Exception.Message)" -ForegroundColor DarkRed
    $failed++
  }
}

try {
  $scholarshipResponse = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/v1/scholarships' -Method GET -TimeoutSec 15
  $items = @($scholarshipResponse.data)
  $liveCount = @($items | Where-Object { $_.source_system -eq 'NSP' }).Count
  $snapshotCount = @($items | Where-Object { $_.source_system -eq 'NSP_SNAPSHOT' }).Count
  if ($liveCount -gt 0) {
    Write-Host "[PASS] NSP live catalogue available ($liveCount live record(s))" -ForegroundColor Green
  } elseif ($snapshotCount -gt 0) {
    Write-Host "[PASS] Official NSP snapshot fallback available ($snapshotCount snapshot record(s))" -ForegroundColor Green
  } else {
    Write-Host '[FAIL] NSP response contained neither live nor official snapshot records.' -ForegroundColor Red
    $failed++
  }
} catch {
  Write-Host '[FAIL] NSP response validation' -ForegroundColor Red
  Write-Host "       $($_.Exception.Message)" -ForegroundColor DarkRed
  $failed++
}

Write-Host ''
if ($failed -eq 0) { Write-Host 'Integrated real-data health check PASSED.' -ForegroundColor Green; exit 0 }
Write-Host "Integrated real-data health check FAILED: $failed check(s)." -ForegroundColor Red
exit 1
