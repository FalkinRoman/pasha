<#
  Обновляет живой shell на seat 1 (этот ПК): копирует свежие бинарники и два
  .cmd-переключателя ограничений в C:\stopkek\shell. Требует прав администратора —
  скрипт сам себя повышает (UAC). Запускать, когда подложка не активна (между сменами).
#>
param([switch]$Elevated)

# Проверка по SID, а не по имени группы: на локализованной Windows группа зовётся
# «Администраторы», и IsInRole('Administrators') всегда False — скрипт бесконечно
# перезапускал сам себя. Флаг -Elevated делает второй виток невозможным.
$id = [Security.Principal.WindowsIdentity]::GetCurrent()
$p  = New-Object Security.Principal.WindowsPrincipal($id)
if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  if ($Elevated) {
    Write-Host 'Не удалось получить права администратора. Запусти вручную от админа.' -ForegroundColor Red
    Read-Host 'Enter для выхода'; return
  }
  Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',"`"$PSCommandPath`"",'-Elevated'
  return
}

$ErrorActionPreference = 'Stop'
$src       = Join-Path $PSScriptRoot '..\dist\shell'
$repoShell = Join-Path $PSScriptRoot '..\shell'
$dst       = 'C:\stopkek\shell'
$bins = 'stopkek-shell.exe','stopkek-shell.dll','stopkek-shell.pdb','stopkek-shell.deps.json','stopkek-shell.runtimeconfig.json'
$cmds = 'unlock.cmd','lock.cmd'
$old  = 'ОГРАНИЧЕНИЯ-СНЯТЬ.cmd','ОГРАНИЧЕНИЯ-ВЕРНУТЬ.cmd'   # прежние имена — подчищаем

if (@(Get-Process -Name 'stopkek-shell' -ErrorAction SilentlyContinue).Count -gt 0) {
  Write-Host 'Подложка запущена — закрой её (служебный выход) и повтори.' -ForegroundColor Yellow
  Read-Host 'Enter для выхода'; return
}

foreach ($b in $bins) { Copy-Item (Join-Path $src $b)       (Join-Path $dst $b) -Force; Write-Host "bin  $b" -ForegroundColor Green }
foreach ($c in $cmds) { Copy-Item (Join-Path $repoShell $c) (Join-Path $dst $c) -Force; Write-Host "cmd  $c" -ForegroundColor Green }
foreach ($o in $old)  { $p = Join-Path $dst $o; if (Test-Path $p) { Remove-Item $p -Force; Write-Host "del  $o" -ForegroundColor DarkYellow } }

$stamp = (Get-Item (Join-Path $dst 'stopkek-shell.dll')).LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss')
Write-Host "Готово. C:\stopkek\shell\stopkek-shell.dll = $stamp" -ForegroundColor Cyan
Read-Host 'Enter для выхода'
