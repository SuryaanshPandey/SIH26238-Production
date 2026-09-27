param(
  [Parameter(Mandatory=$true, Position=0)]
  [string]$HostIp
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$verification = Join-Path $root 'verification'
$operations = Join-Path $root 'operations'
$student = Join-Path $root 'student-app'

function Set-EnvValue([string]$path, [string]$key, [string]$value) {
  $lines = @(if (Test-Path $path) { Get-Content $path } else { @() })
  $pattern = '^' + [regex]::Escape($key) + '='
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

$origin = "http://$HostIp`:3000"
$verificationPython = Join-Path $verification '.venv\Scripts\python.exe'
if (-not (Test-Path $verificationPython)) {
  $verificationPython = 'python'
}

Set-EnvValue (Join-Path $operations '.env') 'STUDENT_APP_ORIGIN' $origin
Set-EnvValue (Join-Path $verification '.env') 'SIH_CORS_ORIGINS' "$origin,http://localhost:3000,http://127.0.0.1:3000"

Write-Host "Starting SIH26238 on LAN host $HostIp" -ForegroundColor Cyan
Start-Process powershell.exe -WorkingDirectory $verification -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-Command',"& '$verificationPython' -m uvicorn app.main:app --host 0.0.0.0 --port 8000")
Start-Process powershell.exe -WorkingDirectory $operations -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-Command','npm.cmd run dev -- -H 0.0.0.0 -p 3001')
Start-Process powershell.exe -WorkingDirectory $student -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-Command','npm.cmd run dev -- -H 0.0.0.0 -p 3000')
Start-Sleep -Seconds 4
Start-Process $origin
