<#
.SYNOPSIS
  Включить «тихий» админ-доступ для игрока: player становится локальным админом,
  а UAC настраивается на повышение БЕЗ запроса. После этого ЛЮБОЕ приложение
  (установщик, лаунчер, анти-чит) запускается с правами администратора молча —
  пароль не спрашивается никогда.

.DESCRIPTION
  Обычному (standard) пользователю Windows нельзя тихо выдать реальные права
  администратора — нет ни одной настройки реестра/политики для этого. Поэтому,
  чтобы «любое приложение запускалось сразу», игрок делается членом группы
  Администраторы, а UAC переводится в режим ConsentPromptBehaviorAdmin=0
  (Elevate without prompting). EnableLUA оставляем = 1, иначе ломаются
  Store/UWP-приложения; при CPBA=0 админ и так поднимается без окна.

  Защита оплаченного времени теперь держится НЕ на «обычной учётке», а на
  подложке (kiosk shell) + политиках player-хайва (нет Диспетчера/regedit/Run)
  + watchdog агента. Это осознанный размен: против физического доступа не
  бронебойно, но казуальный побег закрыт.

  Идемпотентно и безопасно повторно. Запускать ОТ ИМЕНИ АДМИНИСТРАТОРА.
  Изменение членства в группе вступает в силу после reboot / повторного входа
  игрока (токен пересоздаётся при логоне).

.PARAMETER User
  Имя учётки игрока. По умолчанию: player
#>
[CmdletBinding()]
param(
    [string]$User = 'player'
)

$ErrorActionPreference = 'Stop'

function Assert-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Запусти этот скрипт от имени администратора.'
    }
}
Assert-Admin

if (-not (Get-LocalUser -Name $User -ErrorAction SilentlyContinue)) {
    throw "Учётка '$User' не найдена. Сначала создай её (01-create-player-account.ps1)."
}

# --- 1) player -> Администраторы (по SID, для локализованной Windows) --------
$adminsGrp = Get-LocalGroup -SID 'S-1-5-32-544'   # Administrators
if (Get-LocalGroupMember -Group $adminsGrp -Member $User -ErrorAction SilentlyContinue) {
    Write-Host "'$User' уже в группе Администраторы." -ForegroundColor DarkGray
} else {
    Add-LocalGroupMember -Group $adminsGrp -Member $User
    Write-Host "'$User' добавлен в Администраторы." -ForegroundColor Green
}

# --- 2) UAC: повышать без запроса (машинно) ----------------------------------
# ConsentPromptBehaviorAdmin = 0  -> Elevate without prompting (тихо, без окна)
# PromptOnSecureDesktop      = 0  -> без затемнённого «безопасного рабочего стола»
# EnableLUA                  = 1  -> оставляем UAC включённым (иначе ломаются Store/UWP)
# FilterAdministratorToken   = 0  -> не форсировать одобрение для админов
$sys = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System'
if (-not (Test-Path $sys)) { New-Item -Path $sys -Force | Out-Null }
New-ItemProperty -Path $sys -Name 'ConsentPromptBehaviorAdmin' -Value 0 -PropertyType DWord -Force | Out-Null
New-ItemProperty -Path $sys -Name 'PromptOnSecureDesktop'      -Value 0 -PropertyType DWord -Force | Out-Null
New-ItemProperty -Path $sys -Name 'EnableLUA'                  -Value 1 -PropertyType DWord -Force | Out-Null
New-ItemProperty -Path $sys -Name 'FilterAdministratorToken'   -Value 0 -PropertyType DWord -Force | Out-Null
Write-Host "UAC: повышение без запроса включено (ConsentPromptBehaviorAdmin=0)." -ForegroundColor Green

Write-Host "`nГотово. ПЕРЕЗАГРУЗИ ПК (или выйди/зайди под '$User') — иначе новый" -ForegroundColor Cyan
Write-Host "админ-токен игрока не применится и приложения ещё будут просить пароль." -ForegroundColor Cyan
