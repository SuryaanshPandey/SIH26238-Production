param(
  [switch]$SkipInstall,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$verification = Join-Path $root 'verification'
$operations = Join-Path $root 'operations'
$student = Join-Path $root 'student-app'
$runtime = Join-Path $root '.runtime'
$logs = Join-Path $runtime 'logs'
New-Item -ItemType Directory -Force -Path $runtime, $logs | Out-Null

function Require-Command([string]$name, [string]$hint) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "$name is required but was not found. $hint"
  }
}

function Ensure-EnvFile([string]$path, [string]$content) {
  if (-not (Test-Path $path)) {
    Set-Content -Path $path -Value $content -Encoding UTF8
  }
}

function Ensure-EnvSetting([string]$path, [string]$key, [string]$value) {
  $lines = @()
  if (Test-Path $path) { $lines = @(Get-Content -Path $path) }
  $pattern = "^" + [regex]::Escape($key) + "="
  $updated = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match $pattern) {
      $lines[$i] = "$key=$value"
      $updated = $true
      break
    }
  }
  if (-not $updated) { $lines += "$key=$value" }
  Set-Content -Path $path -Value $lines -Encoding UTF8
}


function Ensure-NpmDependencies([string]$dir) {
  if ($SkipInstall) { return }
  $needsInstall = -not (Test-Path (Join-Path $dir 'node_modules'))
  if ((Split-Path $dir -Leaf) -eq 'operations' -and -not (Test-Path (Join-Path $dir 'node_modules/aishe-institutions-list'))) {
    $needsInstall = $true
  }
  if ($needsInstall) {
    Write-Host "Installing npm dependencies in $(Split-Path $dir -Leaf)..." -ForegroundColor Yellow
    Push-Location $dir
    try { npm.cmd install --no-audit --no-fund } finally { Pop-Location }
  }
}

function Ensure-PythonDependencies {
  $venv = Join-Path $verification '.venv'
  if (-not (Test-Path $venv)) {
    Write-Host 'Creating verification Python environment...' -ForegroundColor Yellow
    python -m venv $venv
  }
  $py = Join-Path $venv 'Scripts/python.exe'
  $marker = Join-Path $runtime 'verification-deps.marker'
  if (-not $SkipInstall -and -not (Test-Path $marker)) {
    Write-Host 'Installing verification Python dependencies...' -ForegroundColor Yellow
    & $py -m pip install -r (Join-Path $verification 'requirements.txt') | Out-Host
    if ($LASTEXITCODE -ne 0) {
      throw "Python dependency installation failed with exit code $LASTEXITCODE"
    }
    Set-Content $marker -Value (Get-Date).ToUniversalTime().ToString('o')
  }
  return $py
}

Require-Command 'node' 'Install Node.js 18+.'
Require-Command 'npm' 'Install Node.js; npm is included.'
Require-Command 'python' 'Install Python 3.11+ and enable it in PATH.'

# Development configuration. Existing env files are preserved.
Ensure-EnvFile (Join-Path $verification '.env') @'
SIH_STORAGE_BACKEND=sqlite
SIH_STORAGE_PATH=./data/sih26238.db
SIH_REQUIRE_CONSENT=true
SIH_REAL_DATA_MODE=true
SIH_CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001
'@
Ensure-EnvFile (Join-Path $operations '.env') @'
PORT=3001
NODE_ENV=development
API_BASE_URL=http://localhost:3001
DATABASE_URL="file:./dev.db"
DEMO_MODE=false
REAL_DATA_MODE=true
NSP_SOURCE_URL=https://scholarships.gov.in/All-Scholarships
NSP_SOURCE_TIMEOUT_MS=8000
LOG_LEVEL=info
CONTRACT_VERSION=v1
JWT_SECRET=demo-secret-key-change-in-production-min-32-chars
VERIFICATION_PROVIDER=http
DOCUMENT_PROVIDER=http
VERIFICATION_SERVICE_URL=http://127.0.0.1:8000
VERIFICATION_SERVICE_API_KEY=
DOCUMENT_SERVICE_URL=http://127.0.0.1:8000
STUDENT_APP_ORIGIN=http://localhost:3000
GOVERNMENT_BRIDGE_API_KEY=
NSP_SYNC_TTL_MS=900000
NSP_FAILURE_RETRY_MS=60000
'@
Ensure-EnvFile (Join-Path $student '.env.local') @'
NEXT_PUBLIC_USE_LIVE_BACKEND=true
NEXT_PUBLIC_RIJVAN_API_URL=http://127.0.0.1:3001/api/v1
NEXT_PUBLIC_VERIFICATION_API_URL=http://127.0.0.1:8000
'@

