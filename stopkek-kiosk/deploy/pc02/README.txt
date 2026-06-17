ПК #2 — stopkek Kiosk (прод, stopkek.site)

Скопируй на Windows в одну папку, например C:\stopkek-kiosk\:

  stopkek Kiosk 0.1.0.exe   ← уже в этой папке (или свежий из release/ после npm run pack:win)
  config.json               ← этот файл (переименовать не нужно)
  watchdog.bat              ← из deploy/ (для автоперезапуска)

Запуск:
  ВСЕГДА запускай watchdog.bat, а не exe напрямую.
  watchdog.bat следит за процессом и перезапускает его если убили через Task Manager.

Проверка:
  1. Двойной клик по watchdog.bat — откроется окно watchdog + полноэкранный QR «ПК #2»
  2. В браузере: https://stopkek.site/api/health → ok
  3. PowerShell:
     curl -H "X-Kiosk-Key: stopkek-kiosk-prod-2026" "https://stopkek.site/api/kiosk/state?seatNumber=2"

Выход: Ctrl+Shift+Q → пароль staffPassword в config.json (по умолчанию: stopkek-staff)
После QR — полоска сверху, рабочий стол открыт. Полный блок при окончании времени.

Защита от обходов (работает автоматически):
  - Win+D, Win+Tab, Win+M, Win+E и др. — заблокированы
  - Ctrl+Shift+Esc (Task Manager) — заблокирован через реестр
  - Alt+Tab — окно немедленно возвращает себе фокус
  - Убийство через Task Manager — watchdog.bat перезапускает через 3 сек

На сервере (VPS) в deploy/.env.prod должно быть:
  PUBLIC_API_URL=https://stopkek.site/api
  KIOSK_API_KEY=stopkek-kiosk-prod-2026

Мобилка: EXPO_PUBLIC_API_URL=https://stopkek.site/api
Бронь — место №2.
