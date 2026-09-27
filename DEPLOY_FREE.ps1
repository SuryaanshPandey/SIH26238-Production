param(
  [string]$WorkspaceId = "tea-d62c7hkoud1c739f108g"
)

$ErrorActionPreference = "Stop"

Write-Host "SIH26238 v25 - Free Deployment Preflight" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if (-not (Get-Command render -ErrorAction SilentlyContinue)) {
  throw "Render CLI is not installed. Install it with: winget install render.cli"
}

render workspace set $WorkspaceId
render blueprints validate .\render.yaml

Write-Host ""
Write-Host "Blueprint validation passed." -ForegroundColor Green
Write-Host "Next: create a Render Blueprint from this repository and use the default render.yaml." -ForegroundColor Yellow
Write-Host "You will supply only these server-side secrets in Render:" -ForegroundColor Yellow
Write-Host "  Operations: DATABASE_URL" -ForegroundColor Yellow
Write-Host "  Verification: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor Yellow