# Never leave the known example JWT secret enabled in a real-data deployment.
$opsEnv = Join-Path $operations '.env'
$opsEnvLines = @(Get-Content -Path $opsEnv)
$jwtIndex = -1
for ($i = 0; $i -lt $opsEnvLines.Count; $i++) {
  if ($opsEnvLines[$i] -match '^JWT_SECRET=') { $jwtIndex = $i; break }
}
if ($jwtIndex -lt 0 -or $opsEnvLines[$jwtIndex] -match '^JWT_SECRET=demo-secret-key-change-in-production-min-32-chars$' -or [string]::IsNullOrWhiteSpace(($opsEnvLines[$jwtIndex] -replace '^JWT_SECRET=', ''))) {
  $bytes = New-Object byte[] 48
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  $line = "JWT_SECRET=$([Convert]::ToBase64String($bytes))"
  if ($jwtIndex -lt 0) { $opsEnvLines += $line } else { $opsEnvLines[$jwtIndex] = $line }
}
Set-Content -Path $opsEnv -Value $opsEnvLines -Encoding UTF8

# Generate a private server-to-server key for the local government-source bridge.
$bridgeKey = $null
$opsEnvLines = @(Get-Content -Path $opsEnv)
$bridgeIndex = -1
for ($i = 0; $i -lt $opsEnvLines.Count; $i++) {
  if ($opsEnvLines[$i] -match '^GOVERNMENT_BRIDGE_API_KEY=') { $bridgeIndex = $i; break }
}
if ($bridgeIndex -ge 0) { $bridgeKey = ($opsEnvLines[$bridgeIndex] -replace '^GOVERNMENT_BRIDGE_API_KEY=', '').Trim() }
if ([string]::IsNullOrWhiteSpace($bridgeKey)) {
  $bytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  $bridgeKey = [Convert]::ToBase64String($bytes)
  $bridgeLine = "GOVERNMENT_BRIDGE_API_KEY=$bridgeKey"
  if ($bridgeIndex -lt 0) { $opsEnvLines += $bridgeLine } else { $opsEnvLines[$bridgeIndex] = $bridgeLine }
  Set-Content -Path $opsEnv -Value $opsEnvLines -Encoding UTF8
}

