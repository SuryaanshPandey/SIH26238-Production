param(
  [Parameter(Mandatory=$true)] [string]$StudentAppUrl,
  [Parameter(Mandatory=$true)] [string]$MobileOpsUrl,
  [Parameter(Mandatory=$true)] [string]$MobileVerificationUrl,
  [Parameter(Mandatory=$false)] [string]$GradleHome = "C:\Gradle\gradle-9.6.0"
)

$ErrorActionPreference = "Stop"

foreach ($url in @($StudentAppUrl, $MobileOpsUrl, $MobileVerificationUrl)) {
  if ($url -notmatch '^https://') {
    throw "Production APK URLs must use HTTPS: $url"
  }
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$android = Join-Path $root "android"
$gradleBat = Join-Path $GradleHome "bin\gradle.bat"

if (-not (Test-Path $gradleBat)) {
  throw "Gradle 9.6.0 not found at $gradleBat"
}

Push-Location $android
try {
  & $gradleBat clean :app:assembleRelease `
    "-PstudentAppUrl=$StudentAppUrl" `
    "-PmobileOpsUrl=$MobileOpsUrl" `
    "-PmobileVerificationUrl=$MobileVerificationUrl" `
    "-PallowCleartext=false"

  if ($LASTEXITCODE -ne 0) {
    throw "Release APK build failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}

$apk = Join-Path $android "app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $apk)) {
  throw "Build finished but APK was not found at $apk"
}

$dist = Join-Path $root "dist"
New-Item -ItemType Directory -Force -Path $dist | Out-Null
$final = Join-Path $dist "SIH26238-v25-production.apk"
Copy-Item $apk $final -Force

Write-Host "Production APK created:" -ForegroundColor Green
Write-Host $final -ForegroundColor Green
