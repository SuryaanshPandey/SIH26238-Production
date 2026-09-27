$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Write-Host "Use three terminals for transparent logs:" -ForegroundColor Cyan
Write-Host "1) cd '$root\verification'; `$env:SIH_STORAGE_BACKEND='sqlite'; uvicorn app.main:app --host 127.0.0.1 --port 8000"
Write-Host "2) cd '$root\operations'; `$env:VERIFICATION_PROVIDER='http'; `$env:DOCUMENT_PROVIDER='http'; `$env:VERIFICATION_SERVICE_URL='http://127.0.0.1:8000'; `$env:DOCUMENT_SERVICE_URL='http://127.0.0.1:8000'; npm run dev -- -p 3001"
Write-Host "3) cd '$root\student-app'; copy .env.example .env.local; set NEXT_PUBLIC_USE_LIVE_BACKEND=true; npm run dev -- -p 3000"
