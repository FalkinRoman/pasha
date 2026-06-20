# stopkek mobile

Expo + Router. Сейчас **только фронт** на mock-данных.

## Установка (если `expo install` падал по таймауту)

```bash
cd stopkek-mobile
npm install
```

## Запуск

```bash
npx expo start
```

Сканируй QR в **Expo Go** (iOS/Android).

## Демо-вход по звонку

1. Онбординг → телефон `+7 (900) 123-45-67`
2. «Позвонить мне» → дождись экрана с 4 цифрами
3. Код: **`1234`**

## Экраны

- Auth: welcome, phone, verify-call
- Tabs: home, book → map, profile
- Booking: map, time, summary, payment
- Session: active, extend, acceptance
- Wallet, profile/*, support, club

## Стек

Expo 54 · Expo Router · Redux Toolkit · Manrope + Permanent Marker · react-native-svg
