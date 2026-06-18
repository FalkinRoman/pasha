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
  if (hours === 1) return '1 час';
  if (hours >= 2 && hours <= 4) return `${hours} часа`;
  return `${hours} часов`;
}

export function formatBookingRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const pad = (n: number) => String(n).padStart(2, '0');
  const time = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const date = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
  return `${time(s)} – ${time(e)}, ${date(s)} – ${date(e)}`;
}
