param(
  [Parameter(Mandatory=$false)] [string]$StudentAppUrl = "http://10.0.2.2:3000",
  [Parameter(Mandatory=$false)] [string]$MobileOpsUrl = "",
  [Parameter(Mandatory=$false)] [string]$MobileVerificationUrl = "",
  [Parameter(Mandatory=$false)] [switch]$AllowCleartext,
  [Parameter(Mandatory=$false)] [string]$SdkRoot = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$android = Join-Path $root "android"

if ($SdkRoot) {
  $env:ANDROID_HOME = $SdkRoot
  $env:ANDROID_SDK_ROOT = $SdkRoot
}
if (-not $env:ANDROID_HOME -and $env:ANDROID_SDK_ROOT) { $env:ANDROID_HOME = $env:ANDROID_SDK_ROOT }
if (-not $env:ANDROID_HOME) {
  $candidate = Join-Path $env:LOCALAPPDATA "Android\Sdk"
  if (Test-Path $candidate) { $env:ANDROID_HOME = $candidate }
}
if (-not $env:ANDROID_HOME -or -not (Test-Path $env:ANDROID_HOME)) {
  throw "Android SDK not found. Install Android Studio/SDK and set ANDROID_HOME, or pass -SdkRoot <path>."
}

$gradle = Get-Command gradle -ErrorAction SilentlyContinue
if (-not $gradle) {
  throw "Gradle 9.6.0 was not found. Open mobile-app/android in Android Studio once or install Gradle 9.6.0 and add it to PATH."
}

$cleartext = $AllowCleartext.IsPresent
Write-Host "Building SIH26238 Android app" -ForegroundColor Cyan
Write-Host "Student App URL: $StudentAppUrl"
Write-Host "Operations runtime override: $MobileOpsUrl"
Write-Host "Verification runtime override: $MobileVerificationUrl"
Write-Host "Cleartext HTTP: $cleartext"

Push-Location $android
try {
  & $gradle.Source :app:assembleRelease `
    "-PstudentAppUrl=$StudentAppUrl" `
    "-PmobileOpsUrl=$MobileOpsUrl" `
    "-PmobileVerificationUrl=$MobileVerificationUrl" `
    "-PallowCleartext=$cleartext"
  if ($LASTEXITCODE -ne 0) { throw "Gradle build failed with exit code $LASTEXITCODE" }
} finally {
  Pop-Location
}

$apk = Join-Path $android "app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $apk)) { throw "Build finished but APK was not found at $apk" }
$dist = Join-Path $root "dist"
New-Item -ItemType Directory -Force -Path $dist | Out-Null
$final = Join-Path $dist "SIH26238-v25.apk"
Copy-Item $apk $final -Force
Write-Host "APK created: $final" -ForegroundColor Green
