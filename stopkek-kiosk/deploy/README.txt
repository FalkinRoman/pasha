Комплекты для игровых ПК (Windows x64)

  pc01/  — место №1
  pc02/  — место №2
  pc03/  — место №3
  pc04/  — место №4

В каждой папке:
  stopkek Kiosk 0.1.0.exe
  config.json
  README.txt

Номера мест должны совпадать с админкой: https://stopkek.site/seats

Пересборка exe (на Mac/Windows с Node):
  cd stopkek-kiosk && npm run pack:win
  cp "release/stopkek Kiosk 0.1.0.exe" deploy/pc01/
  cp "release/stopkek Kiosk 0.1.0.exe" deploy/pc02/
  cp "release/stopkek Kiosk 0.1.0.exe" deploy/pc03/
  cp "release/stopkek Kiosk 0.1.0.exe" deploy/pc04/

.exe в git не хранятся — копируй из release/ или уже лежащие в deploy/pc*/ локально.
