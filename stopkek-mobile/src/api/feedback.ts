import { apiFetch } from './client';

export async function sendFeedback(rating: number, message: string) {
  return apiFetch<{ ok: boolean }>('/feedback', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ rating, message }),
  });
}
