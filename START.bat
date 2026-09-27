@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0START.ps1"
if errorlevel 1 (
  echo.
  echo SIH26238 failed to start. Read the error above and the logs in .runtime\logs
  pause
)
endlocal