# Real-mode invariants: preserve custom source endpoints/credentials, but never let stale env files re-enable demo/mock runtime behavior.
Ensure-EnvSetting (Join-Path $verification '.env') 'SIH_REAL_DATA_MODE' 'true'
Ensure-EnvSetting (Join-Path $verification '.env') 'SIH_REQUIRE_CONSENT' 'true'
Ensure-EnvSetting (Join-Path $verification '.env') 'SIH_DOCUMENT_STORAGE_PATH' './data/documents'
Ensure-EnvSetting (Join-Path $operations '.env') 'DEMO_MODE' 'false'
Ensure-EnvSetting (Join-Path $operations '.env') 'REAL_DATA_MODE' 'true'
Ensure-EnvSetting (Join-Path $operations '.env') 'NSP_SOURCE_TIMEOUT_MS' '8000'
Ensure-EnvSetting (Join-Path $operations '.env') 'NSP_FAILURE_RETRY_MS' '60000'
Ensure-EnvSetting (Join-Path $operations '.env') 'SCHOLARSHIP_ACADEMIC_YEAR' '2026-2027'
Ensure-EnvSetting (Join-Path $operations '.env') 'SCHOLARSHIP_SOURCE_TIMEOUT_MS' '9000'
Ensure-EnvSetting (Join-Path $operations '.env') 'SCHOLARSHIP_DETAIL_TIMEOUT_MS' '6500'
Ensure-EnvSetting (Join-Path $operations '.env') 'SCHOLARSHIP_SOURCE_RETRIES' '2'
Ensure-EnvSetting (Join-Path $operations '.env') 'SCHOLARSHIP_MAX_DETAIL_PAGES' '80'
Ensure-EnvSetting (Join-Path $operations '.env') 'NSP_MAX_DETAIL_PAGES' '100'
Ensure-EnvSetting (Join-Path $operations '.env') 'AICTE_SOURCE_URL' 'https://www.aicte-india.org/schemes'
Ensure-EnvSetting (Join-Path $operations '.env') 'AICTE_SOURCE_ENABLED' 'true'
Ensure-EnvSetting (Join-Path $operations '.env') 'SCHOLARSHIP_MAX_GENERIC_DETAIL_PAGES' '20'
Ensure-EnvSetting (Join-Path $operations '.env') 'MYSCHEME_MAX_DETAIL_PAGES' '80'
Ensure-EnvSetting (Join-Path $operations '.env') 'MYSCHEME_SITEMAP_URL' 'https://www.myscheme.gov.in/sitemap.xml'
Ensure-EnvSetting (Join-Path $operations '.env') 'GOVERNMENT_BRIDGE_API_KEY' $bridgeKey
Ensure-EnvSetting (Join-Path $operations '.env') 'DIGILOCKER_OAUTH_AUTHORIZE_URL' 'https://digilocker.meripehchaan.gov.in/public/oauth2/1/authorize'
Ensure-EnvSetting (Join-Path $operations '.env') 'DIGILOCKER_OAUTH_TOKEN_URL' 'https://digilocker.meripehchaan.gov.in/public/oauth2/1/token'
Ensure-EnvSetting (Join-Path $operations '.env') 'DIGILOCKER_USER_URL' 'https://digilocker.meripehchaan.gov.in/public/oauth2/1/user'
Ensure-EnvSetting (Join-Path $operations '.env') 'DIGILOCKER_ISSUED_DOCUMENTS_URL' 'https://digilocker.meripehchaan.gov.in/public/oauth2/2/files/issued'
Ensure-EnvSetting (Join-Path $operations '.env') 'DIGILOCKER_FETCH_TIMEOUT_MS' '15000'
Ensure-EnvSetting (Join-Path $operations '.env') 'JAGO_HISTORY_TIMEOUT_MS' '350'
Ensure-EnvSetting (Join-Path $operations '.env') 'JAGO_CONTEXT_TIMEOUT_MS' '3500'
Ensure-EnvSetting (Join-Path $operations '.env') 'JAGO_RESPONSE_TIMEOUT_MS' '7000'

# Optional dedicated DigiLocker credential file. Never commit this file.
# The file may live at the project root as .env.digilocker, or credentials may
# already be present in operations/.env / the current PowerShell environment.
$digilockerCredentialFile = Join-Path $root '.env.digilocker'
if (Test-Path $digilockerCredentialFile) {
  $credentialLines = @(Get-Content -Path $digilockerCredentialFile)
  foreach ($line in $credentialLines) {
    $trimmed = ([string]$line).Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#') -or $trimmed -notmatch '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { continue }
    $key = $Matches[1]
    $value = $Matches[2]
    if ($key -in @('DIGILOCKER_OAUTH_CLIENT_ID','DIGILOCKER_OAUTH_CLIENT_SECRET','DIGILOCKER_OAUTH_REDIRECT_URI')) {
      Ensure-EnvSetting (Join-Path $operations '.env') $key $value
    }
  }
}

