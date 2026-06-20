/**
 * Очистка журнала доступа (старые приёмки/checkout и тех. события).
 * npm run db:clear-access
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const legacy = await prisma.lockerLog.deleteMany({
    where: {
      type: { in: ['acceptance', 'checkout'] },
    },
  });
  const events = await prisma.lockEvent.deleteMany();
  const doors = await prisma.lockerLog.deleteMany({
    where: { type: { in: ['lock_open_main', 'lock_open_cell'] } },
  });

  console.log(
    `Удалено: архив приёмка/checkout ${legacy.count}, открытия ${doors.count}, LockEvent ${events.count}`
  );
  console.log('Новые открытия дверей/боксов снова пишутся при действиях в приложении.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
