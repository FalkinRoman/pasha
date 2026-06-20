# Деплой stopkek на VPS (Docker)

## Что поднимается

| Сервис | Назначение |
|--------|------------|
| **postgres** | БД |
| **api** | NestJS, миграции при старте |
| **admin** | Статика Vite |
| **gateway** | nginx: `/` → админка, `/api` → бэкенд |

Мобилка **не в Docker** — у заказчика локально Expo → ваш `https://домен/api`.

---

## Ресурсы VPS (старт / демо)

| Профиль | vCPU | RAM | SSD | Кому |
|---------|------|-----|-----|------|
| **Минимум** | 2 | 2 GB | 30 GB | тест, 1 клуб, до ~50 юзеров |
| **Норма** | 2 | **4 GB** | **40 GB** | заказчик + прод демо |
| Запас | 4 | 8 GB | 80 GB | много фото паспортов, рост |

ОС: **Ubuntu 22.04/24.04**. Открыть порты: **80**, **443** (если HTTPS), **22** (SSH).

Redis в коде не используется — не нужен.

---

## 1. Сервер

```bash
sudo apt update && sudo apt install -y git docker.io docker-compose-v2
sudo usermod -aG docker $USER
# перелогинься
```

Домен `A` → IP VPS. Для HTTPS — Caddy/Certbot на gateway (отдельно).

---

## 2. Клон и env

```bash
git clone https://github.com/FalkinRoman/pasha.git stopkek && cd stopkek
cp deploy/.env.prod.example deploy/.env.prod
nano deploy/.env.prod   # пароли, JWT, SMSRU, SMTP, PUBLIC_* URL
```

`PUBLIC_API_URL` и `VITE` при сборке админки = **тот же URL**, что видит браузер:  
`https://ваш-домен.com/api`

`CORS_ORIGINS` — тот же origin админки (+ при необходимости `http://IP` для Expo).

---

## 3. Запуск

```bash
cd deploy
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Проверка:

```bash
curl http://127.0.0.1/api/health
# браузер: http://IP/  — админка
```

Первичные данные (админ, клуб, места):

```bash
chmod +x init-server.sh
./init-server.sh
```

---

## 4. HTTPS (рекомендуется)

Перед продом: Let's Encrypt на `gateway` или отдельный Caddy впереди.  
Без HTTPS iOS/Expo с реальным доменом могут ругаться — для демо по IP иногда ок в dev-клиенте.

---

## 5. Мобилка у заказчика

Репозиторий / папка `stopkek-mobile`:

```bash
cd stopkek-mobile
cp .env.example .env
```

В `.env`:

```env
EXPO_PUBLIC_API_URL=https://ваш-домен.com/api
```

```bash
npm install
npx expo start
```

Телефон в той же сети или Expo Go + tunnel (`npx expo start --tunnel`), если VPS в интернете.

**Важно:** на VPS в `.env.prod` должен быть рабочий `SMSRU_API_ID`, иначе вход только с mock-кодом если в dev включён `MOCK_CALL_CODES` (в prod лучше не оставлять).

---

## 6. Чеклист готовности

- [ ] `GET /api/health` → ok
- [ ] Админка: логин `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- [ ] Мобилка: звонок/SMS вход, бронь, открытие двери → строка в **Журнал доступа**
- [ ] Фото паспорта пишутся в volume `uploads`
- [ ] Бэкап: `pgdata` volume + `uploads` volume

---

## 7. Обновление версии

```bash
git pull
cd deploy
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Миграции применятся при рестарте `api`.

---

## Что НЕ на VPS сейчас

- **Замки** — `mock` в настройках; реальный HTTP/MQTT — когда будет API клуба
- **Windows-клиент на ПК** — отдельный этап
- **Публикация в App Store** — EAS build, не этот compose
