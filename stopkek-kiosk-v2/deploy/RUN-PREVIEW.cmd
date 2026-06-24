@echo off
REM Double-click to preview the lock screen safely (windowed-fullscreen, Esc to close,
REM no keyboard hook). Builds the shell first if needed.
title StopKEK shell preview
set DOTNET=C:\Program Files\dotnet\dotnet.exe
"%DOTNET%" run --project "%~dp0..\shell\StopkekShell.csproj" -c Debug --no-launch-profile -- --preview
