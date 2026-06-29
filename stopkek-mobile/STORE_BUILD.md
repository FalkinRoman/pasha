# Сборка в App Store / Google Play

```bash
npm i -g eas-cli
eas login
eas init   # привязка projectId в app.json
```

## Production

```bash
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

## Скриншоты App Store

Готовые PNG **1284×2778** (iPhone 6.5"):

```
stopkek-mobile/store-assets/output/iphone-65/
```

Порядок загрузки: `01-welcome` → `02-map` → `03-home` → `04-session` → `05-login`

Перегенерация: см. `stopkek-mobile/store-assets/README.md`

## URLs для App Store Connect

| Поле | Значение |
|------|----------|
| Privacy Policy | https://stopkek.site/privacy |
| Support URL | https://stopkek.site/support |
| Marketing URL | https://stopkek.site/support |

## App Review — что вписать в форму

**Необходимо войти:** да

| Поле | Значение |
|------|----------|
| Имя пользователя | `+79001234567` |
| Пароль | `1234` |

**Примечания (Review Notes):**

```
Бронирование мест в компьютерном клубе (офлайн-услуга).
Оплата через ЮKassa во внешнем браузере, IAP не используется.

Демо-вход:
1. Введите номер +7 (900) 123-45-67
2. Нажмите «Позвонить мне» (реальный звонок не придёт — тестовый аккаунт)
3. Введите код 1234 (последние 4 цифры «звонка»)

На аккаунте уже есть баланс 5000 ₽ для теста брони.
Верификация паспорта для этого номера пройдена.
Камера — для верификации и QR на ПК в клубе.
```

**На VPS** (в `deploy/.env.prod`):

```env
REVIEW_LOGIN_PHONE=+79001234567
REVIEW_LOGIN_CODE=1234
```

После деплоя:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T api npx tsx prisma/seed-review-user.ts
```

Полный roadmap: `docs/RELEASE_ROADMAP.md`
