# HTTPS для stopkek.site

Бесплатный сертификат **Let's Encrypt** через Certbot.

## Требования

- DNS: `stopkek.site` и `www.stopkek.site` → IP VPS (`dig +short stopkek.site`)
- Порты **80** и **443** открыты на сервере
- Docker compose уже поднят в `~/stopkek/deploy`

## Одна команда (на VPS)

```bash
cd ~/stopkek
git pull origin main

cd deploy
chmod +x init-ssl.sh
./init-ssl.sh
```

Потом вручную проверь `.env.prod` — все URL на **https**:

```env
PUBLIC_BASE_URL=https://stopkek.site
PUBLIC_API_URL=https://stopkek.site/api
ADMIN_APP_URL=https://stopkek.site
CORS_ORIGINS=https://stopkek.site,https://www.stopkek.site
```

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

## Проверка

```bash
curl -s https://stopkek.site/api/health
```

Браузер: https://stopkek.site/login

## Мобилка и kiosk

```env
EXPO_PUBLIC_API_URL=https://stopkek.site/api
```

```json
"apiUrl": "https://stopkek.site/api"
```

Пересборка Expo / перезапуск kiosk.

## Продление

Контейнер `certbot` в compose сам вызывает `certbot renew` каждые 12 ч.

После renew при необходимости:

```bash
docker compose -f docker-compose.prod.yml exec gateway nginx -s reload
```

## Откат на HTTP

```bash
cp nginx-gateway.bootstrap.conf nginx-gateway.conf
# убери 443 из compose или оставь — nginx просто не слушает ssl без ssl-блока
docker compose ... up -d gateway
```
