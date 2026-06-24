@echo off
REM Double-click this to restore (with retries), build and test the agent.
title StopKEK agent - build and test
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-and-test.ps1"
echo.
echo ================================================================
echo Done. Scroll up for the result (look for "Passed!" or errors).
echo ================================================================
pause
