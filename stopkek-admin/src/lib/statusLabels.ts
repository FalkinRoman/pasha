export const SEAT_STATUS: Record<string, string> = {
  free: 'Свободен',
  occupied: 'Занят',
  reserved: 'Забронирован',
  repair: 'Ремонт',
};

export const SESSION_PHASE: Record<string, string> = {
  awaiting_arrival: 'Ожидает визита',
  arrival: 'Можно войти',
  playing: 'Игра',
  cell_pending: 'В клубе',
  acceptance: '—',
  issue: '—',
  checkout: '—',
};

export const BOOKING_STATUS: Record<string, string> = {
  draft: 'Черновик',
  pending_payment: 'Ожидает оплаты',
  paid: 'Оплачена',
  active: 'Активна',
  completed: 'Завершена',
  cancelled: 'Отменена',
  no_show: 'Не пришёл',
};

export const IDENTITY_STATUS: Record<string, string> = {
  none: 'Не пройдена',
  pending: 'На проверке',
  approved: 'Верифицирован',
  auto_approved: 'Верифицирован (авто)',
  rejected: 'Отклонена',
};

export const TX_TYPE: Record<string, string> = {
  topup: 'Пополнение',
  booking_payment: 'Оплата брони',
  extension: 'Продление',
  refund: 'Возврат / корректировка',
};
