import { apiFetch } from './client';

export type NotificationPrefs = {
  session: boolean;
  remind: boolean;
  promo: boolean;
};

export function fetchNotificationPrefs() {
  return apiFetch<NotificationPrefs>('/users/me/notifications', { auth: true });
}

export function updateNotificationPrefs(prefs: Partial<NotificationPrefs>) {
  return apiFetch<NotificationPrefs>('/users/me/notifications', {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(prefs),
  });
}

export function registerPushToken(token: string, platform: string) {
  return apiFetch('/users/me/push-token', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ token, platform }),
  });
}
