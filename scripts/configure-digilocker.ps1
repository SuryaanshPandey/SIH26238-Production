param(
  [string]$ClientId,
  [string]$ClientSecret,
  [string]$RedirectUri = "http://localhost:3001/api/v1/government/digilocker/callback"
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$file = Join-Path $root '.env.digilocker'

if ([string]::IsNullOrWhiteSpace($ClientId)) { $ClientId = Read-Host 'DigiLocker client ID' }
if ([string]::IsNullOrWhiteSpace($ClientSecret)) {
  $secure = Read-Host 'DigiLocker client secret' -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $ClientSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
if ([string]::IsNullOrWhiteSpace($RedirectUri)) { $RedirectUri = Read-Host 'Registered redirect URI' }

@"
# Local-only DigiLocker credentials. DO NOT commit this file.
DIGILOCKER_OAUTH_CLIENT_ID=$ClientId
DIGILOCKER_OAUTH_CLIENT_SECRET=$ClientSecret
DIGILOCKER_OAUTH_REDIRECT_URI=$RedirectUri
"@ | Set-Content -Path $file -Encoding UTF8

Write-Host "Saved DigiLocker configuration to $file" -ForegroundColor Green
Write-Host 'Restart START.ps1 after configuration. The secret is not printed back.' -ForegroundColor Cyan
