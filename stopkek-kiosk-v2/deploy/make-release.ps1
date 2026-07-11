<#
.SYNOPSIS
  Build agent + shell and assemble a handout bundle (folder + .zip) for installing on a
  club PC. Output goes to .\release (gitignored) — copy the .zip to each PC.

.DESCRIPTION
  Bundle layout:
    stopkek-kiosk-v2\
      УСТАНОВИТЬ.cmd      <- оператор запускает это
      install.ps1         <- пошаговый установщик
      УСТАНОВКА.txt       <- печатная инструкция
      agent\  shell\      <- бинарники (.NET 8 framework-dependent)
      deploy\             <- скрипты шагов (setup-all, 01..05, uninstall, config.template.json)

.PARAMETER Output
  Release root. Default .\release
#>
[CmdletBinding()]
param([string]$Output = "$PSScriptRoot\..\release")

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$bundleName = 'stopkek-kiosk-v2'
$bundle = Join-Path $Output $bundleName

Write-Host '=== Сборка agent + shell ===' -ForegroundColor Magenta
& "$PSScriptRoot\build-agent.ps1"
& "$PSScriptRoot\build-shell.ps1"

Write-Host "=== Сборка бандла -> $bundle ===" -ForegroundColor Magenta
if (Test-Path $bundle) { Remove-Item $bundle -Recurse -Force }
New-Item -ItemType Directory -Force -Path $bundle | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $bundle 'deploy') | Out-Null

# Binaries
Copy-Item (Join-Path $root 'dist\agent') (Join-Path $bundle 'agent') -Recurse -Force
Copy-Item (Join-Path $root 'dist\shell') (Join-Path $bundle 'shell') -Recurse -Force

# Operator-facing files at bundle root
foreach ($f in 'install.ps1', 'УСТАНОВИТЬ.cmd', 'УСТАНОВКА.txt') {
    Copy-Item (Join-Path $PSScriptRoot $f) $bundle -Force
}

# Step scripts into deploy\
foreach ($f in '01-create-player-account.ps1', '02-apply-policies.ps1',
               '03-install-agent-task.ps1', '04-applocker-games.ps1',
               '05-install-shell-task.ps1', '06-applocker-off.ps1',
               '07-create-elevate-admin.ps1', '08-run-as-admin-shortcuts.ps1',
               'setup-all.ps1', 'uninstall.ps1', 'config.template.json', 'wallpaper.jpg') {
    Copy-Item (Join-Path $PSScriptRoot $f) (Join-Path $bundle 'deploy') -Force
}

# Zip
$zip = Join-Path $Output ($bundleName + '.zip')
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path $bundle -DestinationPath $zip -Force

Write-Host "`nГотово." -ForegroundColor Green
Write-Host "Папка: $bundle"
Write-Host "Архив: $zip  (копируй на клубные ПК, распакуй, запусти УСТАНОВИТЬ.cmd)"
