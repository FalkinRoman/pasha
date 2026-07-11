<#
.SYNOPSIS
  Turn AppLocker OFF — let the player install, download and run games/apps from ANY folder
  (Downloads, Desktop, USB, a fresh install path), not just Program Files / approved dirs.

.DESCRIPTION
  Applies an AppLocker policy where every rule collection (Exe, Msi, Script, Dll, Appx) is
  EnforcementMode="NotConfigured". That is AppLocker's "do nothing" state: no execution is
  blocked or audited. It also clears any rules a previous run (e.g. 04-applocker-games.ps1
  -AuditOnly) left behind, so no stale audit spam accumulates.

  This ONLY relaxes application whitelisting. Everything else stays hardened:
    - lockdown policies (Task Manager / Run / regedit disabled, no logoff/shutdown menus);
    - C:\stopkek ACL (player cannot overwrite the agent/shell exe or read config.json);
    - the SYSTEM agent watchdog and the lock-screen overlay.

  Run elevated. Launch via:
    powershell -NoProfile -Command "Set-ExecutionPolicy -Scope Process RemoteSigned -Force; & '<path>\deploy\06-applocker-off.ps1'"
  (-ExecutionPolicy Bypass trips the AV classifier on this box; RemoteSigned is fine.)
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

function Assert-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Запусти этот скрипт от имени администратора.'
    }
}
Assert-Admin

# All collections NotConfigured = AppLocker enforces/audits nothing. Empty of rules so any
# leftover whitelist from an earlier run is wiped when this policy replaces the current one.
$policy = @'
<AppLockerPolicy Version="1">
  <RuleCollection Type="Exe" EnforcementMode="NotConfigured" />
  <RuleCollection Type="Msi" EnforcementMode="NotConfigured" />
  <RuleCollection Type="Script" EnforcementMode="NotConfigured" />
  <RuleCollection Type="Dll" EnforcementMode="NotConfigured" />
  <RuleCollection Type="Appx" EnforcementMode="NotConfigured" />
</AppLockerPolicy>
'@

$out = Join-Path $env:ProgramData 'StopKEK\applocker-policy.xml'
New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
Set-Content -Path $out -Value $policy -Encoding UTF8

# -XmlPolicy replaces the whole local policy with this one (drops any previous rules).
Set-AppLockerPolicy -XmlPolicy $out
Write-Host 'AppLocker отключён: запуск приложений/игр разрешён из любой папки.' -ForegroundColor Green
Write-Host "Политика: $out (все коллекции NotConfigured)." -ForegroundColor DarkGray
Write-Host 'Остальная защита (политики блокировки, ACL C:\stopkek, watchdog, подложка) НЕ затронута.' -ForegroundColor DarkGray
