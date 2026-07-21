@echo off
REM Seat 1 one-click fix: grant player write on Policies keys, then deploy the new overlay binary.
REM Just double-click. It asks for administrator rights (UAC) once.

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Requesting administrator rights...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

cd /d "%~dp0"
echo ==================================================
echo  STEP 1/2: grant player write on the Policies keys
echo ==================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0fix-policy-acl-seat1.ps1" -Elevated
echo.
echo ==================================================
echo  STEP 2/2: deploy the new overlay (explorer refresh)
echo ==================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-seat1-shell.ps1" -Elevated
echo.
echo ==================================================
echo  DONE.  Now REBOOT this PC, then test under player.
echo ==================================================
pause