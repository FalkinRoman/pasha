/**
 * Сид админов и email поддержки клуба.
 * npm run admin:seed
 */
import { AdminRole, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

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

const DEFAULT_ADMINS: {
  email: string;
  name: string;
  role: AdminRole;
}[] = [
  {
    email: 'stopkeksprt@mail.ru',
    name: 'Админ и поддержка',
    role: 'superadmin',
  },
];

const prisma = new PrismaClient();

async function main() {
  loadEnvFile();

  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!password) {
    console.error('Задай ADMIN_PASSWORD в stopkek-api/.env');
    process.exit(1);
  }

  const supportEmail =
    process.env.SUPPORT_EMAIL?.trim().toLowerCase() ||
    'stopkeksprt@mail.ru';

  const extraEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const extraName = process.env.ADMIN_NAME?.trim() || 'Администратор';

  const toSeed = [...DEFAULT_ADMINS];
  if (extraEmail && !toSeed.some((a) => a.email === extraEmail)) {
    toSeed.push({ email: extraEmail, name: extraName, role: 'superadmin' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  for (const a of toSeed) {
    const admin = await prisma.admin.upsert({
      where: { email: a.email },
      update: { passwordHash, name: a.name, role: a.role },
      create: {
        email: a.email,
        passwordHash,
        name: a.name,
        role: a.role,
      },
    });
    console.log('Админ:', admin.email, `(${admin.role})`);
  }

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