# Also accept credentials supplied to START.ps1 through environment variables.
foreach ($key in @('DIGILOCKER_OAUTH_CLIENT_ID','DIGILOCKER_OAUTH_CLIENT_SECRET','DIGILOCKER_OAUTH_REDIRECT_URI')) {
  $runtimeValue = [Environment]::GetEnvironmentVariable($key)
  if (-not [string]::IsNullOrWhiteSpace($runtimeValue)) {
    Ensure-EnvSetting (Join-Path $operations '.env') $key $runtimeValue
  }
}

# By default, route DigiLocker verification through the local authenticated bridge that
# performs the official OAuth-backed lookup. A custom configured endpoint is preserved.
$verificationEnv = Join-Path $verification '.env'
$verificationLines = @(Get-Content -Path $verificationEnv)
$digilockerBase = ''
for ($i = 0; $i -lt $verificationLines.Count; $i++) {
  if ($verificationLines[$i] -match '^SIH_SOURCE_DIGILOCKER_BASE_URL=(.*)$') { $digilockerBase = $Matches[1].Trim(); break }
}
if ([string]::IsNullOrWhiteSpace($digilockerBase)) {
  Ensure-EnvSetting $verificationEnv 'SIH_SOURCE_DIGILOCKER_BASE_URL' 'http://127.0.0.1:3001/api/v1/government/digilocker/source-record'
  Ensure-EnvSetting $verificationEnv 'SIH_SOURCE_DIGILOCKER_API_KEY' $bridgeKey
}
Ensure-EnvSetting (Join-Path $operations '.env') 'VERIFICATION_PROVIDER' 'http'
Ensure-EnvSetting (Join-Path $operations '.env') 'DOCUMENT_PROVIDER' 'http'
Ensure-EnvSetting (Join-Path $student '.env.local') 'NEXT_PUBLIC_USE_LIVE_BACKEND' 'true'

Ensure-NpmDependencies $operations
Ensure-NpmDependencies $student
$py = Ensure-PythonDependencies

Write-Host 'Preparing Rijvan database...' -ForegroundColor Cyan
Push-Location $operations
try {
  npx.cmd prisma generate
  if ($LASTEXITCODE -ne 0) { throw "Prisma Client generation failed with exit code $LASTEXITCODE" }
  npx.cmd prisma db push
  if ($LASTEXITCODE -ne 0) { throw "Prisma database schema sync failed with exit code $LASTEXITCODE" }
  npm.cmd run prepare:real
  if ($LASTEXITCODE -ne 0) { throw "Real-mode preparation failed with exit code $LASTEXITCODE" }
} finally { Pop-Location }

Write-Host 'Verification service configured for official connectors. Unconfigured providers return NOT_CONFIGURED/SOURCE_UNAVAILABLE and never fall back to synthetic records.' -ForegroundColor Cyan
$env:SIH_REAL_DATA_MODE = 'true'
$env:DEMO_MODE = 'false'
$env:REAL_DATA_MODE = 'true'

# Clear old PID file; processes from an earlier launch are handled by STOP.ps1.
$pidFile = Join-Path $runtime 'pids.json'
Remove-Item $pidFile -Force -ErrorAction SilentlyContinue

