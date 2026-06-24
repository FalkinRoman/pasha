<#
.SYNOPSIS
  Build the agent and run the (zero-dependency) test suite. No network needed:
  the projects use the locally-installed Microsoft.AspNetCore.App shared framework,
  so nuget.org is never contacted.
  ASCII-only: Windows PowerShell 5.1 reads BOM-less .ps1 as ANSI.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$dotnet = 'C:\Program Files\dotnet\dotnet.exe'
if (-not (Test-Path $dotnet)) { throw "dotnet not found: $dotnet" }

$root  = Split-Path $PSScriptRoot -Parent
$agent = Join-Path $root 'agent\StopkekAgent.csproj'
$shell = Join-Path $root 'shell\StopkekShell.csproj'
$tests = Join-Path $root 'agent.tests\StopkekAgent.Tests.csproj'

$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
$env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE = '1'

Write-Host "== BUILD AGENT ==" -ForegroundColor Cyan
& $dotnet build $agent -c Debug --nologo
if ($LASTEXITCODE -ne 0) { Write-Error "agent build failed"; exit 1 }

Write-Host "== BUILD SHELL ==" -ForegroundColor Cyan
& $dotnet build $shell -c Debug --nologo
if ($LASTEXITCODE -ne 0) { Write-Error "shell build failed"; exit 1 }

Write-Host "== RUN TESTS ==" -ForegroundColor Cyan
& $dotnet run --project $tests -c Debug --no-launch-profile
$code = $LASTEXITCODE

Write-Host ""
if ($code -eq 0) { Write-Host "ALL GREEN" -ForegroundColor Green }
else { Write-Host "TESTS FAILED (exit $code)" -ForegroundColor Red }
exit $code
