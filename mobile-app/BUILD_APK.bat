@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0BUILD_APK.ps1" %*
if errorlevel 1 (
  echo.
  echo SIH26238 APK build failed.
  pause
  exit /b 1
)
endlocal
