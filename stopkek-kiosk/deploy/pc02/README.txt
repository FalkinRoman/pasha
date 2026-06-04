ПК #2 — stopkek Kiosk (прод, stopkek.site)

Скопируй на Windows в одну папку, например C:\stopkek-kiosk-pc2\:

  stopkek Kiosk 0.1.0.exe
  config.json

Проверка:
  1. Двойной клик — полноэкранный QR, «ПК #2»
  2. https://stopkek.site/api/health → ok
  3. PowerShell:
     curl -H "X-Kiosk-Key: stopkek-kiosk-prod-2026" "https://stopkek.site/api/kiosk/state?seatNumber=2"

Выход: Ctrl+Shift+Q

Мобилка: бронь места №2, затем скан QR с этого монитора.
