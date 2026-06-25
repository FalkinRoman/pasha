<#
.SYNOPSIS
  Phase 2 / install - run the shell (lock-screen UI) in the PLAYER's interactive
  session at logon, so the overlay actually renders on screen.

.DESCRIPTION
  Why a separate task: the agent runs as SYSTEM (Session 0) and cannot draw a window
  in the player's desktop session (Session 0 isolation). So the SHELL is launched by a
  logon-triggered scheduled task running AS THE PLAYER, limited rights. It connects to
  the SYSTEM agent over a named pipe and renders LOCKED/ACTIVE/GRACE.

  Roles, combined:
    - agent  (SYSTEM, AtStartup task, 03-install-agent-task.ps1) - the gate + telemetry,
      unkillable by the player; LockWorkstation failsafe if the shell vanishes.
    - shell  (player, AtLogOn task, THIS script) - the visible overlay; restarted at every
      logon, and the SYSTEM watchdog flags a tamper event if it dies mid-session.

  Run elevated. The player account must already exist (01-create-player-account.ps1).

.PARAMETER ShellExe
  Full path to stopkek-shell.exe (published shell). Required.

.PARAMETER User
  Player account the shell runs as. Default: stopkek-player

.PARAMETER TaskName
  Default: StopkekShell
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ShellExe,
    [string]$User = 'player',
    [string]$TaskName = 'StopkekShell'
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

if (-not (Test-Path $ShellExe)) { throw "Shell exe not found: $ShellExe" }
$ShellExe = (Resolve-Path $ShellExe).Path

if (-not (Get-LocalUser -Name $User -ErrorAction SilentlyContinue)) {
    throw "Player account '$User' not found. Run 01-create-player-account.ps1 first."
}

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Write-Host "Task '$TaskName' exists - replacing." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

$action  = New-ScheduledTaskAction -Execute $ShellExe
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $User
# Run as the player, in their interactive session (so the window is visible).
$principal = New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive -RunLevel Limited
$settings  = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartInterval (New-TimeSpan -Minutes 1) -RestartCount 999 `
    -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
    -Principal $principal -Settings $settings `
    -Description 'StopKEK lock-screen UI, runs in the player session.' -Force | Out-Null

Write-Host "Shell logon task installed for '$User'." -ForegroundColor Green
Write-Host "It launches at the player's next logon. Also set the agent config.json:" -ForegroundColor DarkGray
Write-Host "  shellPath = $ShellExe ; watchdogEnabled = true   (SYSTEM-side backup/relaunch)" -ForegroundColor DarkGray
