# Боевой ПК: запуск прод-подложки на аккаунте `player` (по шагам)

Готовый рунбук для **одного клубного ПК**. Делается один раз на ПК. Модель:
**аккаунт `player`** (обычный, без прав) — туда автологин, там замок; **аккаунт админа** —
отдельный, без подложки, для обслуживания. Аккаунт `player` создаётся скриптом — вручную
заводить не нужно.

> Все PowerShell-команды — **от администратора** (ПКМ по PowerShell → «Запуск от имени администратора»).
> Делай под **админ-аккаунтом** этого ПК (не под `player`).

---

## Часть A. Подготовка ПК (один раз)

1. **Windows 10/11 Pro / Enterprise / Education** (на Home нет AppLocker).
2. Поставить два рантайма .NET 8 (с https://dotnet.microsoft.com/download/dotnet/8.0):
   - **ASP.NET Core Runtime 8.0** (для агента),
   - **.NET Desktop Runtime 8.0** (для shell).
3. **Игры поставить под админом в Program Files** (Steam/Dota 2/CS2/Battle.net/Epic).
4. Убедиться, что **место №N заведено в админке** StopKEK.
5. **Взять ключ места №N** (под админ-JWT):
   `GET https://stopkek.site/api/admin/kiosk/seat-key?seatNumber=N` → скопировать `key`.

---

## Часть B. Положить бинарники

Собери **один раз** на любой машине с .NET 8 SDK (в папке `stopkek-kiosk-v2`):
```powershell
.\deploy\build-agent.ps1     # -> dist\agent\stopkek-agent.exe (+ config.json)
.\deploy\build-shell.ps1     # -> dist\shell\stopkek-shell.exe
```
Скопируй на клубный ПК в **одинаковую на всех ПК** папку:
```
C:\stopkek\agent\   (stopkek-agent.exe + config.json)
C:\stopkek\shell\   (stopkek-shell.exe)
```

---

## Часть C. Заполнить `C:\stopkek\agent\config.json`

Меняется на каждом ПК только `seatNumber` и `kioskKey`. Остальное одинаковое:
```json
{
  "apiUrl": "https://stopkek.site/api",
  "seatNumber": 1,
  "kioskKey": "<ключ места из шага A.5>",
  "pollIntervalSec": 8,
  "graceSeconds": 300,
  "warnMinutes": [15, 5, 1],
  "lockOnStartup": true,
  "shellPath": "C:\\stopkek\\shell\\stopkek-shell.exe",
  "watchdogEnabled": true,
  "adminExitPinHash": "576a2f00ee31a77b738dd4b77d6c65866dd559477a62c52158b767c14fc04f75"
}
```
> `adminExitPinHash` выше — это SHA-256 от PIN `572111` (служебный выход на замке). Свой PIN —
> хэш командой из `INSTALL-CLUB-PC.md`.

---

## Часть D. Установка одной командой (создаёт аккаунт `player`)

В PowerShell от админа, в папке `stopkek-kiosk-v2`:
```powershell
.\deploy\setup-all.ps1 `
  -Password 'ПРИДУМАЙ-ДЛИННЫЙ-СЛУЧАЙНЫЙ-ПАРОЛЬ' `
  -AgentExe 'C:\stopkek\agent\stopkek-agent.exe' `
  -ShellExe 'C:\stopkek\shell\stopkek-shell.exe'
```
Эта команда сделает **всё**:
1. создаст **обычный** (не админ) аккаунт **`player`** + автологин в него с этим паролем;
2. наложит политики-локдаун на `player` (нет Диспетчера задач, regedit, «Выполнить», Win+L, смены юзера);
3. поставит **агент** SYSTEM-задачей (старт при загрузке, авто-restart);
4. поставит **shell** задачей входа **только для `player`** (замок рисуется в его сессии).

> Пароль `player` нигде вводить не нужно (автологин). Запиши его себе — пригодится для отката.

---

## Часть E. AppLocker (белый список игр)

```powershell
.\deploy\04-applocker-games.ps1 -AuditOnly      # сначала аудит
# зайти, запустить КАЖДУЮ игру/лаунчер по разу
# Event Viewer -> Applications and Services Logs\Microsoft\Windows\AppLocker -> EXE/DLL
# если что-то «would be blocked» в нестандартной папке — добавить её и включить «жёстко»:
.\deploy\04-applocker-games.ps1                 # без -AuditOnly = enforce
```

---

## Часть F. Перезагрузка и проверка

**Перезагрузи ПК.** Должно произойти:
- автологин в **`player`**;
- агент уже работает (стартовал при загрузке), shell нарисовал **замок с QR**;
- в админке `GET /api/admin/kiosk/devices` место №N → `online: true`.

Чек-приёмки (из `RISKS.md`): Диспетчер задач недоступен под `player`; перевод часов не даёт времени;
обрыв сети в игре — доигрывает; kill shell → ОС лочится и shell поднимается.

---

## Часть G. Как зайти админом и как снять

**Зайти под админом** (для обслуживания):
- На замке нажми ✕ (справа вверху) → введи PIN `572111` → подложка уйдёт в обслуживание до перезагрузки. Дальше можно работать. **Или**
- `Ctrl+Alt+Del` (хук его не ловит) → сменить пользователя/войти под админ-аккаунтом.

**Снять подложку полностью** (вернуть обычный ПК):
```powershell
.\deploy\uninstall.ps1 -RemoveUser
```
Снимает обе задачи (агент+shell), политики, автологин и удаляет аккаунт `player`.
**ПК при этом не ломается** — Windows и админ-аккаунт целы; просто киоск выключается.

---

## Памятка: что одинаково / что разное на ПК

| | Одинаково на всех ПК | Разное на каждом ПК |
|---|---|---|
| Бинарники agent+shell | ✅ (собрал раз, скопировал) | — |
| Папка `C:\stopkek\` | ✅ | — |
| `apiUrl`, `adminExitPinHash`, скрипты, AppLocker | ✅ | — |
| `config.json` → `seatNumber` | — | 1, 2, 3 … |
| `config.json` → `kioskKey` | — | ключ своего места |
