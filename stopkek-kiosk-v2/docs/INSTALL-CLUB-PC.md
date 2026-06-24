# Установка защитной подложки StopKEK на клубный ПК

Пошагово: как развернуть подложку на **новом** ПК клуба так, чтобы место блокировалось
до оплаты и разблокировалось телефоном через сервер. В конце — как протестировать
**ПК №1 (эта машина, место 1)** через мобильное приложение.

> Все команды PowerShell — **от администратора**. Игрок при этом работает под
> отдельным аккаунтом без прав (`stopkek-player`) — на этом держится вся защита.

---

## 0. Что именно ставится (две роли)

| Процесс | Под кем | Запуск | Роль |
|---|---|---|---|
| **agent** (`stopkek-agent.exe`) | SYSTEM | задача планировщика при загрузке | держит «гейт»: опрашивает сервер, считает время, шлёт heartbeat/tamper, страховочная блокировка ОС. Игрок убить не может. |
| **shell** (`stopkek-shell.exe`) | `stopkek-player` | задача планировщика при входе | рисует экран-замок с QR, таймер, предупреждения. Связь с агентом — именованный канал. |

Сервер — единственный источник правды: разблокировка ставит `pcUnlockedAt`, агент на
следующем опросе (≤8с) видит `active`. Истечение: `active → grace (доиграть, по умолч. 300с) → locked`.

---

## 1. Предусловия (один раз на ПК)

