<#
.SYNOPSIS
  Publish the shell (WPF lock screen) ready for the agent's watchdog to launch.
  No network needed - uses the locally-installed WindowsDesktop shared framework.

.NOTES
  Framework-dependent: each club PC needs the ".NET Desktop Runtime 8.0" installed
  once (https://dotnet.microsoft.com/download/dotnet/8.0). The agent needs the
  "ASP.NET Core Runtime 8.0" (see build-agent.ps1) - install both on a club PC.

.PARAMETER Output
  Output folder. Default: .\dist\shell  (exe: syshost-ui.exe)
#>
[CmdletBinding()]
param([string]$Output = "$PSScriptRoot\..\dist\shell")

$ErrorActionPreference = 'Stop'
$dotnet = 'C:\Program Files\dotnet\dotnet.exe'
if (-not (Test-Path $dotnet)) { throw "dotnet not found: $dotnet" }
$proj = Join-Path $PSScriptRoot '..\shell\StopkekShell.csproj'

Write-Host "Publishing shell -> $Output" -ForegroundColor Cyan
& $dotnet publish $proj -c Release -o $Output --nologo
if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed ($LASTEXITCODE)" }

Write-Host "Done. Shell exe: $Output\syshost-ui.exe" -ForegroundColor Green
Write-Host "Point the agent at it: set shellPath + watchdogEnabled:true in the agent's config.json." -ForegroundColor DarkGray
