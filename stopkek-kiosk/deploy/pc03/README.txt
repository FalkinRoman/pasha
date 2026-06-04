ПК #3 — stopkek Kiosk (прод, stopkek.site)

Скопируй на Windows в одну папку, например C:\stopkek-kiosk-pc3\:

  stopkek Kiosk 0.1.0.exe
  config.json

Проверка:
  1. Двойной клик — полноэкранный QR, «ПК #3»
  2. https://stopkek.site/api/health → ok
  3. PowerShell:
     curl -H "X-Kiosk-Key: stopkek-kiosk-prod-2026" "https://stopkek.site/api/kiosk/state?seatNumber=3"

Выход: Ctrl+Shift+Q

Мобилка: бронь места №3, затем скан QR с этого монитора.
