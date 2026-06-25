<#
.SYNOPSIS
  One-shot Phase 0 + agent install for a fresh club PC. Run elevated.

.DESCRIPTION
  Orchestrates: create restricted account -> apply policies -> install service.
  The agent must already be published (run build-agent.ps1 first) and its
  config.json filled in (seatNumber, kioskKey, apiUrl).

.EXAMPLE
  .\setup-all.ps1 -Password 'long-random' `
                  -AgentExe 'C:\stopkek\agent\stopkek-agent.exe' `
                  -ShellExe 'C:\stopkek\shell\stopkek-shell.exe'
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Password,
    [Parameter(Mandatory = $true)][string]$AgentExe,
    [string]$ShellExe,                 # optional: also install the player-session shell task
    [string]$User = 'player'
)
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot

Write-Host "=== STEP 1/4: account + auto-logon ===" -ForegroundColor Magenta
& "$here\01-create-player-account.ps1" -User $User -Password $Password

Write-Host "=== STEP 2/4: lockdown policies ===" -ForegroundColor Magenta
Write-Warning "The player account must be logged OFF for policy application."
& "$here\02-apply-policies.ps1" -User $User

Write-Host "=== STEP 3/4: install agent task (SYSTEM) ===" -ForegroundColor Magenta
& "$here\03-install-agent-task.ps1" -ExePath $AgentExe

if ($ShellExe) {
    Write-Host "=== STEP 4/4: install shell task (player session) ===" -ForegroundColor Magenta
    & "$here\05-install-shell-task.ps1" -ShellExe $ShellExe -User $User
} else {
    Write-Host "=== STEP 4/4: shell task SKIPPED (no -ShellExe) ===" -ForegroundColor DarkYellow
    Write-Host "  Run later: .\05-install-shell-task.ps1 -ShellExe <path> -User $User"
}

Write-Host "`nAll done. Reboot to auto-logon as '$User' with the agent guarding the seat." -ForegroundColor Green
Write-Host "Don't forget AppLocker: .\04-applocker-games.ps1 -AuditOnly  (then without -AuditOnly)" -ForegroundColor DarkGray
