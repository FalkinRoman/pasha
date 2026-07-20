<#
.SYNOPSIS
  Revert Phase 0: remove the service, undo player policies, disable auto-logon.
  For bench/dev cleanup. Run elevated.
#>
[CmdletBinding()]
param(
    [string]$User = 'player',
    [string]$ElevateUser = 'stopkek-svc',   # hidden admin created by 07-create-elevate-admin.ps1
    [string]$TaskName = 'SysHostService',
    [switch]$RemoveUser
)
$ErrorActionPreference = 'Continue'

function Assert-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Run this script as Administrator.'
    }
}
Assert-Admin

# Scheduled tasks: agent (SYSTEM) + shell (player session)
foreach ($t in @($TaskName, 'SysHostUI')) {
    if (Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue) {
        Stop-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $t -Confirm:$false
        Write-Host "Removed scheduled task '$t'." -ForegroundColor Green
    }
}

# Auto-logon off
$winlogon = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon'
Set-ItemProperty $winlogon -Name 'AutoAdminLogon' -Value '0' -Type String -ErrorAction SilentlyContinue
Remove-ItemProperty $winlogon -Name 'DefaultPassword' -ErrorAction SilentlyContinue
Write-Host "Auto-logon disabled." -ForegroundColor Green

# Player policies (load hive, blow away the Policies key)
try {
    $sid = (New-Object Security.Principal.NTAccount($User)).Translate(
        [Security.Principal.SecurityIdentifier]).Value
    $profilePath = (Get-ItemProperty `
        "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList\$sid").ProfileImagePath
    $ntuser = Join-Path $profilePath 'NTUSER.DAT'
    & reg.exe load 'HKU\STOPKEK_PLAYER' $ntuser | Out-Null
    Remove-Item 'Registry::HKU\STOPKEK_PLAYER\Software\Microsoft\Windows\CurrentVersion\Policies' `
        -Recurse -Force -ErrorAction SilentlyContinue
    [gc]::Collect(); Start-Sleep -Milliseconds 300
    & reg.exe unload 'HKU\STOPKEK_PLAYER' | Out-Null
    Write-Host "Player policies cleared." -ForegroundColor Green
} catch {
    Write-Warning "Could not clear player policies: $_"
}

# Elevation shortcuts (Public desktop, Default profile template, player profile).
$profileList = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList'
$roots = @((Join-Path $env:PUBLIC 'Desktop'), (Get-ItemProperty $profileList).Default)
if ($profilePath) { $roots += $profilePath }
foreach ($r in $roots) {
    foreach ($rel in @('Запустить программу от админа.lnk',
                       'Desktop\Запустить программу от админа.lnk',
                       'AppData\Roaming\Microsoft\Windows\SendTo\Запустить от имени администратора.lnk')) {
        Remove-Item (Join-Path $r $rel) -Force -ErrorAction SilentlyContinue
    }
}
Write-Host "Elevation shortcuts removed." -ForegroundColor Green

if ($RemoveUser) {
    foreach ($u in @($User, $ElevateUser)) {
        if (Get-LocalUser -Name $u -ErrorAction SilentlyContinue) {
            Remove-LocalUser -Name $u
            Write-Host "Removed user '$u'." -ForegroundColor Green
        }
    }
    # Un-hide the elevation admin from the sign-in screen (the account itself is gone).
    Remove-ItemProperty `
        'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon\SpecialAccounts\UserList' `
        -Name $ElevateUser -ErrorAction SilentlyContinue
}

Write-Host "Uninstall complete. Reboot recommended." -ForegroundColor Cyan
