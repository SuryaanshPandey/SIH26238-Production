$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$operations = Join-Path $root 'operations'
Push-Location $operations
try {
  npx.cmd prisma generate
  if ($LASTEXITCODE -ne 0) { throw "Prisma Client generation failed with exit code $LASTEXITCODE" }
  npx.cmd prisma db push
  if ($LASTEXITCODE -ne 0) { throw "Database schema sync failed with exit code $LASTEXITCODE" }
  npm.cmd run scholarship:sync
  if ($LASTEXITCODE -ne 0) { throw "Scholarship sync failed with exit code $LASTEXITCODE" }
} finally { Pop-Location }
