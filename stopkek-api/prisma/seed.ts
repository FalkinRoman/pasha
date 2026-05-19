import {
  BookingStatus,
  PrismaClient,
  SeatStatus,
  TransactionType,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin@stopkek.ru';
const ADMIN_PASSWORD = 'StopkekAdmin2026!';

const SEAT_W = 22;
const SEAT_H = 22;
const SEAT_GAP = 4;
const STEP = SEAT_W + SEAT_GAP;
const INNER_PAD = 12;
const LABEL_COL_W = 74;
const LABEL_GRID_GAP = 10;
const GRID_X = INNER_PAD + LABEL_COL_W + LABEL_GRID_GAP;
const GRID_Y = 32;

const zoneLabelY = (row: number) => GRID_Y + row * STEP + SEAT_H / 2 + 5;

function zoneForSeat(n: number) {
  if (n <= 5) return 'normal';
  if (n <= 10) return 'vip1';
  if (n <= 15) return 'vip2';
  return 'bootcamp';
}

function hoursFromNow(h: number) {
  return new Date(Date.now() + h * 3600_000);
}

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600_000);
}

async function main() {
  await prisma.feedback.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.bookingSeat.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.user.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.club.deleteMany();

  const club = await prisma.club.create({
    data: {
      name: 'stopkek',
      address: 'Москва, ул. Игровая, 1',
      rating: 4.9,
      hours: '24/7',
      zones: {
        create: [
          {
            slug: 'normal',
            name: 'Normal',
            specs: 'RTX 4060 · 165Hz',
            pricePerHour: 150,
            labelX: INNER_PAD,
            labelY: zoneLabelY(0),
            sortOrder: 0,
          },
          {
            slug: 'vip1',
            name: 'VIP-1',
            specs: 'RTX 4060 Ti · 240Hz',
            pricePerHour: 220,
            labelX: INNER_PAD,
            labelY: zoneLabelY(1),
            sortOrder: 1,
          },
          {
            slug: 'vip2',
            name: 'VIP-2',
            specs: 'RTX 4060 Ti · 240Hz',
            pricePerHour: 220,
            labelX: INNER_PAD,
            labelY: zoneLabelY(2),
            sortOrder: 2,
          },
          {
            slug: 'bootcamp',
            name: 'Bootcamp',
            specs: 'RTX 4070 Super · 280Hz',
            pricePerHour: 280,
            labelX: INNER_PAD,
            labelY: zoneLabelY(3),
            sortOrder: 3,
          },
        ],
      },
    },
    include: { zones: true },
  });

  const zoneBySlug = Object.fromEntries(club.zones.map((z) => [z.slug, z]));
  const seatByNumber: Record<number, { id: string; zoneId: string }> = {};

  const initialStatus = (n: number): SeatStatus => {
    if (n === 25) return 'repair';
    if ([3, 7, 12].includes(n)) return 'occupied';
    if (n === 8) return 'reserved';
    if (n === 15) return 'reserved';
    return 'free';
  };

  for (let i = 0; i < 25; i++) {
    const n = i + 1;
    const row = Math.floor((n - 1) / 5);
    const col = (n - 1) % 5;
    const slug = zoneForSeat(n);
    const seat = await prisma.seat.create({
      data: {
        zoneId: zoneBySlug[slug].id,
        number: n,
        x: GRID_X + col * STEP,
        y: GRID_Y + row * STEP,
        w: SEAT_W,
        h: SEAT_H,
        status: initialStatus(n),
      },
    });
    seatByNumber[n] = { id: seat.id, zoneId: zoneBySlug[slug].id };
  }

  const usersData = [
    { phone: '+79001112233', name: 'Алексей К.', balance: 325_000, email: 'alex@mail.ru' },
    { phone: '+79002223344', name: 'Мария С.', balance: 89_000, email: 'maria@gmail.com' },
    { phone: '+79003334455', name: 'Дмитрий В.', balance: 0, email: null },
    { phone: '+79004445566', name: 'Иван П.', balance: 540_000, email: 'ivan@yandex.ru' },
    { phone: '+79005556677', name: '', balance: 12_000, email: null, profileCompleted: false },
    { phone: '+79006667788', name: 'София Л.', balance: 156_000, email: 'sofia@mail.ru' },
    { phone: '+79007778899', name: 'Никита Р.', balance: 42_000, email: null },
    { phone: '+79161234567', name: 'Олег М.', balance: 210_000, email: 'oleg@corp.ru' },
  ];

  const users: { id: string; phone: string; walletId: string }[] = [];

  for (const u of usersData) {
    const user = await prisma.user.create({
      data: {
        phone: u.phone,
        name: u.name,
        email: u.email ?? undefined,
        profileCompleted: u.profileCompleted ?? true,
        wallet: { create: { balance: u.balance } },
      },
      include: { wallet: true },
    });
    users.push({ id: user.id, phone: u.phone, walletId: user.wallet!.id });
  }

  async function createBooking(opts: {
    userIdx: number;
    seatNum: number;
    status: BookingStatus;
    startAt: Date;
    endAt: Date;
    createdAt?: Date;
  }) {
    const user = users[opts.userIdx];
    const seat = seatByNumber[opts.seatNum];
    const zone = club.zones.find((z) => z.id === seat.zoneId)!;
    const hours = (opts.endAt.getTime() - opts.startAt.getTime()) / 3600_000;
    const totalPrice = Math.round(zone.pricePerHour * hours * 100);

    return prisma.booking.create({
      data: {
        userId: user.id,
        status: opts.status,
        startAt: opts.startAt,
        endAt: opts.endAt,
        totalPrice,
        createdAt: opts.createdAt ?? opts.startAt,
        seats: { create: { seatId: seat.id, seatNumber: opts.seatNum } },
      },
    });
  }

  // Активные сеансы
  await createBooking({
    userIdx: 0,
    seatNum: 3,
    status: 'active',
    startAt: hoursAgo(1),
    endAt: hoursFromNow(2),
  });
  await createBooking({
    userIdx: 1,
    seatNum: 7,
    status: 'active',
    startAt: hoursAgo(0.5),
    endAt: hoursFromNow(3),
  });
  await createBooking({
    userIdx: 3,
    seatNum: 12,
    status: 'active',
    startAt: hoursAgo(2),
    endAt: hoursFromNow(1),
  });

  // Ожидает оплаты
  await createBooking({
    userIdx: 2,
    seatNum: 8,
    status: 'pending_payment',
    startAt: hoursFromNow(0.5),
    endAt: hoursFromNow(3.5),
    createdAt: new Date(),
  });

  // Оплачена, скоро начнётся
  await createBooking({
    userIdx: 5,
    seatNum: 15,
    status: 'paid',
    startAt: hoursFromNow(1),
    endAt: hoursFromNow(4),
    createdAt: hoursAgo(0.2),
  });

  // Завершённые за последние дни
  const completed = [
    { userIdx: 0, seat: 1, ago: 26, dur: 3 },
    { userIdx: 1, seat: 5, ago: 22, dur: 2 },
    { userIdx: 3, seat: 10, ago: 18, dur: 4 },
    { userIdx: 6, seat: 14, ago: 14, dur: 2 },
    { userIdx: 7, seat: 18, ago: 10, dur: 5 },
    { userIdx: 4, seat: 2, ago: 6, dur: 1 },
  ];
  for (const c of completed) {
    const start = hoursAgo(c.ago);
    const end = hoursAgo(c.ago - c.dur);
    await createBooking({
      userIdx: c.userIdx,
      seatNum: c.seat,
      status: 'completed',
      startAt: start,
      endAt: end,
      createdAt: hoursAgo(c.ago + 1),
    });
  }

  await createBooking({
    userIdx: 2,
    seatNum: 4,
    status: 'cancelled',
    startAt: hoursFromNow(2),
    endAt: hoursFromNow(4),
    createdAt: hoursAgo(3),
  });

  // Транзакции
  const txData: {
    walletIdx: number;
    type: TransactionType;
    amount: number;
    desc: string;
    hoursAgo: number;
  }[] = [
    { walletIdx: 0, type: 'topup', amount: 200_000, desc: 'Пополнение YooKassa', hoursAgo: 48 },
    { walletIdx: 0, type: 'booking_payment', amount: -66_000, desc: 'Оплата брони #3', hoursAgo: 1 },
    { walletIdx: 1, type: 'topup', amount: 50_000, desc: 'Пополнение СБП', hoursAgo: 72 },
    { walletIdx: 1, type: 'booking_payment', amount: -44_000, desc: 'Оплата брони VIP', hoursAgo: 0.5 },
    { walletIdx: 3, type: 'topup', amount: 300_000, desc: 'Пополнение карта', hoursAgo: 120 },
    { walletIdx: 3, type: 'booking_payment', amount: -88_000, desc: 'Bootcamp 4ч', hoursAgo: 10 },
    { walletIdx: 3, type: 'booking_payment', amount: -66_000, desc: 'Сеанс #12', hoursAgo: 2 },
    { walletIdx: 5, type: 'topup', amount: 100_000, desc: 'Пополнение mock', hoursAgo: 24 },
    { walletIdx: 6, type: 'refund', amount: 15_000, desc: 'Корректировка админом', hoursAgo: 96 },
    { walletIdx: 7, type: 'topup', amount: 150_000, desc: 'Пополнение YooKassa', hoursAgo: 200 },
  ];

  for (const t of txData) {
    await prisma.transaction.create({
      data: {
        walletId: users[t.walletIdx].walletId,
        type: t.type,
        amount: t.amount,
        description: t.desc,
        createdAt: hoursAgo(t.hoursAgo),
      },
    });
  }

  const feedbackTexts = [
    { userIdx: 0, rating: 5, message: 'Отличный зал, всё чисто, админы на связи.' },
    { userIdx: 1, rating: 4, message: 'Хорошие ПК, но в VIP жарковато летом.' },
    { userIdx: 3, rating: 5, message: 'Удобное приложение, бронь за минуту.' },
    { userIdx: 6, rating: 3, message: 'На месте #14 мышь скрипела, поменяли быстро.' },
    { userIdx: 7, rating: 5, message: 'Bootcamp топ, 280Hz реально чувствуется.' },
    { userIdx: 5, rating: 4, message: 'Цены норм, хотелось бы скидку на утро.' },
    { userIdx: 0, rating: 5, message: 'Звонок для входа — удобно, без SMS.' },
  ];

  for (const f of feedbackTexts) {
    await prisma.feedback.create({
      data: {
        userId: users[f.userIdx].id,
        rating: f.rating,
        message: f.message,
        createdAt: hoursAgo(Math.random() * 72 + 2),
      },
    });
  }

  const admin = await prisma.admin.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
      name: 'Главный админ',
      role: 'superadmin',
    },
    create: {
      email: ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
      name: 'Главный админ',
      role: 'superadmin',
    },
  });

  console.log('Seed OK:', club.name);
  console.log('  seats: 25 (3 active, 2 reserved, 1 repair)');
  console.log('  users:', users.length);
  console.log('  bookings + transactions + feedback');
  console.log('Admin:', admin.email, '/', ADMIN_PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
