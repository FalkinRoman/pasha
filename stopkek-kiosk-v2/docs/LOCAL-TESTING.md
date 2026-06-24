# Локальное тестирование подложки (kiosk-v2) с бэком на этом ПК

Цель: поднять `stopkek-api` локально и прогнать связку **агент ↔ бэк** на текущем ПК,
найти баги, убедиться что работает — перед заливкой бэка на VPS-прод.

> Вебсокеты **пока не делаем** (их нет ни в бэке, ни в агенте — интеграция на HTTP-поллинге).
> Сначала проверяем поллинг end-to-end, вебсокеты — отдельным шагом потом.

---

## Шаг 0 — WSL (один раз, нужен админ + перезагрузка)

Docker Desktop на этом ПК не стартует, потому что **не установлен WSL2**. Поставить:

```powershell
# PowerShell ОТ АДМИНИСТРАТОРА
wsl --install
```

Команда включит компоненты «Подсистема Windows для Linux» + «Платформа виртуальной машины»,
скачает ядро и дистрибутив Ubuntu. Затем **перезагрузить ПК**.

После перезагрузки: запустить **Docker Desktop**, дождаться статуса *Engine running* (кит в трее).
Проверка: `docker run --rm hello-world` должен отработать.

> CPU-виртуализация на этом ПК уже включена — отдельно в BIOS лезть не нужно.

---

## Шаг 1 — поднять бэк (одна команда)

`.env` для локали уже создан (`stopkek-api/.env`, БД на `localhost:5434`, Redis `localhost:6379`).

```powershell
cd C:\Users\bored\OneDrive\Desktop\pasha-main\stopkek-api
powershell -ExecutionPolicy Bypass -File .\start-local.ps1
```

Скрипт: поднимет Postgres+Redis, накатит миграции, засеет клуб (4 соло-капсулы, место №1),
pricing и админа, затем запустит `npm run start:dev` на `http://localhost:3001/api`.

Только инфраструктура без запуска Nest: добавить `-NoServe`, потом `npm run start:dev` вручную.

**Доступы после сидинга:** админ `stopkeksprt@yandex.ru` / `admin12345` (из `.env`),
mock-код входа в мобилке/звонке — `1234`.

---

## Шаг 2 — проверить эндпоинты киоска напрямую

В отдельном окне (бэк уже крутится):

```powershell
$key = 'stopkek-kiosk-prod-2026'
# Состояние места №1 — ждём state=locked + qrPayload + qrImage(base64 PNG)
curl.exe -s -H "X-Kiosk-Key: $key" "http://localhost:3001/api/kiosk/state?seatNumber=1"
```

Чек-лист ответа:
- `state: "locked"`, есть `qrPayload`, `qrRefreshSec`, `qrImage` (длинная data:image/png;base64,...).
- Неверный ключ (`-H "X-Kiosk-Key: nope"`) → `401`.
- Несуществующее место (`seatNumber=999`) → `404 «Место не найдено»`.

---

## Шаг 3 — запустить агент (БЕЗОПАСНО, экран НЕ блокирует)

Важно: **агент сам по себе НЕ блокирует Windows** — он только опрашивает сервер и пишет
состояние в named pipe для shell. Залочить экран может только **shell** в режиме LOCKED.
Поэтому агент в консоли гонять безопасно.

```powershell
cd C:\Users\bored\OneDrive\Desktop\pasha-main\stopkek-kiosk-v2
dotnet run --project agent\StopkekAgent.csproj
```

Ждём в логах:
- `stopkek-agent up. seat=1 api=http://localhost:3001/api ...`
- успешные опросы без `state poll failed` (Online), `Mode=Locked`.
- В админке `GET /api/admin/kiosk/devices` место №1 станет `online: true` (heartbeat дошёл).

Остановить: `Ctrl+C`.

---

## Шаг 4 — UI экрана-замка (безопасный preview, без хука клавиатуры)

```powershell
cd C:\Users\bored\OneDrive\Desktop\pasha-main\stopkek-kiosk-v2
dotnet run --project shell\StopkekShell.csproj -- --preview   # Esc — выход
```

> `--mock` запускает полноценный режим с хуком клавиатуры — на dev-ПК осторожно (может
> перехватывать клавиши). Для проверки рендера достаточно `--preview`.

---

## Шаг 5 — полный сценарий разблокировки (агент видит active)

Нужны пользователь + оплаченная бронь места №1. Кратко через API мобилки:

1. Вход по SMS-моку: `POST /api/auth/sms/...` (код `1234`) → получить JWT.
2. Создать/оплатить бронь места №1 (mock-кошелёк включён: `WALLET_MOCK_TOPUP=true`).
3. На замке агент крутит QR с `challengeId`. Разблокировка:
   - `POST /api/kiosk/bookings/:id/confirm-qr` с `{ challengeId }` и JWT, **или**
   - `POST /api/kiosk/bookings/:id/pc-code` → код → `POST /api/kiosk/unlock { seatNumber, code }`.
4. Сервер ставит `pcUnlockedAt` → на следующем опросе (≤8с) агент видит `state: active`,
   лог `Mode=Active`, таймер пошёл вниз. По истечении → `Grace` → снова `Locked`.

> Точные пути аутентификации/броней — в `stopkek-api/src` (модули `auth`, `bookings`).
> Этот шаг проще прогнать через мобилку/Postman, когда бэк уже поднят.

---

## Что уже сделано (prep этой сессии)

- `stopkek-api/.env` — локальный конфиг (БД/Redis/ключи/админ).
- `stopkek-api/start-local.ps1` — однокомандный подъём стека.
- `agent/config.json` — нацелен на `http://localhost:3001/api`, ключ = `stopkek-kiosk-prod-2026`, место 1.
- Агент собирается, юнит-тесты машины состояний: **8/8 PASS**.
- Контракт `/kiosk/state` ↔ `KioskStateDto` сверён — совпадает.

## Известные ограничения / на потом

- **Вебсокеты** (мгновенная разблокировка) — не реализованы, отдельный шаг.
- Телеметрия и per-seat online-статус — **in-memory**, теряются при рестарте API (by design).
- AppLocker (белый список игр) — Фаза 0b, не для локального теста.
