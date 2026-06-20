/**
 * Сид единственного админа и email поддержки клуба.
 * npm run admin:seed
 */
import { AdminRole, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const DEFAULT_ADMIN_EMAIL = 'stopkeksprt@yandex.ru';
const DEFAULT_ADMIN_NAME = 'Админ и поддержка';
const ADMIN_ROLE: AdminRole = 'superadmin';

function loadEnvFile() {
  const path = resolve(__dirname, '../.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

const prisma = new PrismaClient();

async function main() {
  loadEnvFile();

  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!password) {
    console.error('Задай ADMIN_PASSWORD в stopkek-api/.env');
    process.exit(1);
  }

  const adminEmail =
    process.env.ADMIN_EMAIL?.trim().toLowerCase() || DEFAULT_ADMIN_EMAIL;
  const adminName = process.env.ADMIN_NAME?.trim() || DEFAULT_ADMIN_NAME;
  const supportEmail =
    process.env.SUPPORT_EMAIL?.trim().toLowerCase() || adminEmail;

  const removed = await prisma.admin.deleteMany({
    where: { email: { not: adminEmail } },
  });
  if (removed.count > 0) {
    console.log('Удалены лишние админы:', removed.count);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.admin.upsert({
    where: { email: adminEmail },
    update: { passwordHash, name: adminName, role: ADMIN_ROLE },
    create: {
      email: adminEmail,
      passwordHash,
      name: adminName,
      role: ADMIN_ROLE,
    },
  });
  console.log('Админ:', admin.email, `(${admin.role})`);

  const club = await prisma.club.findFirst();
  if (club) {
    await prisma.club.update({
      where: { id: club.id },
      data: { supportEmail },
    });
    console.log('Поддержка (клуб):', supportEmail);
  } else {
    console.log('Клуб не найден — supportEmail пропущен (сначала bootstrap:club)');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
