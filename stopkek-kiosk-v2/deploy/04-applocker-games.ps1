<#
.SYNOPSIS
  Phase 0b — AppLocker whitelist so the player can only run approved games/launchers,
  never their own .exe (smuggled game, cheat, "free play" overlay killer).

.DESCRIPTION
  The model: games are installed by an ADMIN into Program Files (and a couple of known
  launcher locations). A standard user (stopkek-player) cannot write there, so
  "allow execution only from Program Files / Windows / approved game dirs, deny
  everywhere else" means the player physically cannot launch anything they dropped in
  Desktop / Downloads / AppData / a USB stick.

  Rules applied (EXE, MSI, Script collections, EnforcementMode=Enabled):
    - Allow Everyone:        %PROGRAMFILES%\*   (Steam, CS2, Dota2, Battle.net, Epic, EA…)
    - Allow Everyone:        %WINDIR%\*         (minus user-writable holes: Temp, Tasks, …)
    - Allow Everyone:        each -GamesPath    (e.g. C:\Riot Games, D:\Games — admin-owned)
    - Allow Everyone:        the StopKEK dir    (agent/shell, default C:\stopkek)
    - Allow Administrators:  *                  (admin keeps full control to install games)

  AppLocker needs Windows Pro/Enterprise/Education and the Application Identity service
  (AppIDSvc). The script enables it and sets it to start automatically.

  Run elevated. Reboot (or restart AppIDSvc) for full effect.

.PARAMETER GamesPaths
  Extra admin-owned folders where games/launchers live OUTSIDE Program Files.
  These are MERGED with whatever is auto-discovered across all fixed drives, so the same
  script works unchanged on every club PC regardless of which drive the games are on.
  Pass -NoAutoDiscover to use only this list.

.PARAMETER StopkekPath
  Folder of the published agent + shell. Default C:\stopkek.

.PARAMETER NoAutoDiscover
  Skip scanning fixed drives for known game/launcher folders; use only -GamesPaths.

.PARAMETER LockAcls
  After applying the policy, strip write access for the player from each game folder
  (SYSTEM/Admins = Full, Users = Read+Execute) so the player can't drop their own .exe into
  a whitelisted folder and run it. Opt-in and only takes effect WITHOUT -AuditOnly.
  WARNING: some launchers/games self-update or write saves into their install dir; under a
  standard user that will then fail. Use only after confirming games update under an admin.

.PARAMETER AuditOnly
  Apply rules in AuditOnly mode first (logs would-be blocks to the AppLocker event log
  without enforcing). Recommended for the first run to catch a launcher in a weird path.

.EXAMPLE
  .\04-applocker-games.ps1 -AuditOnly
  # ...play through every game once, check Event Viewer ->
  #    Applications and Services Logs\Microsoft\Windows\AppLocker, then:
  .\04-applocker-games.ps1            # enforce (paths only)
  .\04-applocker-games.ps1 -LockAcls  # enforce + lock game folders against the player
