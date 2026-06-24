<#
.SYNOPSIS
  Revert Phase 0: remove the service, undo player policies, disable auto-logon.
  For bench/dev cleanup. Run elevated.
#>
[CmdletBinding()]
param(
    [string]$User = 'stopkek-player',
    [string]$TaskName = 'StopkekAgent',
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

# Agent scheduled task
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed scheduled task '$TaskName'." -ForegroundColor Green
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

if ($RemoveUser -and (Get-LocalUser -Name $User -ErrorAction SilentlyContinue)) {
    Remove-LocalUser -Name $User
    Write-Host "Removed user '$User'." -ForegroundColor Green
}

Write-Host "Uninstall complete. Reboot recommended." -ForegroundColor Cyan