1. **Windows 10/11 Pro / Enterprise / Education** (нужен AppLocker; на Home — нет).
2. Установить два рантайма .NET 8 (один раз, с офсайта https://dotnet.microsoft.com/download/dotnet/8.0):
   - **ASP.NET Core Runtime 8.0** — для агента,
   - **.NET Desktop Runtime 8.0** — для shell (WPF).
3. Место №N **заведено в админке** (соло-капсула с нужным номером).
4. Игры ставит **админ в Program Files** (Steam/CS2/Dota2/Battle.net/Epic) — тогда AppLocker
   из коробки их разрешает, а игрок свои `.exe` запустить не сможет.

---

## 2. Получить per-seat ключ места

Каждый ПК получает **свой** ключ (HMAC мастер-секрета по номеру места) — украденный ключ
места №5 не подойдёт к №3. В админке (под админ-JWT):

```
GET /api/admin/kiosk/seat-key?seatNumber=N   ->   { seatNumber, key }
```

Скопируй `key` — это `kioskKey` для `config.json` ниже. (Мастер-ключ `KIOSK_API_KEY` живёт
только на сервере; в проде общий ключ как заголовок выключен — `KIOSK_ALLOW_GLOBAL_KEY=false`.)

---

## 3. Собрать агент и shell

На машине-сборщике (или на этом же ПК), в папке `stopkek-kiosk-v2`:

```powershell
.\deploy\build-agent.ps1     # -> dist\agent\stopkek-agent.exe (+ config.json)
.\deploy\build-shell.ps1     # -> dist\shell\stopkek-shell.exe
```

Разложить на целевом ПК, например:

```
C:\stopkek\agent\stopkek-agent.exe   (+ config.json рядом)
C:\stopkek\shell\stopkek-shell.exe
```

---

## 4. Заполнить `config.json` (рядом с агентом)

```jsonc
{
  "apiUrl": "https://stopkek.site/api",   // боевой сервер
  "seatNumber": 1,                          // номер места из админки
  "kioskKey": "<per-seat ключ из шага 2>",
  "pollIntervalSec": 8,
  "graceSeconds": 300,
  "warnMinutes": [15, 5, 1],
  "lockOnStartup": true,                    // fail-secure до первого опроса
  "shellPath": "C:\\stopkek\\shell\\stopkek-shell.exe",
  "watchdogEnabled": true
}
```

> `shellPath` + `watchdogEnabled:true` нужны, чтобы SYSTEM-агент перезапускал shell и
> страховочно лочил ОС, если оверлей убили. Рисуется shell задачей из шага 5.

---

## 5. Развернуть на ПК (аккаунт + политики + задачи)

```powershell
# 5.1 аккаунт игрока + автологин + lockdown-политики + SYSTEM-задача агента
.\deploy\setup-all.ps1 -Password 'ДЛИННЫЙ-СЛУЧАЙНЫЙ-СЕКРЕТ' `
                       -AgentExe 'C:\stopkek\agent\stopkek-agent.exe'

# 5.2 задача shell в сессии игрока (оверлей виден на экране)
.\deploy\05-install-shell-task.ps1 -ShellExe 'C:\stopkek\shell\stopkek-shell.exe'

# 5.3 AppLocker: сначала в режиме аудита, прогнать все игры, потом включить
.\deploy\04-applocker-games.ps1 -AuditOnly
#   ... запустить каждую игру/лаунчер по разу ...
#   Event Viewer -> Applications and Services Logs\Microsoft\Windows\AppLocker -> EXE/DLL
#   если что-то «would be blocked» в нестандартной папке — добавить её:
.\deploy\04-applocker-games.ps1 -GamesPaths 'C:\Riot Games','D:\Games'
```

`setup-all.ps1` выполняет по шагам: `01-create-player-account` → `02-apply-policies`
(нет Диспетчера задач/regedit/Run/Win+L/смены юзера/выхода) → `03-install-agent-task`
(SYSTEM-задача с авто-restart ×3).

**Перезагрузить ПК.** После ребута: автологин в `stopkek-player`, агент стартует,
место в `LOCKED`, на экране — замок с QR.

---

## 6. Чеклист приёмки (из `docs/RISKS.md`)

- [ ] Диспетчер задач/regedit/Run недоступны под игроком
- [ ] kill `stopkek-shell.exe` → ОС лочится и shell поднимается < 2с
- [ ] попытка остановить задачу/службу под игроком → отказ
- [ ] перевод системных часов вперёд → время не прибавилось (монотонный таймер)
- [ ] обрыв сети в игре → доигрывает до `endAt`, затем грейс → замок
- [ ] обрыв сети в LOCKED → остаётся замок
- [ ] reboot во время сессии → состояние восстановлено с сервера
- [ ] мультимонитор → замок на всех экранах
- [ ] игрок НЕ может запустить свой `.exe` с флешки/рабочего стола (AppLocker)
- [ ] онлайн ПК виден в админке: `GET /api/admin/kiosk/devices` → `online:true`

---

## 7. Тест ПК №1 (эта машина = место 1) через приложение

Цель — пройти полный путь как реальный клиент: телефон → сервер → разблокировка этого ПК.

1. **Сервер.** Боевой `https://stopkek.site/api` (после заливки бэка), либо локальный
   стенд (см. `LOCAL-TESTING.md`). `config.json` агента → на тот же `apiUrl`.
2. **Подложка на этом ПК.** Для безопасной проверки рендера — `RUN-PREVIEW.cmd` (Esc — выход).
   Для боевого режима — шаги 3–5 выше (учти: включится хук клавиатуры и блокировка).
3. **Мобильное приложение** (`stopkek-mobile`) укажи на тот же сервер:
   `EXPO_PUBLIC_API_URL=https://stopkek.site/api`, затем вход по SMS, пополнение, бронь места №1.
4. **Разблокировка:** на замке крутится QR — отсканируй приложением (оно бьёт
   `confirm-qr` своим JWT) **или** введи PC-код. Сервер ставит `pcUnlockedAt` → подложка
   на этом ПК уходит в `active`, таймер пошёл. По истечении → грейс → снова замок.

> Полный сценарий end-to-end (вход→бронь→оплата→`active`→`locked`) уже прогонялся через
> API и подтверждён — см. историю в `LOCAL-TESTING.md`.

---

## 8. Обновление подложки на ПК

```powershell
.\deploy\build-agent.ps1 ; .\deploy\build-shell.ps1
# заменить exe в C:\stopkek\..., затем:
Restart-ScheduledTask -TaskName StopkekAgent
# shell перезапустится при следующем входе игрока (или Restart-ScheduledTask StopkekShell)
```

## 9. Откат (для стенда)

```powershell
.\deploy\uninstall.ps1 -RemoveUser
# AppLocker снять: очистить политику (пустой XML) + остановить AppIDSvc
```

---

## Известные ограничения

- **Session 0**: рендер оверлея обеспечивает задача shell в сессии игрока (шаг 5.2).
  SYSTEM-watchdog — это страховка (relaunch + блокировка ОС + tamper-событие); проверь
  поведение «kill shell» на реальном железе по чеклисту.
- **AppLocker** требует Pro/Enterprise/Education и службу AppIDSvc (скрипт включает её).
- **Замки двери** и платёжный шлюз — отдельные интеграции, к подложке не относятся.
