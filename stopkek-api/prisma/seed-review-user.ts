/**
 * Тестовый аккаунт для Apple App Review.
 * npm run review:seed  /  npx tsx prisma/seed-review-user.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_PHONE = '+79001234567';
const BALANCE_KOPECKS = 500_000; // 5000 ₽

async function main() {
  const phone = process.env.REVIEW_LOGIN_PHONE?.trim()
    ? normalizePhone(process.env.REVIEW_LOGIN_PHONE.trim())
    : DEFAULT_PHONE;

  const user = await prisma.user.upsert({
    where: { phone },
    create: {
      phone,
      name: 'Apple Review',
      profileCompleted: true,
      identityStatus: 'auto_approved',
      wallet: { create: { balance: BALANCE_KOPECKS } },
    },
    update: {
      name: 'Apple Review',
      profileCompleted: true,
      identityStatus: 'auto_approved',
      deletedAt: null,
    },
  });

  await prisma.wallet.upsert({
    where: { userId: user.id },
    create: { userId: user.id, balance: BALANCE_KOPECKS },
    update: { balance: BALANCE_KOPECKS },
  });

  console.log(`Review user OK: ${phone}, balance ${BALANCE_KOPECKS / 100} ₽`);
}

function normalizePhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('8')) return '+7' + d.slice(1);
  if (d.length === 11 && d.startsWith('7')) return '+' + d;
  if (d.length === 10) return '+7' + d;
  return phone.startsWith('+') ? phone : '+' + d;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
