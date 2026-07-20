<#
  ДОБИВКА недоделанной миграции на SysHost (если migrate-to-syshost.ps1 завис/оборвался).
  Бинарники и config.json уже должны лежать в C:\ProgramData\SysHost — этот скрипт лишь
  ДОРЕГИСТРИРУЕТ задачи и подчищает старьё. Полностью идемпотентно и БЕЗ подтверждений/зависаний.

  Перед запуском закрой чёрное окно зависшего мигратора. Скрипт сам себя повышает (UAC).
  После него — ПЕРЕЗАГРУЗКА.
#>
param([switch]$Elevated)

$id = [Security.Principal.WindowsIdentity]::GetCurrent()
$pr = New-Object Security.Principal.WindowsPrincipal($id)
if (-not $pr.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  if ($Elevated) { Write-Host 'Нет прав администратора.' -ForegroundColor Red; Read-Host 'Enter'; return }
  Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',"`"$PSCommandPath`"",'-Elevated'
  return
}

$ErrorActionPreference = 'Continue'   # ничего не роняем и не ждём ввода
$deploy   = $PSScriptRoot
$new      = 'C:\ProgramData\SysHost'
$agentExe = Join-Path $new 'agent\syshost-svc.exe'
$shellExe = Join-Path $new 'shell\syshost-ui.exe'

# --- 0. Санити -----------------------------------------------------------------------
if (-not (Test-Path $agentExe)) { Write-Host "НЕТ $agentExe — сначала прогони migrate-to-syshost.ps1." -ForegroundColor Red; Read-Host 'Enter'; return }
if (-not (Test-Path (Join-Path $new 'agent\config.json'))) { Write-Host "НЕТ config.json в $new\agent — стоп." -ForegroundColor Red; Read-Host 'Enter'; return }

# --- 1. Прибить старые/зависшие процессы, чтобы отпустили файлы -----------------------
foreach ($n in 'stopkek-shell','stopkek-agent','syshost-ui','syshost-svc') {
  Get-Process -Name $n -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}

# --- 2. Снести любые задачи (старые И новые), чтобы регистрировать с чистого листа ----
foreach ($t in 'StopkekAgent','StopkekShell','SysHostService','SysHostUI') {
  if (Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $t -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "убрал задачу $t" -ForegroundColor DarkYellow
  }
}

# --- 3. Зарегистрировать агента (SYSTEM, при загрузке) -------------------------------
$aAction  = New-ScheduledTaskAction -Execute $agentExe
$aTrigger = New-ScheduledTaskTrigger -AtStartup
$aPrinc   = New-ScheduledTaskPrincipal -UserId 'S-1-5-18' -RunLevel Highest
$aSet     = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
             -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartInterval (New-TimeSpan -Minutes 1) `
             -RestartCount 3 -MultipleInstances IgnoreNew -Hidden
Register-ScheduledTask -TaskName 'SysHostService' -Action $aAction -Trigger $aTrigger `
    -Principal $aPrinc -Settings $aSet -Description 'Windows host session service.' -Force | Out-Null
Start-ScheduledTask -TaskName 'SysHostService'
Write-Host "SysHostService зарегистрирован и запущен" -ForegroundColor Green

# --- 4. Зарегистрировать подложку (player, при входе) --------------------------------
$sAction  = New-ScheduledTaskAction -Execute $shellExe
$sTrigger = New-ScheduledTaskTrigger -AtLogOn -User 'player'
$sPrinc   = New-ScheduledTaskPrincipal -UserId 'player' -LogonType Interactive -RunLevel Limited
$sSet     = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
             -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartInterval (New-TimeSpan -Minutes 1) `
             -RestartCount 999 -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'SysHostUI' -Action $sAction -Trigger $sTrigger `
    -Principal $sPrinc -Settings $sSet -Description 'Windows host session UI, runs in the user session.' -Force | Out-Null
Write-Host "SysHostUI зарегистрирован (стартует при входе player)" -ForegroundColor Green

# --- 5. Ярлыки запуска-от-админа на новый путь (best-effort) --------------------------
try { & "$deploy\08-run-as-admin-shortcuts.ps1" -User player -ShellExe $shellExe } catch { Write-Host "ярлыки пропущены: $_" -ForegroundColor DarkYellow }

# --- 6. Подчистить старьё (без ожиданий) ---------------------------------------------
Remove-Item 'C:\stopkek' -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $env:ProgramData 'StopKEK') -Recurse -Force -ErrorAction SilentlyContinue
if (Test-Path 'C:\stopkek') { Write-Host "C:\stopkek удалить не вышло (занят) — удалится после ребута." -ForegroundColor DarkYellow }

# --- 7. Итог -------------------------------------------------------------------------
Write-Host "`n=== ЗАДАЧИ ===" -ForegroundColor Cyan
Get-ScheduledTask -TaskName 'SysHostService','SysHostUI' | Select-Object TaskName,State | Format-Table -AutoSize
Write-Host "ГОТОВО. Теперь ПЕРЕЗАГРУЗИ ПК." -ForegroundColor Cyan
Read-Host 'Enter для выхода'
