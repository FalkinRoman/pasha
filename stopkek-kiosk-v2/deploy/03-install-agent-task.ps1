<#
.SYNOPSIS
  Phase 0 / step 3 - register stopkek-agent as a SYSTEM scheduled task that starts
  at boot and self-restarts on failure.

.DESCRIPTION
  We run the agent as a SYSTEM scheduled task (not a Windows service) so the build
  needs zero NuGet packages. For our threat model this is equally unkillable: a
  standard user cannot stop or delete a SYSTEM task, and Task Scheduler restarts it
  if it ever exits. Run elevated.

.PARAMETER ExePath
  Full path to stopkek-agent.exe (published agent). Required.

.PARAMETER TaskName
  Default: StopkekAgent
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ExePath,
    [string]$TaskName = 'StopkekAgent'
)

$ErrorActionPreference = 'Stop'

function Assert-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Run this script as Administrator.'
    }
}
Assert-Admin

if (-not (Test-Path $ExePath)) { throw "Agent exe not found: $ExePath" }
$ExePath = (Resolve-Path $ExePath).Path

$cfg = Join-Path (Split-Path $ExePath) 'config.json'
if (-not (Test-Path $cfg)) {
    Write-Warning "config.json not found next to the exe ($cfg). The agent will exit until it exists."
}

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Write-Host "Task '$TaskName' exists - replacing." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

$action    = New-ScheduledTaskAction -Execute $ExePath
$trigger   = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'S-1-5-18' -RunLevel Highest  # LocalSystem
$settings  = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartInterval (New-TimeSpan -Minutes 1) -RestartCount 3 `
    -MultipleInstances IgnoreNew -Hidden

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
    -Principal $principal -Settings $settings `
    -Description 'StopKEK club PC guard: locks/unlocks the seat against the server.' -Force | Out-Null

Write-Host "Starting task." -ForegroundColor Cyan
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 2
Get-ScheduledTask -TaskName $TaskName | Select-Object TaskName, State

Write-Host "Agent task installed. Log: %ProgramData%\StopKEK\agent.log" -ForegroundColor Green
