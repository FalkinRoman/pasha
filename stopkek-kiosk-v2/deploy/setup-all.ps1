<#
.SYNOPSIS
  One-shot Phase 0 + agent install for a fresh club PC. Run elevated.

.DESCRIPTION
  Orchestrates: create restricted account -> apply policies -> install service.
  The agent must already be published (run build-agent.ps1 first) and its
  config.json filled in (seatNumber, kioskKey, apiUrl).

.EXAMPLE
  .\setup-all.ps1 -Password 'long-random' `
                  -AgentExe 'C:\SysHost\agent\syshost-svc.exe' `
                  -ShellExe 'C:\SysHost\shell\syshost-ui.exe'
#>
[CmdletBinding()]
param(
    [string]$Password,                 # omit for a passwordless one-click 'player' account
    [Parameter(Mandatory = $true)][string]$AgentExe,
    [string]$ShellExe,                 # optional: also install the player-session shell task
    [switch]$NoAutoLogon,              # show the login screen with account tiles instead of auto-logon
    [string]$User = 'player'
)
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot

Write-Host "=== STEP 1/4: account ===" -ForegroundColor Magenta
$acct = @{ User = $User }
if ($Password)    { $acct.Password = $Password }
if ($NoAutoLogon) { $acct.NoAutoLogon = $true }
& "$here\01-create-player-account.ps1" @acct

Write-Host "=== STEP 2/4: lockdown policies ===" -ForegroundColor Magenta
Write-Warning "The player account must be logged OFF for policy application."
# The club wallpaper sits in the install root (<root>\wallpaper.jpg), which is the agent's
# grandparent dir — pass it explicitly so a non-default -Target still gets the wallpaper.
$wallpaper = Join-Path (Split-Path (Split-Path $AgentExe -Parent) -Parent) 'wallpaper.jpg'
& "$here\02-apply-policies.ps1" -User $User -WallpaperPath $wallpaper

Write-Host "=== STEP 2b/4: silent admin (player + UAC no-prompt) ===" -ForegroundColor Magenta
# Player becomes a local admin and UAC is set to elevate without prompting, so ANY
# program (installer / launcher / anti-cheat) runs elevated with no password.
& "$here\09-enable-silent-admin.ps1" -User $User

Write-Host "=== STEP 3/4: install agent task (SYSTEM) ===" -ForegroundColor Magenta
& "$here\03-install-agent-task.ps1" -ExePath $AgentExe

if ($ShellExe) {
    Write-Host "=== STEP 4/4: install shell task (player session) ===" -ForegroundColor Magenta
    & "$here\05-install-shell-task.ps1" -ShellExe $ShellExe -User $User

    # "Run as admin via stopKEK" shortcuts (Desktop + SendTo).
    & "$here\08-run-as-admin-shortcuts.ps1" -User $User -ShellExe $ShellExe
} else {
    Write-Host "=== STEP 4/4: shell task SKIPPED (no -ShellExe) ===" -ForegroundColor DarkYellow
    Write-Host "  Run later: .\05-install-shell-task.ps1 -ShellExe <path> -User $User"
}

Write-Host "`nAll done. Reboot to auto-logon as '$User' with the agent guarding the seat." -ForegroundColor Green
Write-Host "Don't forget AppLocker: .\04-applocker-games.ps1 -AuditOnly  (then without -AuditOnly)" -ForegroundColor DarkGray
