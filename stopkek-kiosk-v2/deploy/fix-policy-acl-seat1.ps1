<#
.SYNOPSIS
  One-time fix for machines already installed before the "grant player write on Policies"
  change (02-apply-policies.ps1). Fresh installs get this from 02; this script retrofits it.

.DESCRIPTION
  The overlay runs under the player's LIMITED token (05-install-shell-task.ps1, RunLevel Limited).
  By default HKCU\...\Policies grants a standard user only ReadKey, so the shell's
  ProtectionPolicy.Disable() (admin crest + PIN) failed silently with access-denied and the
  restrictions (Task Manager / regedit / Run / Control Panel / ...) never lifted.

  This grants the player WRITE on the two policy subkeys in their OWN hive, so the overlay can
  toggle them at runtime with no elevation. Works whether the player is currently logged on
  (live HKU\<sid>) or logged off (loads NTUSER.DAT). The player is a local admin anyway, so this
  loosens no real boundary. Idempotent. Run once per already-installed PC, then reboot.

.PARAMETER User
  Player account name. Default: player
#>
[CmdletBinding()]
param(
    [string]$User = 'player',
    [switch]$Elevated
)

$ErrorActionPreference = 'Stop'

# Admin check by SID (BUILTIN\Administrators on localized Windows is not 'Administrators' by name).
$id = [Security.Principal.WindowsIdentity]::GetCurrent()
$pr = New-Object Security.Principal.WindowsPrincipal($id)
if (-not $pr.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    if ($Elevated) { throw 'Relaunched but still not admin - aborting to avoid a self-elevation loop.' }
    Write-Host 'Elevating...' -ForegroundColor Cyan
    Start-Process powershell.exe -Verb RunAs -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"",
        '-User', $User, '-Elevated')
    exit
}

$sid = (New-Object Security.Principal.NTAccount($User)).Translate(
    [Security.Principal.SecurityIdentifier]).Value
Write-Host "Player: $User ($sid)" -ForegroundColor Cyan

# Use the live hive if the player is logged on; otherwise load NTUSER.DAT.
$mount = $null
if (Test-Path "Registry::HKEY_USERS\$sid") {
    $root = "HKEY_USERS\$sid"
    Write-Host "Player hive already loaded (logged on)." -ForegroundColor DarkGray
} else {
    $profilePath = (Get-ItemProperty `
        "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList\$sid" `
        -ErrorAction Stop).ProfileImagePath
    $ntuser = Join-Path $profilePath 'NTUSER.DAT'
    if (-not (Test-Path $ntuser)) { throw "NTUSER.DAT not found for $User at $ntuser." }
    $mount = 'STOPKEK_ACLFIX'
    & reg.exe load "HKU\$mount" $ntuser | Out-Null
    $root = "HKEY_USERS\$mount"
    Write-Host "Loaded player hive from $ntuser" -ForegroundColor DarkGray
}

function Grant-PlayerWrite($subPath) {
    $full = "Registry::$root\Software\Microsoft\Windows\CurrentVersion\Policies\$subPath"
    if (-not (Test-Path $full)) { New-Item -Path $full -Force | Out-Null }
    $acl  = Get-Acl -Path $full
    $rule = New-Object System.Security.AccessControl.RegistryAccessRule(
        (New-Object Security.Principal.SecurityIdentifier($sid)),
        ([System.Security.AccessControl.RegistryRights]'ReadKey,WriteKey'),
        ([System.Security.AccessControl.InheritanceFlags]::ContainerInherit),
        ([System.Security.AccessControl.PropagationFlags]::None),
        ([System.Security.AccessControl.AccessControlType]::Allow))
    $acl.AddAccessRule($rule)
    Set-Acl -Path $full -AclObject $acl
    Write-Host "Granted player write on Policies\$subPath" -ForegroundColor Green
}

try {
    Grant-PlayerWrite 'System'
    Grant-PlayerWrite 'Explorer'
    Write-Host 'Done. Reboot; after crest+PIN the overlay will now lift the restrictions.' -ForegroundColor Green
}
finally {
    if ($mount) {
        [gc]::Collect(); Start-Sleep -Milliseconds 300
        & reg.exe unload "HKU\$mount" | Out-Null
        Write-Host 'Hive unloaded.' -ForegroundColor DarkGray
    }
}
