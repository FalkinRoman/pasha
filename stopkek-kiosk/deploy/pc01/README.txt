ПК #1 — stopkek Kiosk (прод, stopkek.site)

Скопируй на Windows в одну папку, например C:\stopkek-kiosk\:

  stopkek Kiosk 0.1.0.exe   ← уже в этой папке (или свежий из release/ после npm run pack:win)
  config.json           ← этот файл (переименовать не нужно)

Проверка:
  1. Двойной клик по exe — полноэкранный QR, «ПК #1»
  2. В браузере: https://stopkek.site/api/health → ok
  3. PowerShell:
     curl -H "X-Kiosk-Key: stopkek-kiosk-prod-2026" "https://stopkek.site/api/kiosk/state?seatNumber=1"

Выход для персонала: Ctrl+Shift+Q

На сервере (VPS) в deploy/.env.prod должно быть:
  PUBLIC_API_URL=https://stopkek.site/api
  KIOSK_API_KEY=stopkek-kiosk-prod-2026

Мобилка: EXPO_PUBLIC_API_URL=https://stopkek.site/api
Бронь — место №1.
