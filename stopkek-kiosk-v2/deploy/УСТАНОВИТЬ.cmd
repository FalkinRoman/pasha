@echo off
chcp 65001 >nul
cd /d "%~dp0"

rem --- Требуются права администратора: при необходимости перезапускаем с повышением ---
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Запрашиваю права администратора...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

rem --- Снять метку "скачано из интернета" со всех файлов бандла (иначе RemoteSigned заблокирует) ---
powershell -NoProfile -Command "Get-ChildItem -Recurse -LiteralPath '%~dp0' | Unblock-File"

rem --- Запустить пошаговый установщик (RemoteSigned, НЕ Bypass — Bypass ломает классификатор AppLocker) ---
powershell -NoProfile -ExecutionPolicy RemoteSigned -File "%~dp0install.ps1"

echo.
pause
