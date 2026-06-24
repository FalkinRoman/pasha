# stopkek-kiosk-v2 — защитная подложка ПК для клуба

Подложка-страж для клубного ПК: **жёстко блокирует** неоплаченное место, **исчезает**
на время игры, **предупреждает не мешая** на истечении и **снова банит** после грейса.
Полное продолжение экосистемы StopKEK (та же серверная правда, тот же бренд).

```
Мобилка ──JWT──►  API /api  ◄──X-Kiosk-Key── Агент (служба SYSTEM)
Админка ──JWT──►  API /api                         │ named pipe
                                                   ▼
                                              Shell (UI, замок/таймер)
```

## Архитектура: два процесса

| Компонент | Что | Почему |
|---|---|---|
| **agent** (`/agent`) | .NET 8, запуск как **SYSTEM-задача Планировщика** | держит гейт, опрашивает сервер, watchdog, не убивается пользователем |
| **shell** (`/shell`) | чистый WPF (без WebView2/NuGet) | рисует замок+QR, таймер, предупреждения; одноразовый, перезапускается агентом |

> **Сборка без интернета.** Агент не использует ни одного NuGet-пакета — только локально
> установленный shared-framework `Microsoft.AspNetCore.App` (Hosting/Logging/Http/DI) и
> `Microsoft.NETCore.App` (JSON, pipes, channels). `nuget.org` при сборке не нужен.
> Собрать и прогнать тесты: двойной клик по `deploy\BUILD-AND-TEST.cmd`.

Разблокирует **телефон**: на мониторе крутится QR с `challengeId`, телефон сканирует и
сам бьёт по серверу (`confirm-qr`) со своим JWT → сервер ставит `pcUnlockedAt` → агент на
следующем опросе видит `state: active`. Агент **не хранит секретов о пользователе**.

## Машина состояний (agent/Core/SessionStateMachine.cs)

```
LOCKED ──server active──► ACTIVE ──remaining<=0──► GRACE ──grace истёк──► LOCKED
  ▲                          │ notice 15/5/1                                 │
  └──────────── end-session / server locked (×2 гистерезис) ────────────────┘
```

Защиты, встроенные в машину:
- **монотонный таймер** (Stopwatch) — перевод системных часов не добавляет времени;
- **гистерезис** — одиночный глюк сети не выкинет игрока из активной сессии;
- **грейс** — после нуля даём «доиграть катку», только потом замок;
- **fail-secure offline** — нет связи: LOCKED остаётся LOCKED; ACTIVE доигрывает по
  локальному отсчёту до `endAt`, затем грейс → замок.

## Развёртывание на ПК (Фаза 0)

> Требуется PowerShell **от администратора**. Отдельный админ-аккаунт для обслуживания.

```powershell
# 1. Собрать агент
.\deploy\build-agent.ps1                 # -> dist\agent\

# 2. Прописать config.json (seatNumber, kioskKey = KIOSK_API_KEY с сервера, apiUrl)
notepad .\dist\agent\config.json

# 3. Развернуть всё разом: аккаунт + автологин + политики + служба
.\deploy\setup-all.ps1 -Password 'длинный-секрет' -AgentExe 'C:\stopkek\agent\stopkek-agent.exe'

# Откат (для стенда)
.\deploy\uninstall.ps1 -RemoveUser
```

Скрипты по шагам:
| Скрипт | Делает |
|---|---|
| `01-create-player-account.ps1` | не-админ аккаунт `stopkek-player` + автологин |
| `02-apply-policies.ps1` | политики: нет Task Manager, regedit, Run, Win+L, смены юзера |
| `03-install-agent-task.ps1` | SYSTEM-задача Планировщика + авто-restart при падении |
| `build-agent.ps1` | `dotnet publish` агента |
| `setup-all.ps1` / `uninstall.ps1` | оркестратор / откат |

**AppLocker (белый список игр)** — отдельный шаг для прод-образа, зависит от редакции
Windows; см. `docs` (TODO Фаза 0b).

## Конфиг ПК (`agent/config.json`)

```jsonc
{
  "apiUrl": "http://stopkek.site/api",
  "seatNumber": 1,                 // номер места в админке
  "kioskKey": "<KIOSK_API_KEY>",   // секрет с сервера
  "pollIntervalSec": 8,
  "graceSeconds": 300,             // «доиграть» после нуля
  "warnMinutes": [15, 5, 1],
  "lockOnStartup": true,           // fail-secure до первого опроса
  "shellPath": "",                 // путь к shell.exe (Фаза 2)
  "watchdogEnabled": false
}
```

## Превью экрана-замка (без сервера)

Двойной клик по `deploy\RUN-PREVIEW.cmd` — покажет экран-замок во весь экран
(закрывается по **Esc**, без хука клавиатуры, безопасно). Мок прокручивает цикл
LOCKED → ACTIVE (таймер) → GRACE → LOCKED. Или из терминала:

```powershell
dotnet run --project shell\StopkekShell.csproj -- --preview   # безопасный показ
dotnet run --project shell\StopkekShell.csproj -- --mock       # полноценный режим (хук!) с моком
```

## Статус

- [x] Фаза 1 — агент (опрос, машина состояний, IPC, watchdog, грейс, offline-политика)
- [x] Фаза 2–4 — shell UI: экран-замок с QR на всех мониторах, виджет-таймер, тосты,
      грейс, хук клавиатуры в LOCKED, завершение сеанса, DPI-aware (4K/масштаб)
- [x] Фаза 5 (частично) — сервер: **`qrImage`** в state (QR на замке), **per-seat креды**
      (HMAC по месту вместо общего ключа), **телеметрия ПК** (heartbeat + tamper → админка)
- [ ] Фаза 5 (остаток) — **WebSocket** (мгновенная разблокировка) — придержан: рискованно
      без запущенной БД/сервера, заменяет рабочий опрос; сделаем при наличии тестового API
- [ ] Фаза 0b — AppLocker
- [ ] Фаза 6 — стресс-тест взлома (см. `docs/RISKS.md`)

### Ключи киоска (per-seat)
Вместо одного общего `KIOSK_API_KEY` на все ПК каждый ПК получает **свой** ключ —
`HMAC(KIOSK_API_KEY, "stopkek-seat:N")`. Украденный ключ места #5 не подойдёт к #3.
Ключ для ПК берётся в админке: `GET /api/admin/kiosk/seat-key?seatNumber=N` → в `config.json`.
Старый общий ключ принимается для совместимости (отключается `KIOSK_ALLOW_GLOBAL_KEY=false`).
Онлайн ПК и попытки взлома: `GET /api/admin/kiosk/devices`.

> QR на замке появляется, когда сервер начнёт отдавать `qrImage` (base64 PNG) в ответе
> `/kiosk/state` — это пункт Фазы 5. До тех пор показывается заглушка «QR появится здесь».
