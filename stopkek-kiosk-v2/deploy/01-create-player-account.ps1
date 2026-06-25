<#
.SYNOPSIS
  Phase 0 / step 1 — create the restricted (non-admin) Windows account the club PC
  runs games under, and enable auto-logon into it.

.DESCRIPTION
  The whole tamper-resistance model rests on this: the player runs as a STANDARD
  user, so they cannot kill the SYSTEM agent service, cannot open an elevated Task
  Manager, cannot stop services. Run this elevated (Administrator) once per PC.

  Auto-logon via plaintext registry is insecure (password is readable). For
  production prefer Sysinternals Autologon.exe, which stores the secret in the LSA:
      Autologon.exe stopkek-player .  <password>
  This script offers the registry method for convenience; pass -UseSecureAutologon
  to skip it and print the Autologon.exe instructions instead.

.PARAMETER User
  Account name. Default: stopkek-player

.PARAMETER Password
  Account password (required). Use a long random one — the player never types it.

.EXAMPLE
  .\01-create-player-account.ps1 -Password 'A-long-random-secret'
#>
[CmdletBinding()]
param(
    [string]$User = 'player',
    [string]$Password,            # omit for a passwordless account (one-click login)
    [switch]$NoAutoLogon,         # don't auto-logon: boot shows the login screen with account tiles
    [switch]$UseSecureAutologon
)

$ErrorActionPreference = 'Stop'
$hasPassword = -not [string]::IsNullOrEmpty($Password)

function Assert-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Run this script as Administrator.'
    }
}

Assert-Admin

$securePass = if ($hasPassword) { ConvertTo-SecureString $Password -AsPlainText -Force } `
              else { New-Object System.Security.SecureString }

if (Get-LocalUser -Name $User -ErrorAction SilentlyContinue) {
    Write-Host "User '$User' already exists - updating." -ForegroundColor Yellow
    Set-LocalUser -Name $User -Password $securePass
} elseif ($hasPassword) {
    Write-Host "Creating standard user '$User' (with password)." -ForegroundColor Cyan
    New-LocalUser -Name $User -Password $securePass -FullName 'StopKEK Player' `
        -Description 'Restricted club game account' -PasswordNeverExpires
} else {
    Write-Host "Creating standard user '$User' (no password, one-click login)." -ForegroundColor Cyan
    New-LocalUser -Name $User -NoPassword -FullName 'StopKEK Player' `
        -Description 'Restricted club game account'
}

# Ensure NON-admin: member of Users only, never Administrators.
# Reference groups by well-known SID, not by name, so this works on localized Windows
# (e.g. Russian, where the groups are "Пользователи" / "Администраторы").
$usersGrp  = Get-LocalGroup -SID 'S-1-5-32-545'   # Users
$adminsGrp = Get-LocalGroup -SID 'S-1-5-32-544'   # Administrators
Add-LocalGroupMember -Group $usersGrp -Member $User -ErrorAction SilentlyContinue
if (Get-LocalGroupMember -Group $adminsGrp -Member $User -ErrorAction SilentlyContinue) {
    Write-Warning "Removing '$User' from Administrators (must be standard)."
    Remove-LocalGroupMember -Group $adminsGrp -Member $User
}

$winlogon = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon'
if ($NoAutoLogon -or -not $hasPassword) {
    # No auto-logon: boot lands on the login screen with both account tiles. The user
    # clicks 'player' (no password) -> kiosk; staff click the admin tile (password).
    Set-ItemProperty $winlogon -Name 'AutoAdminLogon' -Value '0' -Type String -ErrorAction SilentlyContinue
    Remove-ItemProperty $winlogon -Name 'DefaultPassword' -ErrorAction SilentlyContinue
    Write-Host "Auto-logon NOT enabled - login screen will show the account tiles." -ForegroundColor Yellow
} elseif ($UseSecureAutologon) {
    Write-Host 'Skipping registry auto-logon. Configure it securely with Sysinternals Autologon:' -ForegroundColor Yellow
    Write-Host "    Autologon.exe $User $env:COMPUTERNAME <password>" -ForegroundColor Yellow
} else {
    Write-Host 'Enabling registry auto-logon (INSECURE plaintext - see notes).' -ForegroundColor Yellow
    Set-ItemProperty $winlogon -Name 'AutoAdminLogon' -Value '1' -Type String
    Set-ItemProperty $winlogon -Name 'DefaultUserName' -Value $User -Type String
    Set-ItemProperty $winlogon -Name 'DefaultPassword' -Value $Password -Type String
    Set-ItemProperty $winlogon -Name 'DefaultDomainName' -Value $env:COMPUTERNAME -Type String
}

Write-Host "Done. Account '$User' ready." -ForegroundColor Green
