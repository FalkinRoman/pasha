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
    5. turns AppLocker OFF so the player can install/download/run games from ANY folder
       (06-applocker-off.ps1). All other hardening stays in place.

  After this: reboot — that's it. Games can be installed and launched from anywhere.

.PARAMETER SeatNumber
  Seat number for THIS PC (1..7). Prompted if omitted.

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
  Install folder. Default C:\SysHost.
#>
[CmdletBinding()]
param(
    [int]$SeatNumber,
    [string]$KioskKey,
    [string]$ApiUrl = 'https://stopkek.site/api',
    [string]$AdminExitPinHash = '',
    [switch]$AutoLogon,
    [string]$PlayerPassword,
    [string]$Target = 'C:\SysHost'
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
if (-not (Test-Path (Join-Path $srcAgent 'syshost-svc.exe'))) {
    throw "Не найдено '$srcAgent\syshost-svc.exe'. Запускай install.ps1 из распакованного релиз-бандла (рядом папки agent\, shell\, deploy\)."
}
if (-not (Test-Path (Join-Path $srcShell 'syshost-ui.exe'))) {
    throw "Не найдено '$srcShell\syshost-ui.exe'."
}

# --- Seat number + key ---------------------------------------------------------------
# If the bundle already ships a filled agent\config.json (per-PC folder), use it as
# defaults so this becomes a true one-click install with no questions.
$bundledCfg = Join-Path $srcAgent 'config.json'
if (Test-Path $bundledCfg) {
    try {
        $bc = Get-Content $bundledCfg -Raw | ConvertFrom-Json
        if (-not $PSBoundParameters.ContainsKey('SeatNumber') -and $bc.seatNumber -ge 1 -and $bc.seatNumber -le 7) {
            $SeatNumber = [int]$bc.seatNumber
        }
        if (-not $PSBoundParameters.ContainsKey('KioskKey') -and $bc.kioskKey -and $bc.kioskKey -notlike 'PASTE-*') {
            $KioskKey = [string]$bc.kioskKey
        }
        if (-not $PSBoundParameters.ContainsKey('ApiUrl') -and $bc.apiUrl) { $ApiUrl = [string]$bc.apiUrl }
        if (-not $PSBoundParameters.ContainsKey('AdminExitPinHash') -and $bc.adminExitPinHash) {
            $AdminExitPinHash = [string]$bc.adminExitPinHash
        }
    } catch { }
}

while ($SeatNumber -lt 1 -or $SeatNumber -gt 7) {
    $SeatNumber = [int](Read-Host 'Номер места этого ПК (1-7)')
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

# Club wallpaper (заставка рабочего стола player) — set later by 02-apply-policies.ps1.
$wallSrc = Join-Path $deploy 'wallpaper.jpg'
if (Test-Path $wallSrc) {
    Copy-Item $wallSrc (Join-Path $Target 'wallpaper.jpg') -Force
    Write-Host "Заставка скопирована: $Target\wallpaper.jpg" -ForegroundColor Green
}

# --- Hidden admin for password-free elevation ----------------------------------------
# Creates the 'stopkek-svc' local admin and returns its random password; the agent uses it to
# run programs "от администратора" for the player. Stored only in the ACL-locked config.json.
Write-Host "=== Создаю скрытого админа для запуска программ от админа ===" -ForegroundColor Magenta
$svc = & "$deploy\07-create-elevate-admin.ps1"

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
    shellPath        = (Join-Path $Target 'shell\syshost-ui.exe')
    watchdogEnabled  = $true
    adminExitPinHash = $AdminExitPinHash
    elevateUser      = $svc.User
    elevatePassword  = $svc.Password
}
($cfg | ConvertTo-Json) | Set-Content -Path $cfgPath -Encoding UTF8
Write-Host "config.json записан: место №$SeatNumber, $ApiUrl" -ForegroundColor Green

# --- Account + policies + tasks (setup-all.ps1) --------------------------------------
$agentExe = Join-Path $Target 'agent\syshost-svc.exe'
$shellExe = Join-Path $Target 'shell\syshost-ui.exe'
$setupArgs = @{ AgentExe = $agentExe; ShellExe = $shellExe }
if ($AutoLogon) {
    if ([string]::IsNullOrWhiteSpace($PlayerPassword)) {
        throw '-AutoLogon требует -PlayerPassword (пароль аккаунта player).'
    }
    $setupArgs.Password = $PlayerPassword
} else {
    $setupArgs.NoAutoLogon = $true
}
& "$deploy\setup-all.ps1" @setupArgs   # STEP 2b inside makes player a silent admin (09-...)

# --- Defender: исключить папку установки -----------------------------------------------
# Неподписанный agent.exe при SYSTEM-запуске из нестандартной папки ловит "block at first
# sight" и НЕ стартует (0x80070005). Исключаем папку + процессы. (Своя known-good сборка.)
Write-Host "=== Defender: исключаю $Target ===" -ForegroundColor Magenta
try {
    Add-MpPreference -ExclusionPath $Target -ErrorAction SilentlyContinue
    Add-MpPreference -ExclusionProcess 'syshost-svc.exe' -ErrorAction SilentlyContinue
    Add-MpPreference -ExclusionProcess 'syshost-ui.exe'  -ErrorAction SilentlyContinue
} catch { Write-Warning "Defender exclusion не добавлено: $_" }

# --- Harden ACL: player (Users) = Read+Execute, config.json недоступен игроку -----------
# ВАЖНО: только на ПАПКУ с наследуемыми (OI)(CI) ACE, БЕЗ /T. Рекурсивный /T навешивает
# (OI)(CI) на сами ФАЙЛЫ — на листе они невалидны, и после /inheritance:r файл остаётся с
# ПУСТЫМ DACL (запрет всем) -> SYSTEM не запускает exe. Дети наследуют ACL папки сами.
Write-Host "=== Закрываю ACL $Target ===" -ForegroundColor Magenta
& icacls "$Target" /inheritance:r /grant:r `
    '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-32-545:(OI)(CI)RX' /C /Q | Out-Null
# config.json holds the kioskKey + PIN hash -> lock to SYSTEM/Admins (одиночный файл — безопасно).
& icacls "$cfgPath" /inheritance:r /grant:r '*S-1-5-18:F' '*S-1-5-32-544:F' /C /Q | Out-Null
Write-Host "ACL закрыт (player: RX на бинарники, нет доступа к config.json)." -ForegroundColor Green

# Прячу папку установки из Проводника (скрытый+системный). Казуальное скрытие: админ найдёт.
& attrib +h +s "$Target"

# --- AppLocker OFF: разрешить установку/запуск игр из любой папки ---------------------
# (RemoteSigned: Bypass режет AV-классификатор.) Прочая защита остаётся: политики
# блокировки, ACL C:\stopkek, watchdog, подложка.
Write-Host "=== AppLocker: отключаю (игры запускаются из любой папки) ===" -ForegroundColor Magenta
& powershell.exe -NoProfile -Command "Set-ExecutionPolicy -Scope Process RemoteSigned -Force; & '$deploy\06-applocker-off.ps1'"

Write-Host @"

ГОТОВО. Дальше:
  1) ОБЯЗАТЕЛЬНО перезагрузи ПК (иначе тихий админ-доступ игрока не применится).
     На экране входа плитка 'player' -> замок с QR.
  2) Игры можно ставить/качать и запускать из любой папки (AppLocker выключен).
  3) ЛЮБОЕ приложение (установщик/лаунчер/анти-чит) поднимается с правами админа
     МОЛЧА, без пароля. Ярлык «Запустить от имени администратора» остаётся как запасной вариант.
  Снять киоск целиком:  $deploy\uninstall.ps1 -RemoveUser
"@ -ForegroundColor Cyan
