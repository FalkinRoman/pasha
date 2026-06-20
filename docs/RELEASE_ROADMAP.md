# Roadmap: сторы, юридика, ЮKassa — stopkek

Статус на июнь 2026: API + админка + киоск + мобилка на `https://stopkek.site`, HTTPS ок.

---

## Рекомендация по оплате (лучший путь для нас)

| Этап | Схема | Зачем |
|------|--------|--------|
| **v1 (релиз в сторы)** | **Redirect ЮKassa** — уже в коде (`confirmation_url` → браузер/Safari → `stopkek://`) | Быстро, без native SDK, Apple/Google **разрешают** внешнюю оплату для **офлайн-услуги** (аренда места в клубе) |
| **v2 (после запуска)** | Mobile SDK + `payment_token` | Нативная форма, если ЮKassa потребует при проверке или захотите UX без браузера |

**Не используем** Apple IAP / Google Play Billing — мы продаём **услугу клуба**, не цифровой контент в приложении.

---

## Фаза 0 — Данные от вас (блокер для юридики)

Заполните `deploy/public/legal.config.json` (шаблон в репо) или пришлите текстом:

| Поле | Пример | У нас |
|------|--------|--------|
| Полное наименование | ИП Левков Павел … | ? |
| ИНН | 12 цифр | ? |
| ОГРНИП | 15 цифр | ? |
| Юр. адрес | по ЕГРИП | ? |
| Адрес клуба | фактический | ? |
| Email поддержки | stopkeksprt@yandex.ru | есть |
| Телефон поддержки | +7 … | ? |
| Режим работы | 24/7 | есть в БД |
| Политика возвратов | без возврата остатка; продление в приложении | ✅ |

---

## Фаза 1 — Юридика на сайте (1–2 дня)

**Цель:** публичные URL для сторов и ЮKassa.

| URL | Назначение |
|-----|------------|
| `https://stopkek.site/privacy` | Политика конфиденциальности (обязательно App Store) |
| `https://stopkek.site/terms` | Пользовательское соглашение |
| `https://stopkek.site/offer` | Публичная оферта на услуги клуба |
| `https://stopkek.site/support` | Контакты поддержки |

Админка остаётся на `https://stopkek.site/` (логин).

**Деплой:** `deploy/public/` + nginx (см. `deploy/nginx-gateway*.conf`).

После деплоя — те же тексты в мобилке (`src/constants/legal.ts`) и ссылки на экране входа.

---

## Фаза 2 — Подготовка мобилки к сторам (3–7 дней)

### Apple App Store

1. Apple Developer Program ($99/год) — аккаунт организации/ИП
2. `eas.json` + `eas build --platform ios`
3. App Store Connect:
   - **Privacy Policy URL:** `https://stopkek.site/privacy`
   - **Support URL:** `https://stopkek.site/support`
   - **Category:** Lifestyle / Entertainment
   - **Age rating:** 12+ (камера, паспорт)
4. В Review Notes указать:
   - «Приложение для бронирования мест в компьютерном клубе stopkek»
   - «Оплата — внешняя, услуга оказывается офлайн в клубе, IAP не используется»
   - Тестовый аккаунт: телефон + mock/реальный вход

### Google Play

1. Google Play Console ($25 разово)
2. `eas build --platform android` (AAB)
3. Data safety: телефон, имя, фото документа, платёжные данные **не** собираем (оплата у ЮKassa)
4. Privacy policy URL — тот же

### Скриншоты для сторов и ЮKassa

Минимум 5 экранов **с ценами в ₽**:
- карта мест / тариф зоны
- summary брони
- пополнение кошелька
- активный сеанс + QR
- профиль / баланс

---

## Фаза 3 — ЮKassa (параллельно с фазой 2)

### Анкета (вы выбрали «мобильное приложение»)

1. **Что продаёте:** бронирование и оплата игровых мест, пополнение баланса
2. **Ссылка:** App Store / Google Play (после публикации) — до этого не отправлять на финальную проверку
3. **Скрины:** с ценами (см. выше)
4. **Чеки 54-ФЗ:** следующий шаг в ЛК — чеки через ЮKassa или своя касса
5. Договор → **shopId + secretKey**

### На VPS (`deploy/.env.prod`)

```env
YOOKASSA_SHOP_ID=...
YOOKASSA_SECRET_KEY=...
YOOKASSA_RETURN_URL=stopkek://wallet/topup/success
WALLET_MOCK_TOPUP=false
```

```bash
cd ~/stopkek/deploy
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build api
```

### Redirect v1 — уже работает

```
Мобилка → POST /wallet/topup → API → ЮKassa redirect
→ Safari/Chrome → оплата → stopkek:// → «Проверить оплату»
```

Для анкеты: можно указать менеджеру, что на v1 используется **redirect**, SDK — в roadmap v2.

---

## Фаза 4 — После одобрения сторов + ЮKassa

1. Production-билды: `eas submit`
2. Включить реальную оплату на проде (`WALLET_MOCK_TOPUP=false`)
3. E2E: пополнение → бронь → оплата сеанса → QR на киоске
4. Мониторинг: админка → транзакции
5. (Опционально) v2 Mobile SDK

---

## Чеклист «готовы к релизу»

- [ ] `legal.config.json` заполнен реквизитами ИП
- [ ] `/privacy`, `/terms`, `/offer`, `/support` открываются без логина
- [ ] Мобилка: ссылки на legal на экране входа
- [ ] `EXPO_PUBLIC_API_URL=https://stopkek.site/api` в production build
- [ ] EAS: iOS + Android билды
- [ ] Скриншоты с ценами
- [ ] ЮKassa: договор, ключи на сервере
- [ ] `WALLET_MOCK_TOPUP=false`
- [ ] Тестовый платёж 10 ₽ на проде

---

## Порядок работ (что делаем прямо сейчас)

1. ✅ Публичные legal-страницы в `deploy/public/`
2. ✅ Nginx: раздача `/privacy`, `/terms`, …
3. ✅ `eas.json` + инструкция сборки
4. ⏳ Вы присылаете реквизиты ИП → подставляем в HTML + `legal.ts`
5. ⏳ Деплой на VPS
6. ⏳ Скриншоты + EAS build
7. ⏳ ЮKassa после ссылки на стор
