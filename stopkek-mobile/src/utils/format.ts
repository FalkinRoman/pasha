import { BOOKING_MAX_DAYS_AHEAD } from '../constants/bookingPricing';

export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length <= 1) return '+7';
  if (d.length <= 4) return `+7 (${d.slice(1)}`;
  if (d.length <= 7) return `+7 (${d.slice(1, 4)}) ${d.slice(4)}`;
  if (d.length <= 9) return `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`;
}

export function phoneDigits(formatted: string): string {
  const d = formatted.replace(/\D/g, '');
  return d.startsWith('7') ? `+${d}` : `+7${d}`;
}

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function dayWord(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
  return 'дней';
}

/** Таймер обратного отсчёта: дни + часы для длинных интервалов */
export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  if (d > 0) {
    const parts = [`${d} ${dayWord(d)}`];
    if (h > 0) parts.push(`${h} ч`);
    if (m > 0 && d < 2) parts.push(`${m} мин`);
    return parts.join(' ');
  }
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function maxBookingDate(from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + BOOKING_MAX_DAYS_AHEAD);
  d.setSeconds(0, 0);
  return d;
}

export function formatMoney(n: number): string {
  return `${n.toLocaleString('ru-RU')} ₽`;
}

const MONTHS_SHORT = [
  'янв',
  'фев',
  'мар',
  'апр',
  'мая',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
];

export function formatTimeHM(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

export function formatPickerDay(d: Date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Завтра';
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]}`;
}

export function formatSessionRange(start: Date, end: Date) {
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    return `${formatTimeHM(start)} — ${formatTimeHM(end)} · ${formatPickerDay(start)}`;
  }
  return `${formatTimeHM(start)} · ${formatPickerDay(start)} — ${formatTimeHM(end)} · ${formatPickerDay(end)}`;
}

export function formatSessionDateTime(d: Date) {
  return `${formatTimeHM(d)} · ${formatPickerDay(d)}`;
}

export function formatSessionDay(d: Date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Завтра';
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function formatSessionDateLine(d: Date) {
  return `${formatSessionDay(d)}, ${d.getFullYear()}`;
}

export function formatDurationHours(hours: number) {
  if (hours < 1) return `${Math.round(hours * 60)} мин`;
  if (hours === 1) return '1 час';
  if (hours >= 2 && hours <= 4) return `${hours} часа`;
  return `${hours} часов`;
}

export function formatDurationMinutes(minutes: number) {
  if (minutes === 1) return '1 минута';
  if (minutes >= 2 && minutes <= 4) return `${minutes} минуты`;
  if (minutes % 60 === 0) return formatDurationHours(minutes / 60);
  return `${minutes} мин`;
}

/** «до 22:00 · сегодня» — для активной брони */
export function formatBookingUntil(endAt: string) {
  const end = new Date(endAt);
  return `до ${formatTimeHM(end)} · ${formatPickerDay(end)}`;
}

/** «Забронировано в 11:33!» — до старта сеанса */
export function formatBookingStartLine(startAt: string) {
  const start = new Date(startAt);
  return `Забронировано в ${formatTimeHM(start)}!`;
}

/** «Игра началась в 11:33» — после старта сеанса */
export function formatGameStartedLine(startAt: string) {
  const start = new Date(startAt);
  return `Игра началась в ${formatTimeHM(start)}`;
}

/** «Завершение игры в 11:33» — конец текущего сеанса */
export function formatGameEndLine(endAt: string) {
  const end = new Date(endAt);
  return `Завершение игры в ${formatTimeHM(end)}`;
}

export function formatBookingRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const pad = (n: number) => String(n).padStart(2, '0');
  const time = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const date = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
  return `${time(s)} – ${time(e)}, ${date(s)} – ${date(e)}`;
}
