<#
  МИГРАЦИЯ живого seat 1 со старой схемы (C:\stopkek + задачи StopkekAgent/StopkekShell +
  stopkek-*.exe) на нейтральную "SysHost":
      C:\ProgramData\SysHost\{agent,shell}
      задачи  SysHostService (агент, SYSTEM)  +  SysHostUI (подложка, player)
      exe     syshost-svc.exe  +  syshost-ui.exe
      лог     C:\ProgramData\SysHost\logs

  Что делает: останавливает старые задачи, копирует свежие бинарники из ..\dist, переносит
  СУЩЕСТВУЮЩИЙ config.json (kioskKey/elevate-creds сохраняются, правится только shellPath),
  регистрирует новые задачи, закрывает ACL, чинит ярлыки, удаляет старую папку C:\stopkek и
  старый лог C:\ProgramData\StopKEK.

  Запускать при НЕактивной подложке (между сменами). Скрипт сам себя повышает (UAC).
  После него — ПЕРЕЗАГРУЗКА. Идемпотентно: повторный запуск не ломает уже мигрированный ПК.
#>
param([switch]$Elevated)

# Проверка по SID (на локализованной Windows IsInRole('Administrators') всегда False).
$id = [Security.Principal.WindowsIdentity]::GetCurrent()
$pr = New-Object Security.Principal.WindowsPrincipal($id)
if (-not $pr.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  if ($Elevated) { Write-Host 'Нет прав администратора. Запусти вручную от админа.' -ForegroundColor Red; Read-Host 'Enter'; return }
  Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',"`"$PSCommandPath`"",'-Elevated'
  return
}

$ErrorActionPreference = 'Stop'
$deploy = $PSScriptRoot
$src    = Join-Path $deploy '..\dist'
$old    = 'C:\stopkek'
$new    = 'C:\ProgramData\SysHost'
$oldTasks = 'StopkekAgent','StopkekShell'

# --- 0. Санити: свежие бинарники должны быть собраны ---------------------------------
foreach ($p in @("$src\agent\syshost-svc.exe","$src\shell\syshost-ui.exe")) {
  if (-not (Test-Path $p)) { Write-Host "Не найдено $p. Сначала: build-agent.ps1 + build-shell.ps1" -ForegroundColor Red; Read-Host 'Enter'; return }
}

# --- 1. Остановить и удалить СТАРЫЕ задачи (агент + подложка) -------------------------
foreach ($t in $oldTasks) {
  if (Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $t -Confirm:$false
    Write-Host "старую задачу '$t' удалил" -ForegroundColor DarkYellow
  }
}
Start-Sleep -Seconds 2   # дать процессам stopkek-*.exe закрыться и отпустить файлы

# --- 2. Скопировать свежие бинарники в новую папку -----------------------------------
New-Item -ItemType Directory -Force -Path (Join-Path $new 'agent'),(Join-Path $new 'shell'),(Join-Path $new 'logs') | Out-Null
Copy-Item (Join-Path $src 'agent\*') (Join-Path $new 'agent') -Recurse -Force
Copy-Item (Join-Path $src 'shell\*') (Join-Path $new 'shell') -Recurse -Force
Write-Host "бинарники скопированы в $new" -ForegroundColor Green

# --- 3. Перенести config.json (сохранить kioskKey/elevate-creds, поправить shellPath) --
$oldCfg = Join-Path $old 'agent\config.json'
$newCfg = Join-Path $new 'agent\config.json'
if (Test-Path $oldCfg) {
  $cfg = Get-Content $oldCfg -Raw | ConvertFrom-Json
  $cfg.shellPath = Join-Path $new 'shell\syshost-ui.exe'
  ($cfg | ConvertTo-Json) | Set-Content -Path $newCfg -Encoding UTF8
  Write-Host "config.json перенесён (kioskKey/PIN/elevate сохранены)" -ForegroundColor Green
} elseif (Test-Path $newCfg) {
  Write-Host "старый config.json не найден, но новый уже на месте — ок" -ForegroundColor DarkYellow
} else {
  Write-Host "config.json не найден ни в старом, ни в новом месте — агент не стартует!" -ForegroundColor Red
}

# Обои (если были) — рядом с новым корнем.
if (Test-Path (Join-Path $old 'wallpaper.jpg')) {
  Copy-Item (Join-Path $old 'wallpaper.jpg') (Join-Path $new 'wallpaper.jpg') -Force
}

# --- 4. Закрыть ACL новой папки (как install.ps1) ------------------------------------
& icacls "$new" /inheritance:r /grant:r `
    '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-32-545:(OI)(CI)RX' /T /C /Q | Out-Null
& icacls "$newCfg" /inheritance:r /grant:r '*S-1-5-18:F' '*S-1-5-32-544:F' /C /Q | Out-Null
Write-Host "ACL закрыт (player: RX; config.json — только SYSTEM/Admins)" -ForegroundColor Green

# --- 5. Зарегистрировать НОВЫЕ задачи + ярлыки (через обновлённые 03/05/08) -----------
& "$deploy\03-install-agent-task.ps1" -ExePath (Join-Path $new 'agent\syshost-svc.exe')
& "$deploy\05-install-shell-task.ps1" -ShellExe (Join-Path $new 'shell\syshost-ui.exe') -User player
& "$deploy\08-run-as-admin-shortcuts.ps1" -User player -ShellExe (Join-Path $new 'shell\syshost-ui.exe')

# Удалить СТАРЫЙ брендированный ярлык из SendTo (профиль player + Default + Public).
$profileList = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList'
$roots = @((Join-Path $env:PUBLIC 'Desktop'), (Get-ItemProperty $profileList).Default)
try {
  $sid = (New-Object Security.Principal.NTAccount('player')).Translate([Security.Principal.SecurityIdentifier]).Value
  $pp = (Get-ItemProperty "$profileList\$sid" -ErrorAction SilentlyContinue).ProfileImagePath
  if ($pp) { $roots += $pp }
} catch {}
foreach ($r in $roots) {
  Remove-Item (Join-Path $r 'AppData\Roaming\Microsoft\Windows\SendTo\Запустить от stopKEK.lnk') -Force -ErrorAction SilentlyContinue
}

# --- 6. Убрать старьё: папка C:\stopkek и старый лог C:\ProgramData\StopKEK -----------
try { Remove-Item $old -Recurse -Force -ErrorAction Stop; Write-Host "удалил старую папку $old" -ForegroundColor Green }
catch { Write-Host "не смог удалить $old ($_). Удали вручную после ребута." -ForegroundColor DarkYellow }
Remove-Item (Join-Path $env:ProgramData 'StopKEK') -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "`nГОТОВО. Теперь ПЕРЕЗАГРУЗИ ПК." -ForegroundColor Cyan
Write-Host "После ребута: агент = задача SysHostService, подложка = SysHostUI, папка C:\ProgramData\SysHost." -ForegroundColor Cyan
Read-Host 'Enter для выхода'
