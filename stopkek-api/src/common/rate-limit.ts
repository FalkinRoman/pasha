type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

/** true = лимит превышен */
export function isRateLimited(
  key: string,
  maxAttempts: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const bucket = store.get(key);
  if (!bucket || now >= bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count += 1;
  if (bucket.count > maxAttempts) return true;
  return false;
}

export function rateLimitRetrySec(key: string, windowMs: number): number {
  const bucket = store.get(key);
  if (!bucket) return 0;
  return Math.max(0, Math.ceil((bucket.resetAt - Date.now()) / 1000));
}
