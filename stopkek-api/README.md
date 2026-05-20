# stopkek-api

NestJS + PostgreSQL + Prisma. Спринт S-01.

## Быстрый старт

```bash
cd "/Users/romanitgod/Desktop/Проекты работа/pasha/stopkek-api"
# из stopkek-mobile: cd ../stopkek-api
cp .env.example .env
npm install
npm run db:up
npm run prisma:migrate
npm run admin:create      # ADMIN_EMAIL + ADMIN_PASSWORD в .env
npm run bootstrap:club    # зоны и 25 мест (один раз)
npm run start:dev
```

Очистка всех данных (как пустой прод):

```bash
npm run db:clear
npm run admin:create
npm run bootstrap:club
```

Без демо-пользователей и фейковых броней. `bootstrap:club` — только карта зала.

- Health: `GET http://localhost:3001/api/health`
- Flash-call auth: `POST /api/auth/call/request`, `POST /api/auth/call/verify`
- Карта: `GET /api/club/floor-map`

Демо-код: `1234` (см. `MOCK_CALL_CODES` в `.env`).

## Дальше по плану

1. JWT guard на защищённые роуты
2. `POST /bookings` + conflict check
3. WebSocket `seat.status`
4. Redis для OTP-сессий
5. YooKassa (S-03)
