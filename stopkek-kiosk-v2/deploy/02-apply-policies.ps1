<#
.SYNOPSIS
  Phase 0 / step 2 — lock down the restricted player account via registry policy.

.DESCRIPTION
  Applies policies to the PLAYER account only (by loading their NTUSER.DAT hive),
  plus a couple of machine-wide ones. This neutralises the obvious escape hatches:
  Task Manager, regedit, Run, control panel, Win+L. Sign-out / shutdown / switch-user are
  deliberately left available (see the note by the policy list).

  Combined with the standard-user account (step 1) and the SYSTEM agent service
  (step 3), the player has no supported way to kill the overlay for free play.

  Run elevated. The player must be LOGGED OFF (so their hive isn't loaded).

.PARAMETER User
  Player account name. Default: player

.PARAMETER WallpaperPath
  Club wallpaper for the player desktop. Default: C:\SysHost\wallpaper.jpg
#>
[CmdletBinding()]
param(
    [string]$User = 'player',
    [string]$WallpaperPath = 'C:\SysHost\wallpaper.jpg'
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

# By default HKCU\...\Policies grants a standard user only ReadKey (owner = Administrators),
# so the shell — which runs under the player's LIMITED token (05, RunLevel Limited) — cannot
# write these values at runtime: its ProtectionPolicy.Disable() on the admin crest+PIN silently
# failed with access-denied, and the restrictions never lifted. Grant the player WRITE on the two
# policy subkeys in their own hive so the overlay can flip DisableTaskMgr / NoControlPanel / ... at
# runtime with no elevation. The player is a local admin anyway, so this loosens no real boundary.
function Grant-PlayerWrite($subPath) {
    $full = "Registry::$hiveRoot\Software\Microsoft\Windows\CurrentVersion\Policies\$subPath"
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
    Write-Host "Granted player write on Policies\$subPath." -ForegroundColor Green
}

try {
    # Kill the escape hatches for the player.
    Set-Policy 'System'   'DisableTaskMgr'         1   # no Task Manager
    Set-Policy 'System'   'DisableRegistryTools'   1   # no regedit
    Set-Policy 'System'   'DisableLockWorkstation' 1   # no Win+L to Windows lock
    Set-Policy 'System'   'DisableChangePassword'  1
    Set-Policy 'Explorer' 'NoRun'                  1   # no Run dialog
    Set-Policy 'Explorer' 'NoControlPanel'         1
    Set-Policy 'Explorer' 'NoDrives'               0

    # Sign-out / shutdown / switch-user stay AVAILABLE to the player, on every club PC (owner's
    # call, 2026-06-27): the admin must be able to reach their own account from the player seat.
    # Ctrl+Alt+Del cannot be covered by the overlay anyway, so hiding these bought little.
    Set-Policy 'Explorer' 'NoLogoff'               0
    Set-Policy 'Explorer' 'StartMenuLogOff'        0
    Set-Policy 'Explorer' 'NoClose'                0
    Write-Host "Player policies applied." -ForegroundColor Green

    # Let the limited-token shell toggle these two subkeys at runtime (see Grant-PlayerWrite).
    Grant-PlayerWrite 'System'
    Grant-PlayerWrite 'Explorer'

    # Default desktop wallpaper for the player (the club branding image). Takes effect at the
    # player's next sign-in. Fill (WallpaperStyle=10) so it covers any resolution.
    if (Test-Path $WallpaperPath) {
        $desk = "Registry::$hiveRoot\Control Panel\Desktop"
        if (-not (Test-Path $desk)) { New-Item -Path $desk -Force | Out-Null }
        New-ItemProperty -Path $desk -Name 'Wallpaper'      -Value $WallpaperPath -PropertyType String -Force | Out-Null
        New-ItemProperty -Path $desk -Name 'WallpaperStyle' -Value '10'           -PropertyType String -Force | Out-Null
        New-ItemProperty -Path $desk -Name 'TileWallpaper'  -Value '0'            -PropertyType String -Force | Out-Null
        Write-Host "Wallpaper set for player: $WallpaperPath" -ForegroundColor Green
    } else {
        Write-Host "Wallpaper file not found ($WallpaperPath) - skipped." -ForegroundColor DarkYellow
    }
}
finally {
    [gc]::Collect(); Start-Sleep -Milliseconds 300
    & reg.exe unload $hiveRoot | Out-Null
    Write-Host "Hive unloaded." -ForegroundColor Cyan
}

# --- Machine-wide ------------------------------------------------------------
$sys = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System'
if (-not (Test-Path $sys)) { New-Item -Path $sys -Force | Out-Null }
# Fast user switching stays ON: "Сменить пользователя" is how the admin gets to their account
# from the player seat. Same decision as NoLogoff/NoClose above.
New-ItemProperty -Path $sys -Name 'HideFastUserSwitching' -Value 0 -PropertyType DWord -Force | Out-Null

Write-Host "All policies applied. Reboot for full effect." -ForegroundColor Green
