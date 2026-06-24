<#
.SYNOPSIS
  Поднять локальный стек stopkek-api для тестирования подложки (kiosk-v2) на этом ПК.
  Запускать ПОСЛЕ установки WSL + перезагрузки, когда Docker Desktop стартует.

  Делает всё разом и идемпотентно:
    1) docker compose up -d   (postgres:5434 + redis:6379)
    2) ждёт готовности Postgres
    3) prisma migrate deploy + generate
    4) bootstrap клуба (4 соло-капсулы), pricing, админ  (если ещё нет)
    5) npm run start:dev

  Использование:
    powershell -ExecutionPolicy Bypass -File .\start-local.ps1
    # только инфраструктура, без запуска Nest:
    powershell -ExecutionPolicy Bypass -File .\start-local.ps1 -NoServe
#>
[CmdletBinding()]
param([switch]$NoServe)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Step($m) { Write-Host "`n== $m ==" -ForegroundColor Cyan }

# 0) Docker доступен?
Step "Проверка Docker"
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Docker не отвечает. Запусти Docker Desktop и дождись 'Engine running', потом повтори." -ForegroundColor Red
  exit 1
}
Write-Host "Docker OK"

# 1) Postgres + Redis
Step "docker compose up -d (postgres + redis)"
docker compose up -d
if ($LASTEXITCODE -ne 0) { Write-Error "compose up failed"; exit 1 }

# 2) Ждём Postgres
Step "Ожидание готовности Postgres"
$ok = $false
foreach ($i in 1..30) {
  docker compose exec -T postgres pg_isready -U stopkek *> $null
  if ($LASTEXITCODE -eq 0) { $ok = $true; break }
  Start-Sleep -Seconds 2
}
if (-not $ok) { Write-Error "Postgres не поднялся за 60с"; exit 1 }
Write-Host "Postgres готов"

# 3) Схема БД
Step "Prisma migrate deploy + generate"
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { Write-Error "migrate deploy failed"; exit 1 }
npx prisma generate | Out-Null

# 4) Сиды (идемпотентно: bootstrap падает если клуб уже есть — это ок)
Step "Сиды: клуб / pricing / админ"
npm run bootstrap:club; if ($LASTEXITCODE -ne 0) { Write-Host "  (клуб уже есть — пропускаем)" -ForegroundColor DarkGray }
npm run seed:pricing;  if ($LASTEXITCODE -ne 0) { Write-Host "  (pricing уже есть — пропускаем)" -ForegroundColor DarkGray }
npm run admin:seed;    if ($LASTEXITCODE -ne 0) { Write-Host "  (админ уже есть — пропускаем)" -ForegroundColor DarkGray }

# 5) Старт API
if ($NoServe) {
  Write-Host "`nИнфраструктура готова. Nest НЕ запущен (-NoServe)." -ForegroundColor Green
  Write-Host "Запусти вручную:  npm run start:dev"
  exit 0
}

Step "npm run start:dev"
Write-Host "API: http://localhost:3001/api   (Ctrl+C — стоп)" -ForegroundColor Green
npm run start:dev
