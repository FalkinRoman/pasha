@echo off
:: StopKek Kiosk Watchdog
:: Первый запуск: перезапускает себя невидимо через PowerShell
if /i "%1" NEQ "HIDDEN" (
    powershell -WindowStyle Hidden -Command "Start-Process -FilePath '%~f0' -ArgumentList 'HIDDEN' -WindowStyle Hidden"
    exit /b 0
)

setlocal
set "KIOSK_EXE=stopkek Kiosk 0.1.0.exe"
set "KIOSK_PROC=stopkek Kiosk 0.1.0.exe"

:: ── Блокировка системных шорткатов через реестр ──────────────────────────
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v NoWinKeys /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v DisableTaskMgr /t REG_DWORD /d 1 /f >nul 2>&1

:: ── Перезапуск Explorer чтобы реестр применился ──────────────────────────
taskkill /f /im explorer.exe >nul 2>&1
timeout /t 1 /nobreak >nul
start "" explorer.exe
timeout /t 2 /nobreak >nul

:: ── Watchdog loop ─────────────────────────────────────────────────────────
:loop
    tasklist /FI "IMAGENAME eq %KIOSK_PROC%" 2>nul | find /i "%KIOSK_PROC%" >nul
    if errorlevel 1 (
        start "" "%~dp0%KIOSK_EXE%"
    )
    timeout /t 3 /nobreak >nul
goto loop
