<#
.SYNOPSIS
  Create the hidden local admin account the agent uses to launch programs "as administrator"
  for the standard-user player WITHOUT a password prompt.

.DESCRIPTION
  The player is a standard user and Windows will not elevate arbitrary programs for it without
  admin credentials. This script creates a dedicated local admin ('stopkek-svc' by default) with
  a strong random password, adds it to Administrators, and hides it from the sign-in screen.

  The generated password is RETURNED (as an object) so the installer can store it in the
  ACL-locked config.json (readable only by SYSTEM/Admins). The agent (SYSTEM) then uses it to
  start the requested exe elevated, inside the player's session, over the elevation pipe.
  See agent/Elevation/ElevationServer.cs.

  Run elevated. Idempotent: if the account exists, its password is reset and returned.

.PARAMETER User
  Hidden admin account name. Default: stopkek-svc

.OUTPUTS
  [pscustomobject] @{ User = '<name>'; Password = '<plaintext>' }
#>
[CmdletBinding()]
param(
    [string]$User = 'stopkek-svc',
    [int]$PasswordLength = 24
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

# Strong random password. Charset avoids quotes/backslash/space so it is safe in JSON and in a
# Win32 command line; guaranteed to include upper, lower, digit and symbol for complexity policy.
function New-RandomPassword([int]$len) {
    $upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    $lower = 'abcdefghijkmnpqrstuvwxyz'
    $digit = '23456789'
    $sym   = '!@#$%^*()-_=+'
    $all   = ($upper + $lower + $digit + $sym).ToCharArray()
    $rng   = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    function Pick([string]$set) {
        $b = [byte[]]::new(1); $rng.GetBytes($b); $set[[int]($b[0] % $set.Length)]
    }
    $chars = @(Pick $upper; Pick $lower; Pick $digit; Pick $sym)
    for ($i = $chars.Count; $i -lt $len; $i++) {
        $b = [byte[]]::new(1); $rng.GetBytes($b); $chars += $all[[int]($b[0] % $all.Length)]
    }
    # Shuffle so the guaranteed-class chars are not always first.
    $chars = $chars | Sort-Object { $g = [byte[]]::new(1); $rng.GetBytes($g); $g[0] }
    -join $chars
}

$Password = New-RandomPassword $PasswordLength
$secure   = ConvertTo-SecureString $Password -AsPlainText -Force

if (Get-LocalUser -Name $User -ErrorAction SilentlyContinue) {
    Write-Host "Hidden admin '$User' exists - resetting password." -ForegroundColor Yellow
    Set-LocalUser -Name $User -Password $secure
    Set-LocalUser -Name $User -PasswordNeverExpires $true
} else {
    Write-Host "Creating hidden admin '$User'." -ForegroundColor Cyan
    New-LocalUser -Name $User -Password $secure -FullName 'StopKEK Service' `
        -Description 'Hidden admin for stopKEK elevation' `
        -PasswordNeverExpires | Out-Null
}

# Ensure it is a local administrator (reference the group by SID for localized Windows).
$adminsGrp = Get-LocalGroup -SID 'S-1-5-32-544'
if (-not (Get-LocalGroupMember -Group $adminsGrp -Member $User -ErrorAction SilentlyContinue)) {
    Add-LocalGroupMember -Group $adminsGrp -Member $User | Out-Null
}

# Hide the account from the Windows sign-in screen (does not remove its logon right).
$ul = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon\SpecialAccounts\UserList'
if (-not (Test-Path $ul)) { New-Item -Path $ul -Force | Out-Null }
New-ItemProperty -Path $ul -Name $User -Value 0 -PropertyType DWord -Force | Out-Null

Write-Host "Hidden admin '$User' ready (added to Administrators, hidden from sign-in)." -ForegroundColor Green

# Return the credentials for the installer to inject into config.json.
[pscustomobject]@{ User = $User; Password = $Password }
