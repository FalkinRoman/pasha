<#
.SYNOPSIS
  Guided one-PC installer for stopkek-kiosk-v2. Run as Administrator from the release
  bundle (the folder that contains agent\, shell\ and deploy\).

.DESCRIPTION
  Does everything for one club PC, the same way on all of them:
    1. copies agent + shell to C:\stopkek;
    2. writes C:\stopkek\agent\config.json for THIS seat (seatNumber + kioskKey);
    3. creates the restricted 'player' account, applies the lockdown policies, and
       installs the SYSTEM agent task + the player-session shell task (via setup-all.ps1);
    4. hardens C:\stopkek ACLs so the player can't overwrite the agent/shell exe or read
       the kioskKey/PIN in config.json;
    5. runs AppLocker in AUDIT mode (auto-discovers game folders on every drive).

  After this: reboot, play every game once, then run enforce:
    powershell -NoProfile -Command "Set-ExecutionPolicy -Scope Process RemoteSigned -Force; & '<bundle>\deploy\04-applocker-games.ps1' -LockAcls"

.PARAMETER SeatNumber
  Seat number for THIS PC (1..6). Prompted if omitted.

.PARAMETER KioskKey
  Per-seat API key (admin: GET /api/admin/kiosk/seat-key?seatNumber=N). Prompted if omitted.

.PARAMETER ApiUrl
  Default https://stopkek.site/api.

.PARAMETER AdminExitPinHash
  SHA-256 hex of the lock-screen service-exit PIN. Empty = no admin-exit button.

.PARAMETER AutoLogon
  Boot straight into the kiosk (player auto-logon). Requires -PlayerPassword.
  Default (omitted) = login screen with 'player' (one click) + admin tiles.

.PARAMETER PlayerPassword
  Password for the player account when -AutoLogon is used.

.PARAMETER Target
  Install folder. Default C:\stopkek.
#>
[CmdletBinding()]
param(
    [int]$SeatNumber,
    [string]$KioskKey,
    [string]$ApiUrl = 'https://stopkek.site/api',
    [string]$AdminExitPinHash = '',
    [switch]$AutoLogon,
    [string]$PlayerPassword,
    [string]$Target = 'C:\stopkek'
)

$ErrorActionPreference = 'Stop'

function Assert-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Запусти этот установщик от имени администратора (ПКМ -> Запуск от имени администратора).'
    }
}
Assert-Admin

# --- Locate bundle parts (works from the release bundle: agent\, shell\, deploy\) -----
$base   = $PSScriptRoot
$deploy = if (Test-Path (Join-Path $base '03-install-agent-task.ps1')) { $base } else { Join-Path $base 'deploy' }
$srcAgent = Join-Path $base 'agent'
$srcShell = Join-Path $base 'shell'
if (-not (Test-Path (Join-Path $srcAgent 'stopkek-agent.exe'))) {
    throw "Не найдено '$srcAgent\stopkek-agent.exe'. Запускай install.ps1 из распакованного релиз-бандла (рядом папки agent\, shell\, deploy\)."
}
if (-not (Test-Path (Join-Path $srcShell 'stopkek-shell.exe'))) {
    throw "Не найдено '$srcShell\stopkek-shell.exe'."
}

# --- Seat number + key ---------------------------------------------------------------
while ($SeatNumber -lt 1 -or $SeatNumber -gt 6) {
    $SeatNumber = [int](Read-Host 'Номер места этого ПК (1-6)')
}
while ([string]::IsNullOrWhiteSpace($KioskKey) -or $KioskKey -like 'PASTE-*') {
    $KioskKey = (Read-Host "Ключ места №$SeatNumber (kioskKey)").Trim()
}

# --- Copy binaries to the install folder ---------------------------------------------
Write-Host "=== Копирую бинарники в $Target ===" -ForegroundColor Magenta
New-Item -ItemType Directory -Force -Path (Join-Path $Target 'agent') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $Target 'shell') | Out-Null
Copy-Item (Join-Path $srcAgent '*') (Join-Path $Target 'agent') -Recurse -Force
Copy-Item (Join-Path $srcShell '*') (Join-Path $Target 'shell') -Recurse -Force

# --- Write config.json for this seat -------------------------------------------------
$cfgPath = Join-Path $Target 'agent\config.json'
$cfg = [ordered]@{
    apiUrl           = $ApiUrl
    seatNumber       = $SeatNumber
    kioskKey         = $KioskKey
    pollIntervalSec  = 8
    graceSeconds     = 300
    warnMinutes      = @(15, 5, 1)
    lockOnStartup    = $true
    shellPath        = (Join-Path $Target 'shell\stopkek-shell.exe')
    watchdogEnabled  = $true
    adminExitPinHash = $AdminExitPinHash
}
($cfg | ConvertTo-Json) | Set-Content -Path $cfgPath -Encoding UTF8
Write-Host "config.json записан: место №$SeatNumber, $ApiUrl" -ForegroundColor Green

# --- Account + policies + tasks (setup-all.ps1) --------------------------------------
$agentExe = Join-Path $Target 'agent\stopkek-agent.exe'
$shellExe = Join-Path $Target 'shell\stopkek-shell.exe'
$setupArgs = @{ AgentExe = $agentExe; ShellExe = $shellExe }
if ($AutoLogon) {
    if ([string]::IsNullOrWhiteSpace($PlayerPassword)) {
        throw '-AutoLogon требует -PlayerPassword (пароль аккаунта player).'
    }
    $setupArgs.Password = $PlayerPassword
} else {
    $setupArgs.NoAutoLogon = $true
}
& "$deploy\setup-all.ps1" @setupArgs

# --- Harden C:\stopkek so the player can't overwrite the exe or read the key ----------
Write-Host "=== Закрываю ACL $Target ===" -ForegroundColor Magenta
# SYSTEM + Admins = Full, Users = Read+Execute (referenced by SID for localized Windows).
& icacls "$Target" /inheritance:r /grant:r `
    '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-32-545:(OI)(CI)RX' /T /C /Q | Out-Null
# config.json holds the kioskKey + PIN hash -> remove player read entirely.
& icacls "$cfgPath" /inheritance:r /grant:r '*S-1-5-18:F' '*S-1-5-32-544:F' /C /Q | Out-Null
Write-Host "ACL закрыт (player: RX на бинарники, нет доступа к config.json)." -ForegroundColor Green

# --- AppLocker in AUDIT mode (RemoteSigned: Bypass would disable the classifier) ------
Write-Host "=== AppLocker (аудит, авто-поиск игр на всех дисках) ===" -ForegroundColor Magenta
& powershell.exe -NoProfile -Command "Set-ExecutionPolicy -Scope Process RemoteSigned -Force; & '$deploy\04-applocker-games.ps1' -AuditOnly"

Write-Host @"

ГОТОВО. Дальше:
  1) Перезагрузи ПК -> на экране входа плитка 'player' -> замок с QR.
  2) Зайди под player, запусти КАЖДУЮ игру/лаунчер по разу.
  3) Включи жёсткий AppLocker (enforce):
       powershell -NoProfile -Command "Set-ExecutionPolicy -Scope Process RemoteSigned -Force; & '$deploy\04-applocker-games.ps1' -LockAcls"
  Снять киоск целиком:  $deploy\uninstall.ps1 -RemoveUser
"@ -ForegroundColor Cyan