function Stop-StaleSihPortProcess([int]$port) {
  try {
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
    foreach ($listener in $listeners) {
      $procId = [int]$listener.OwningProcess
      try {
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $procId" -ErrorAction Stop
        $cmd = [string]$proc.CommandLine
        # Only reclaim ports from another SIH26238 process. Never kill an unrelated
        # application simply because it happens to use 3000/3001/8000.
        if ($cmd -match 'SIH26238-Final-Product' -or $cmd -match 'SIH26238') {
          Write-Host "Stopping stale SIH26238 process $procId on port $port" -ForegroundColor Yellow
          Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
          Start-Sleep -Milliseconds 500
        } else {
          throw "Port $port is already occupied by PID $procId, which is not identifiable as an SIH26238 process. Stop that application first."
        }
      } catch {
        if ($_.Exception.Message -like 'Port * is already occupied*') { throw }
        # If process inspection is unavailable, fail safely rather than killing an
        # unrelated listener.
        throw "Cannot safely reclaim port $port (PID $procId): $($_.Exception.Message)"
      }
    }
  } catch {
    if ($_.Exception.Message -like 'Port * is already occupied*' -or $_.Exception.Message -like 'Cannot safely reclaim port*') { throw }
  }
}

foreach ($port in @(8000,3001,3000)) {
  Stop-StaleSihPortProcess $port
}

function Start-ServiceProcess([string]$name, [string]$dir, [string]$command) {
  $log = Join-Path $logs "$name.log"
  Remove-Item $log -Force -ErrorAction SilentlyContinue
  $psCommand = "Set-Location -LiteralPath '$dir'; $command 2>&1 | Tee-Object -FilePath '$log'"
  $proc = Start-Process -FilePath 'powershell.exe' -WorkingDirectory $dir -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-Command',$psCommand) -PassThru
  return @{ name=$name; pid=$proc.Id; log=$log }
}

$processes = @()
$processes += Start-ServiceProcess 'verification' $verification "& '$py' -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
$processes += Start-ServiceProcess 'operations' $operations 'npm.cmd run dev -- -p 3001'
$processes += Start-ServiceProcess 'student-app' $student 'npm.cmd run dev -- -p 3000'
$processes | ConvertTo-Json | Set-Content $pidFile -Encoding UTF8

function Wait-Http([string]$url, [int]$timeoutSec = 60) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  do {
    try {
      $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 4
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { return $true }
    } catch { Start-Sleep -Seconds 2 }
  } while ((Get-Date) -lt $deadline)
  return $false
}

Write-Host 'Waiting for services...' -ForegroundColor Cyan
$checks = @(
  @{name='Verification'; url='http://127.0.0.1:8000/health'},
  @{name='Operations'; url='http://127.0.0.1:3001/api/v1/health'},
  @{name='Student App'; url='http://127.0.0.1:3000/' }
)
foreach ($check in $checks) {
  if (-not (Wait-Http $check.url)) {
    Write-Host "$($check.name) did not become ready. Check its log in $logs" -ForegroundColor Red
    $serviceKey = $check.name.ToLower().Replace(' ', '-')
    $serviceLog = Join-Path $logs "$serviceKey.log"
    if (Test-Path $serviceLog) {
      Write-Host "--- Last Operations/Service log lines ---" -ForegroundColor DarkYellow
      Get-Content $serviceLog -Tail 80 | Write-Host
      Write-Host "--- End log ---" -ForegroundColor DarkYellow
    }
    throw "Service startup failed: $($check.name)"
  }
  Write-Host "  $($check.name) READY" -ForegroundColor Green
}

Write-Host ''
Write-Host 'SIH26238 is running.' -ForegroundColor Green
Write-Host 'Student App : http://localhost:3000' -ForegroundColor White
Write-Host 'Operations  : http://localhost:3001' -ForegroundColor White
Write-Host 'Verification: http://localhost:8000/docs' -ForegroundColor White
Write-Host 'Investigator: http://localhost:8000/investigation' -ForegroundColor White
Write-Host ''
Write-Host 'Run CHECK.bat for an end-to-end health check.' -ForegroundColor Cyan
Write-Host 'Run STOP.bat to stop the integrated services.' -ForegroundColor Cyan

if (-not $NoBrowser) {
  Start-Process 'http://localhost:3000'
}
