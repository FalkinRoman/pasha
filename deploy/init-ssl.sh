#!/bin/bash
# Let's Encrypt для stopkek.site — запускать на VPS из папки deploy/
set -euo pipefail

DOMAIN="${DOMAIN:-stopkek.site}"
EMAIL="${CERTBOT_EMAIL:-stopkeksprt@yandex.ru}"
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.prod"

cd "$(dirname "$0")"

if [[ ! -f .env.prod ]]; then
  echo "Нет .env.prod — скопируй: cp .env.prod.example .env.prod"
  exit 1
fi

echo "==> DNS должен указывать на этот сервер: $DOMAIN"
echo "    dig +short $DOMAIN"

mkdir -p certbot-www
touch certbot-www/.keep

echo "==> Bootstrap nginx (HTTP + ACME)"
cp nginx-gateway.bootstrap.conf nginx-gateway.conf
$COMPOSE up -d gateway api admin postgres

echo "==> Certbot (webroot)"
docker run --rm \
  -v "$(pwd)/certbot-www:/var/www/certbot" \
  -v "$(pwd)/certbot-certs:/etc/letsencrypt" \
  certbot/certbot certonly --webroot \
  -w /var/www/certbot \
  -d "$DOMAIN" -d "www.$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos --no-eff-email --non-interactive

echo "==> Включаем HTTPS nginx"
cp nginx-gateway.ssl.conf nginx-gateway.conf
$COMPOSE up -d --force-recreate gateway certbot

echo "==> Обнови .env.prod на https (если ещё http):"
echo "    PUBLIC_BASE_URL=https://$DOMAIN"
echo "    PUBLIC_API_URL=https://$DOMAIN/api"
echo "    ADMIN_APP_URL=https://$DOMAIN"
echo "    CORS_ORIGINS=https://$DOMAIN,https://www.$DOMAIN"
echo ""
echo "    sed -i 's|http://|https://|g' .env.prod   # проверь глазами!"
echo "    $COMPOSE up -d --build api admin"
echo ""
echo "Проверка: curl -s https://$DOMAIN/api/health"
