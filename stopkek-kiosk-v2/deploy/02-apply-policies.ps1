<#
.SYNOPSIS
  Phase 0 / step 2 — lock down the restricted player account via registry policy.

.DESCRIPTION
  Applies policies to the PLAYER account only (by loading their NTUSER.DAT hive),
  plus a couple of machine-wide ones. This neutralises the obvious escape hatches:
  Task Manager, regedit, Run, control panel, manual lock/logoff, fast user switching.

  Combined with the standard-user account (step 1) and the SYSTEM agent service
  (step 3), the player has no supported way to kill the overlay for free play.

  Run elevated. The player must be LOGGED OFF (so their hive isn't loaded).

.PARAMETER User
  Player account name. Default: stopkek-player
#>
[CmdletBinding()]
param([string]$User = 'stopkek-player')

$ErrorActionPreference = 'Stop'

function Assert-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Run this script as Administrator.'
    }
}
Assert-Admin

# --- Resolve the player's profile hive --------------------------------------
$sid = (New-Object Security.Principal.NTAccount($User)).Translate(
    [Security.Principal.SecurityIdentifier]).Value
$profilePath = (Get-ItemProperty `
    "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList\$sid" `
    -ErrorAction Stop).ProfileImagePath
$ntuser = Join-Path $profilePath 'NTUSER.DAT'
if (-not (Test-Path $ntuser)) {
    throw "NTUSER.DAT not found for $User at $ntuser. Log into the account once, then log off."
}

$hiveRoot = 'HKU\STOPKEK_PLAYER'
Write-Host "Loading hive for $User ($sid)..." -ForegroundColor Cyan
& reg.exe load $hiveRoot $ntuser | Out-Null

function Set-Policy($subPath, $name, $value) {
    $full = "Registry::$hiveRoot\Software\Microsoft\Windows\CurrentVersion\Policies\$subPath"
    if (-not (Test-Path $full)) { New-Item -Path $full -Force | Out-Null }
    New-ItemProperty -Path $full -Name $name -Value $value -PropertyType DWord -Force | Out-Null
}

try {
    # Kill the escape hatches for the player.
    Set-Policy 'System'   'DisableTaskMgr'         1   # no Task Manager
    Set-Policy 'System'   'DisableRegistryTools'   1   # no regedit
    Set-Policy 'System'   'DisableLockWorkstation' 1   # no Win+L to Windows lock
    Set-Policy 'System'   'DisableChangePassword'  1
    Set-Policy 'Explorer' 'NoRun'                  1   # no Run dialog
    Set-Policy 'Explorer' 'NoControlPanel'         1
    Set-Policy 'Explorer' 'NoLogoff'               1
    Set-Policy 'Explorer' 'StartMenuLogOff'        1
    Set-Policy 'Explorer' 'NoClose'                1   # no shutdown from Start
    Set-Policy 'Explorer' 'NoDrives'               0
    Write-Host "Player policies applied." -ForegroundColor Green
}
finally {
    [gc]::Collect(); Start-Sleep -Milliseconds 300
    & reg.exe unload $hiveRoot | Out-Null
    Write-Host "Hive unloaded." -ForegroundColor Cyan
}

# --- Machine-wide ------------------------------------------------------------
$sys = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System'
if (-not (Test-Path $sys)) { New-Item -Path $sys -Force | Out-Null }
# Disable fast user switching (no jumping to another session).
New-ItemProperty -Path $sys -Name 'HideFastUserSwitching' -Value 1 -PropertyType DWord -Force | Out-Null

Write-Host "All policies applied. Reboot for full effect." -ForegroundColor Green
