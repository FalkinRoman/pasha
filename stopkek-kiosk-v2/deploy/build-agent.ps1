<#
.SYNOPSIS
  Publish the agent (framework-dependent) ready to install as a SYSTEM task.
  No network needed - uses the local AspNetCore shared framework.

.NOTES
  Framework-dependent: each club PC needs the "ASP.NET Core Runtime 8.0" installed
  once (https://dotnet.microsoft.com/download/dotnet/8.0). Self-contained publish is
  avoided because it would require downloading runtime packs from nuget.org.

.PARAMETER Output
  Output folder. Default: .\dist\agent
#>
[CmdletBinding()]
param([string]$Output = "$PSScriptRoot\..\dist\agent")

$ErrorActionPreference = 'Stop'
$dotnet = 'C:\Program Files\dotnet\dotnet.exe'
if (-not (Test-Path $dotnet)) { throw "dotnet not found: $dotnet" }
$proj = Join-Path $PSScriptRoot '..\agent\StopkekAgent.csproj'

Write-Host "Publishing agent -> $Output" -ForegroundColor Cyan
& $dotnet publish $proj -c Release -o $Output --nologo
if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed ($LASTEXITCODE)" }

Write-Host "Done. Edit $Output\config.json (seatNumber, kioskKey, apiUrl) before installing." -ForegroundColor Green
