import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Per-seat kiosk keys without a database: each PC's key is HMAC(master, seat).
 * A leaked key for seat 5 cannot authenticate seat 3 (different HMAC), which fixes
 * the single-shared-key weakness. Revocation = rotate the master secret.
 *
 * The master secret is the existing KIOSK_API_KEY env var. The plaintext master may
 * still be accepted as a legacy/global key during migration (see KioskGuard).
 */
export function deriveSeatKey(master: string, seatNumber: number): string {
  return createHmac('sha256', master)
    .update(`stopkek-seat:${seatNumber}`)
    .digest('hex');
}

/** Constant-time string compare that never throws on length mismatch. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