#>
[CmdletBinding()]
param(
    [string[]]$GamesPaths = @('C:\Riot Games', 'C:\Games'),
    [string]$StopkekPath = 'C:\SysHost',
    [switch]$NoAutoDiscover,
    [switch]$LockAcls,
    [switch]$AuditOnly
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

$edition = (Get-CimInstance Win32_OperatingSystem).Caption
if ($edition -match 'Home') {
    Write-Warning "Edition '$edition' likely has NO AppLocker (Home). Use Pro/Enterprise/Education, or fall back to Software Restriction Policies."
}

# --- Auto-discover game/launcher folders across ALL fixed drives ---------------
# One script, all PCs: scan every fixed drive for known game roots so it doesn't matter
# whether games live on C:, D: or E:. Merged with whatever the operator passed in -GamesPaths.
$gameFolderNames = @(
    'Riot Games', 'Games', 'Steam', 'SteamLibrary',
    'Epic Games', 'EpicGames', 'Battle.net', 'Rockstar Games',
    'Wargaming.net', 'Wargaming.net Game Center', 'WGCenter', 'World_of_Tanks',
    'MAJESTIC', 'MAJESTIC_GTA', 'GTA5RP', 'Astrum', 'Astrum Play'
)
$discovered = @()
if (-not $NoAutoDiscover) {
    Write-Host 'Scanning fixed drives for game/launcher folders...' -ForegroundColor Cyan
    $roots = Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' |
        ForEach-Object { $_.DeviceID + '\' }
    foreach ($root in $roots) {
        foreach ($name in $gameFolderNames) {
            $p = Join-Path $root $name
            if (Test-Path -LiteralPath $p -PathType Container) {
                $discovered += (Resolve-Path -LiteralPath $p).Path.TrimEnd('\')
            }
        }
    }
}
# Merge explicit + discovered, keep only folders that actually exist, de-dup case-insensitively.
$GamesPaths = @($GamesPaths) + $discovered |
    Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Container) } |
    ForEach-Object { (Resolve-Path -LiteralPath $_).Path.TrimEnd('\') } |
    Sort-Object -Unique
if ($GamesPaths) {
    Write-Host ("Game folders to whitelist ({0}):" -f $GamesPaths.Count) -ForegroundColor Green
    $GamesPaths | ForEach-Object { Write-Host "  - $_" -ForegroundColor DarkGray }
} else {
    Write-Warning 'No game folders found outside Program Files. Only %PROGRAMFILES%/%WINDIR% will be allowed.'
}

# --- Application Identity service: AppLocker enforces nothing without it -------
Write-Host 'Enabling Application Identity service (AppIDSvc)...' -ForegroundColor Cyan
& sc.exe config appidsvc start= auto | Out-Null
Start-Service appidsvc -ErrorAction SilentlyContinue

$mode = if ($AuditOnly) { 'AuditOnly' } else { 'Enabled' }
$Everyone = 'S-1-1-0'
$Admins   = 'S-1-5-32-544'

# Build allow rules for the extra game folders + the StopKEK dir.
$extraPaths = @()
$extraPaths += $StopkekPath
$extraPaths += $GamesPaths
$extraXml = ''
foreach ($p in $extraPaths) {
    if ([string]::IsNullOrWhiteSpace($p)) { continue }
    $clean = $p.TrimEnd('\')
    $id = [guid]::NewGuid().ToString()
    $extraXml += @"
    <FilePathRule Id="$id" Name="Allow: $clean" Description="StopKEK approved path" UserOrGroupSid="$Everyone" Action="Allow">
      <Conditions><FilePathCondition Path="$clean\*" /></Conditions>
    </FilePathRule>
"@
}

# %WINDIR%\* is allowed, but a few subfolders under it are user-writable and would be
# an execution hole — carve them out as exceptions (Microsoft's hardened baseline).
$winExceptions = @"
      <Exceptions>
        <FilePathCondition Path="%WINDIR%\Temp\*" />
        <FilePathCondition Path="%WINDIR%\Tasks\*" />
        <FilePathCondition Path="%WINDIR%\tracing\*" />
        <FilePathCondition Path="%WINDIR%\registration\crmlog\*" />
        <FilePathCondition Path="%WINDIR%\System32\spool\drivers\color\*" />
        <FilePathCondition Path="%WINDIR%\System32\spool\PRINTERS\*" />
        <FilePathCondition Path="%WINDIR%\System32\Tasks\*" />
        <FilePathCondition Path="%WINDIR%\SysWOW64\Tasks\*" />
      </Exceptions>
"@

$policy = @"
<AppLockerPolicy Version="1">
  <RuleCollection Type="Exe" EnforcementMode="$mode">
    <FilePathRule Id="$([guid]::NewGuid())" Name="Allow: Program Files" Description="" UserOrGroupSid="$Everyone" Action="Allow">
      <Conditions><FilePathCondition Path="%PROGRAMFILES%\*" /></Conditions>
    </FilePathRule>
    <FilePathRule Id="$([guid]::NewGuid())" Name="Allow: Windows (minus writable holes)" Description="" UserOrGroupSid="$Everyone" Action="Allow">
      <Conditions><FilePathCondition Path="%WINDIR%\*" /></Conditions>
$winExceptions
    </FilePathRule>
$extraXml
    <FilePathRule Id="$([guid]::NewGuid())" Name="Allow: Administrators all" Description="Admin installs games" UserOrGroupSid="$Admins" Action="Allow">
      <Conditions><FilePathCondition Path="*" /></Conditions>
    </FilePathRule>
  </RuleCollection>
  <RuleCollection Type="Msi" EnforcementMode="$mode">
    <FilePathRule Id="$([guid]::NewGuid())" Name="Allow: MSI from Program Files" Description="" UserOrGroupSid="$Everyone" Action="Allow">
      <Conditions><FilePathCondition Path="%PROGRAMFILES%\*" /></Conditions>
    </FilePathRule>
    <FilePathRule Id="$([guid]::NewGuid())" Name="Allow: Administrators MSI" Description="" UserOrGroupSid="$Admins" Action="Allow">
      <Conditions><FilePathCondition Path="*" /></Conditions>
    </FilePathRule>
  </RuleCollection>
  <RuleCollection Type="Script" EnforcementMode="$mode">
    <FilePathRule Id="$([guid]::NewGuid())" Name="Allow: Scripts from Program Files" Description="" UserOrGroupSid="$Everyone" Action="Allow">
      <Conditions><FilePathCondition Path="%PROGRAMFILES%\*" /></Conditions>
    </FilePathRule>
    <FilePathRule Id="$([guid]::NewGuid())" Name="Allow: Scripts from Windows" Description="" UserOrGroupSid="$Everyone" Action="Allow">
      <Conditions><FilePathCondition Path="%WINDIR%\*" /></Conditions>
    </FilePathRule>
    <FilePathRule Id="$([guid]::NewGuid())" Name="Allow: Administrators scripts" Description="" UserOrGroupSid="$Admins" Action="Allow">
      <Conditions><FilePathCondition Path="*" /></Conditions>
    </FilePathRule>
  </RuleCollection>
  <RuleCollection Type="Dll" EnforcementMode="NotConfigured" />
  <RuleCollection Type="Appx" EnforcementMode="NotConfigured" />
</AppLockerPolicy>
"@

$out = Join-Path $env:ProgramData 'SysHost\logs\applocker-policy.xml'
New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
Set-Content -Path $out -Value $policy -Encoding UTF8
Write-Host "Policy written: $out" -ForegroundColor Cyan

Set-AppLockerPolicy -XmlPolicy $out
Write-Host "AppLocker policy applied (mode=$mode)." -ForegroundColor Green

# --- Optional: lock game-folder ACLs so the player cannot write executables there ----
# Path rules trust that the player can't drop an .exe into a whitelisted folder. Enforce
# that here. Opt-in (-LockAcls) and never during AuditOnly (audit is for discovery only).
if ($LockAcls -and -not $AuditOnly) {
    Write-Host 'Locking game-folder ACLs (Users = Read+Execute, no write)...' -ForegroundColor Cyan
    foreach ($p in $GamesPaths) {
        if (-not (Test-Path -LiteralPath $p)) { continue }
        Write-Host "  lock: $p" -ForegroundColor DarkGray
        # SYSTEM + Administrators = Full, Users = Read+Execute. /C keeps going past per-file errors.
        & icacls "$p" /inheritance:r /grant:r `
            '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-32-545:(OI)(CI)RX' `
            /T /C /Q | Out-Null
    }
    Write-Host 'Game-folder ACLs locked.' -ForegroundColor Green
} elseif ($LockAcls -and $AuditOnly) {
    Write-Host '-LockAcls ignored during -AuditOnly (run enforce to lock ACLs).' -ForegroundColor DarkYellow
}
Write-Host @"

Approved to run (everyone, incl. player):
  - %PROGRAMFILES%\*   (Steam/CS2/Dota2/Battle.net/Epic/EA installed by admin)
  - %WINDIR%\*         (minus Temp/Tasks/spool holes)
  - $($extraPaths -join "`n  - ")

Blocked for the player: Desktop, Downloads, AppData, USB, any path above not listed.
Admins are unrestricted (so you can still install games).

NEXT:
  - First run with -AuditOnly, launch every game once, then check
    Event Viewer -> Applications and Services Logs\Microsoft\Windows\AppLocker\EXE and DLL.
    Any 'would have been blocked' = add that folder to -GamesPaths and re-run without -AuditOnly.
  - If a launcher installs into the user profile and admin-install isn't possible,
    add its exact folder to -GamesPaths (it must be a folder the PLAYER cannot write to).
"@ -ForegroundColor DarkGray
