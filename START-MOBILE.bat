@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0START-MOBILE.ps1" %*
if errorlevel 1 (
  echo.
  echo Mobile-mode startup failed.
  pause
  exit /b 1
)
endlocal
