@echo off
:: StopKek Kiosk Watchdog
setlocal

set "KIOSK_EXE=stopkek Kiosk 0.1.0.exe"
set "KIOSK_PROC=stopkek Kiosk 0.1.0.exe"
set "DIR=%~dp0"

:: ── Блокировка системных шорткатов через реестр (работает немедленно) ────
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v DisableTaskMgr /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v NoWinKeys /t REG_DWORD /d 1 /f >nul 2>&1

:: ── Перезапуск Explorer чтобы NoWinKeys применился ───────────────────────
taskkill /f /im explorer.exe >nul 2>&1
timeout /t 1 /nobreak >nul
start "" explorer.exe
timeout /t 2 /nobreak >nul

:: ── Watchdog loop ─────────────────────────────────────────────────────────
:loop
    tasklist /FI "IMAGENAME eq %KIOSK_PROC%" 2>nul | find /i "%KIOSK_PROC%" >nul
    if errorlevel 1 (
        start "" "%DIR%%KIOSK_EXE%"
    )
    timeout /t 3 /nobreak >nul
goto loop
