# stopkek-kiosk-v2 — статус тестирования (на 2026-06-27)

Машина DESKTOP-6IVDTCL, только диск C:, Win11 Pro. Claude работает в админ-сессии
`bored`; на учётке `player` Claude нет — под player смотрим глазами на экран, команды
выполняются из админ-сессии. Полные тех.детали — в памяти Claude:
`stopkek-kiosk-overlay` и `stopkek-kiosk-prod-handoff`.

---

## 🆕 Итерация 2026-06-29 (ветка feat/kiosk-instant-overlay-6pc-games)

1. **Мгновенная подложка при завершении сеанса.** `agent/Worker.cs`: основной цикл спит
   прерываемо (`_wakeCts`); при IPC `end-session` после ответа сервера вызывается `Poke()`
   → немедленный re-poll → замок ≈ за 1 сек вместо ~8 сек. Сборка + юнит-тесты зелёные.
2. **Игры с любого диска.** `deploy/04-applocker-games.ps1`: авто-поиск папок игр на ВСЕХ
   фиксированных дисках (Riot/Games/Steam/SteamLibrary/Epic/Battle.net/Rockstar/WoT/MAJESTIC/
   GTA5RP/Astrum), слияние с `-GamesPaths`, новый `-LockAcls` (закрыть запись игроку, только
   при enforce), `-NoAutoDiscover`. Один скрипт на все ПК.
3. **6 ПК.** `stopkek-api/prisma/floor-layout.ts`: 6 капсул сетка 3×2 (холст 360×190 не
   меняется); `reseed-solo-floor.ts` лог «6 мест»; `bootstrap-club.ts` строит из массива авто.
   Мок мобилки `stopkek-mobile/src/mock/data.ts` → 6. На сервере после pull: `npm run
   floor:reseed:force` + рестарт API. kiosk-сервис лимита мест не имеет — 5–6 работают сразу.
4. **Упаковка.** `deploy/make-release.ps1` собирает бандл+zip; `install.ps1` — пошаговый
   установщик (копия в C:\stopkek, config под место, setup-all, ACL-лок C:\stopkek, AppLocker
   audit); `УСТАНОВИТЬ.cmd` (самоэлевация+Unblock+RemoteSigned); `УСТАНОВКА.txt` — печатная
   инструкция; `config.template.json`. Бандл собран и проверен локально (release/, gitignored).

> Старый Electron-киоск и desktop-файлы `00_ЧИТАЙТЕ`/`deploy pc01-04` — устаревшие, в пакет v2
> не входят.

---

## ✅ СДЕЛАНО (в коде / в системе)

1. **Подложка** — фикс ACL пайпа + дедлок IPC + сброс maintenance при перелогине.
   Влито в `main` (origin github.com/FalkinRoman/pasha.git). Подтверждено в бою.
2. **DNS-хвост** разобран (была http→301→https; config на https, поллы идут).
3. **Локдаун player (политики)** применён через reg.exe: DisableTaskMgr,
   DisableRegistryTools, DisableLockWorkstation, DisableChangePassword,
   Explorer NoRun/NoControlPanel. Вступает при входе player.
4. **🔴 КРИТ. дыра закрыта**: `C:\` раздавал Authenticated Users write по наследству →
   player мог перезаписать `stopkek-agent.exe` (SYSTEM). Закрыл `C:\stopkek`
   (Users RX, SYSTEM/Admins F; config.json — только SYSTEM+Admins).
5. **AppLocker** в режиме **AuditOnly** (логирует, НЕ блокирует). Белый список:
   %PROGRAMFILES% + %WINDIR% + C:\stopkek + C:\Riot Games + C:\Games. AppIDSvc=Auto.
6. **Ослабление локдауна player** (новое, по запросу — чтобы из player попадать в админа):
   - `HKLM\...\Policies\System\HideFastUserSwitching = 0` → «Сменить пользователя».
   - hive player `...\Policies\Explorer`: `NoLogoff=0`, `StartMenuLogOff=0` → «Выход».
   - `NoClose=0` → «Завершение работы» / «Перезагрузка».
   - Остальной локдаун (Task Manager, Run, Control Panel, смена пароля, Win+L) — НЕ тронут.

---

## ⏳ НЕ СДЕЛАНО / НЕ ПРОТЕСТИРОВАНО (нужен заход под player)

### Тест E — ослабление локдауна (НОВОЕ, ещё не проверял)
- [ ] Войти под `player`.
- [ ] `Ctrl+Alt+Del` → видны **«Сменить пользователя»**, **«Выход»**, **кнопка питания**
      (выключение/перезагрузка).
- [ ] Через «Сменить пользователя»/«Выход» → экран входа → зайти под `bored` (админ).
- [ ] Контроль локдауна: `Ctrl+Shift+Esc` (Task Manager) НЕ открывается, `Win+R` (Run)
      недоступен.
- ⚠️ Для player вступает в силу при **следующем входе** (не на текущей сессии).

### Тест B — регрессия подложки + watchdog (pending)
- [ ] Ребут → вход player → подложка появляется СРАЗУ.
- [ ] Диспетчер задач / Win+L / Run закрыты.
- [ ] Watchdog: убить `stopkek-shell.exe` → агент перезапускает shell и держит LOCKED.

### Тест/задача D — enforce AppLocker (pending, audit готов)
- [ ] Под player прогнать каждую игру (Steam, GTA5RP, MAJESTIC, WoT, Riot).
- [ ] Я читаю лог: Event Viewer → Microsoft\Windows\AppLocker\EXE+DLL → событие **8003**
      «would have been blocked» → добавляю недостающие папки в `-GamesPaths`.
- [ ] Закрыть ACL `C:\Games` и `C:\Riot Games` (Users RX, убрать Authenticated Users write).
- [ ] Перезапустить `deploy\04-applocker-games.ps1` **БЕЗ** `-AuditOnly` (enforce).
- Запуск ps1: `powershell.exe -NoProfile -Command "Set-ExecutionPolicy -Scope Process
  RemoteSigned -Force; & '<путь>\deploy\04-applocker-games.ps1' -GamesPaths 'C:\Riot Games','C:\Games'"`
  (машина Restricted; `-ExecutionPolicy Bypass` режет авто-классификатор → НЕ использовать).

### Опционально
- [ ] ACL всего корня `C:\` (широкий риск — отдельно, осторожно).

---

## Шпаргалка по среде
- PowerShell-инструмент у Claude НЕ работает → всё через Bash (Git Bash);
  `powershell.exe` вызывается из Bash.
- Флаги `icacls`/`reg`/`schtasks` писать с **двойным слэшем** (`//T`, `//grant:r`, `//v`, `//d`).
- dotnet: `/c/Program Files/dotnet/dotnet.exe`.
- Правка hive player: player должен быть РАЗЛОГИНЕН →
  `reg load "HKU\STOPKEK_PLAYER" "C:\Users\player\NTUSER.DAT"` → правка → `reg unload`.
- SID player: `S-1-5-21-907381823-4104812823-1825782369-1003`.
- План последнего изменения: `C:\Users\bored\.claude\plans\linear-drifting-kay.md`.

## Откат ослабления локдауна (если нужно вернуть киоск-жёсткость)
Те же 4 значения с `//d 1`: `HideFastUserSwitching`, `NoLogoff`, `StartMenuLogOff`, `NoClose`.
