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

## URLs для App Store Connect

| Поле | Значение |
|------|----------|
| Privacy Policy | https://stopkek.site/privacy |
| Support URL | https://stopkek.site/support |
| Marketing URL | https://stopkek.site/support |

## Review notes (Apple)

- Бронирование мест в компьютерном клубе (офлайн-услуга)
- Оплата через ЮKassa во внешнем браузере, IAP не используется
- Тестовый номер: (дать)

Полный roadmap: `docs/RELEASE_ROADMAP.md`
