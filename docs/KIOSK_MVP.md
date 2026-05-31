# PC Kiosk MVP — stopkek

## Экосистема

```
Мобилка (Expo)  ──JWT──►  API /api  ◄──X-Kiosk-Key──  Windows подложка
Админка (Vite)  ──JWT──►  API /api
```

Публичный URL: `http://stopkek.site` (потом HTTPS):

| Путь | Кто |
|------|-----|
| `/` | Админка |
| `/api` | Backend |
| `/api/kiosk/state` | Подложка (poll) |
| `/api/kiosk/unlock` | Подложка (код) |
| `/api/kiosk/bookings/:id/pc-code` | Мобилка (JWT) |

## Поток для клиента

1. **Заблокированный ПК** — заставка «Оплатите в приложении stopkek».
2. Бронь + оплата в мобилке.
3. **Сеанс → «Сканировать QR на мониторе»** — камера телефона.
4. На ПК показан **QR** → телефон подтверждает → **активный экран**: таймер, баланс, зона, предупреждение за 15 мин.
5. **Время кончилось** — полноэкранный блок «Время вышло» (продление только в приложении).

Вход по SMS/звонку на ПК **не делаем** — только мобилка.

## Настройка

**Сервер** (`deploy/.env.prod`):

```env
KIOSK_API_KEY=длинный-секрет
PUBLIC_API_URL=http://stopkek.site/api
```

Миграция: `pcUnlockedAt` на `Booking`.

**Каждый ПК** (`stopkek-kiosk/config.json`):

```json
{
  "apiUrl": "http://stopkek.site/api",
  "seatNumber": 1,
  "kioskKey": "stopkek-kiosk-prod-2026"
}
```

## Дальше (не MVP)

- QR-камера на ПК (сейчас ввод 6 цифр)
- Блокировка ввода Win+D / Alt+Tab (хуки ОС)
- WebSocket вместо poll 8 сек
- Привязка seat ↔ hostname в админке
- Запуск игр / Steam из подложки

См. `docs/TECHNICAL_SPEC.md` §4.10, `docs/SPRINTS.md` S-05.
