<#
.SYNOPSIS
  Create the player-facing "run as administrator" affordances (Desktop shortcut + SendTo entry)
  that launch a program as administrator without a password (via the agent elevation pipe).

.DESCRIPTION
  Drops two shortcuts, both pointing at the shell in --run mode:
    * Desktop\Запустить программу от админа.lnk   -> opens a file picker, then runs it as admin
    * SendTo\Запустить от имени администратора.lnk -> right-click a file -> Отправить -> runs it as admin
  The shell (--run) hands the path to the SYSTEM agent, which starts it under the hidden admin.

  Written to the Public desktop and the Default profile template (so a fresh install works before
  the player has ever signed in) and, when it already exists, to the player profile itself.

  This file MUST stay UTF-8 with BOM: Windows PowerShell 5.1 reads a BOM-less file as ANSI and
  the Cyrillic shortcut names would come out as mojibake.

  Run elevated.

.PARAMETER User
  Player account name. Default: player

.PARAMETER ShellExe
  Path to syshost-ui.exe. Default: C:\ProgramData\SysHost\shell\syshost-ui.exe
#>
[CmdletBinding()]
param(
    [string]$User = 'player',
    [string]$ShellExe = 'C:\ProgramData\SysHost\shell\syshost-ui.exe'
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

if (-not (Test-Path $ShellExe)) {
    Write-Warning "syshost-ui.exe не найден ($ShellExe) — ярлыки не созданы."
    return
}

$ws = New-Object -ComObject WScript.Shell
function New-Lnk([string]$Path, [string]$Arguments, [string]$Desc) {
    $lnk = $ws.CreateShortcut($Path)
    $lnk.TargetPath       = $ShellExe
    $lnk.Arguments        = $Arguments
    $lnk.IconLocation     = "$ShellExe,0"
    $lnk.Description      = $Desc
    $lnk.WorkingDirectory = Split-Path $ShellExe
    $lnk.Save()
}

$profiles = @()

# Public desktop + the Default profile template: these exist on a fresh machine, so a first-time
# install lands the shortcuts even though the player profile only appears at its first sign-in.
$profileList = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList'
$profiles += [pscustomobject]@{
    Desktop = Join-Path $env:PUBLIC 'Desktop'                                   # shown to every user
    SendTo  = Join-Path (Get-ItemProperty $profileList).Default `
                        'AppData\Roaming\Microsoft\Windows\SendTo'              # seeds new profiles
    Label   = 'Public/Default'
}

# The player profile itself, if it already exists (re-install / update on a live PC): the Default
# SendTo template is only copied at profile creation, so an existing profile needs its own copy.
try {
    $sid = (New-Object Security.Principal.NTAccount($User)).Translate(
        [Security.Principal.SecurityIdentifier]).Value
    $profileKey = "$profileList\$sid"
    if (Test-Path $profileKey) {
        $playerPath = (Get-ItemProperty $profileKey).ProfileImagePath
        $profiles += [pscustomobject]@{
            Desktop = Join-Path $playerPath 'Desktop'
            SendTo  = Join-Path $playerPath 'AppData\Roaming\Microsoft\Windows\SendTo'
            Label   = $User
        }
    } else {
        Write-Host "Профиль '$User' ещё не создан — ярлык взят из Public/Default." -ForegroundColor DarkYellow
    }
} catch {
    Write-Host "Аккаунт '$User' не найден — ярлык взят из Public/Default." -ForegroundColor DarkYellow
}

foreach ($p in $profiles) {
    New-Item -ItemType Directory -Force -Path $p.Desktop, $p.SendTo | Out-Null
    New-Lnk (Join-Path $p.Desktop 'Запустить программу от админа.lnk') '--run' `
        'Выбрать и запустить программу от имени администратора'
    New-Lnk (Join-Path $p.SendTo 'Запустить от имени администратора.lnk') '--run' `
        'Запустить выбранный файл от имени администратора'
    Write-Host "Ярлыки запуска от админа созданы: $($p.Label)" -ForegroundColor Green
}
