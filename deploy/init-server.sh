#!/bin/sh
# Первичная настройка после первого up (миграции уже в entrypoint api)
set -e
cd "$(dirname "$0")"
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T api npx tsx prisma/seed-admins.ts
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T api npx tsx prisma/bootstrap-club.ts
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T api npx tsx prisma/seed-locks.ts
echo "Готово: админ ${ADMIN_EMAIL:-из .env}, клуб и 4 соло-капсулы."
