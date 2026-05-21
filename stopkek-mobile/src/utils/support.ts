import { Linking } from 'react-native';

export type SupportContacts = {
  supportPhone?: string | null;
  supportTelegram?: string | null;
  supportEmail?: string | null;
};

export function telegramUrl(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const v = raw.trim();
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  if (v.startsWith('t.me/')) return `https://${v}`;
  const handle = v.startsWith('@') ? v.slice(1) : v;
  return `https://t.me/${handle}`;
}

export function telUrl(phone?: string | null): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  return `tel:+${digits.startsWith('7') ? digits : digits}`;
}

export function mailUrl(email?: string | null): string | null {
  if (!email?.trim()) return null;
  return `mailto:${email.trim()}`;
}

export async function openExternal(url: string) {
  const ok = await Linking.canOpenURL(url);
  if (ok) await Linking.openURL(url);
}
