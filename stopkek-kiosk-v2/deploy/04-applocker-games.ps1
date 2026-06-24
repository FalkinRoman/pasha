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
  Default covers Riot (C:\Riot Games) — add D:\Games etc. as needed.

.PARAMETER StopkekPath
  Folder of the published agent + shell. Default C:\stopkek.

.PARAMETER AuditOnly
  Apply rules in AuditOnly mode first (logs would-be blocks to the AppLocker event log
  without enforcing). Recommended for the first run to catch a launcher in a weird path.

.EXAMPLE
  .\04-applocker-games.ps1 -AuditOnly
  # ...play through every game once, check Event Viewer ->
  #    Applications and Services Logs\Microsoft\Windows\AppLocker, then:
  .\04-applocker-games.ps1
#>
[CmdletBinding()]
param(
    [string[]]$GamesPaths = @('C:\Riot Games'),
    [string]$StopkekPath = 'C:\stopkek',
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

$out = Join-Path $env:ProgramData 'StopKEK\applocker-policy.xml'
New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
Set-Content -Path $out -Value $policy -Encoding UTF8
Write-Host "Policy written: $out" -ForegroundColor Cyan

Set-AppLockerPolicy -XmlPolicy $out
Write-Host "AppLocker policy applied (mode=$mode)." -ForegroundColor Green
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
