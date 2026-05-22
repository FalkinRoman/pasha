#!/bin/sh
# Первичная настройка после первого up (миграции уже в entrypoint api)
set -e
cd "$(dirname "$0")"
docker compose -f docker-compose.prod.yml --env-file .env.prod exec api npm run admin:seed
docker compose -f docker-compose.prod.yml --env-file .env.prod exec api npm run bootstrap:club
docker compose -f docker-compose.prod.yml --env-file .env.prod exec api npm run seed:locks
echo "Готово: админ ${ADMIN_EMAIL:-из .env}, клуб и 25 мест созданы."
