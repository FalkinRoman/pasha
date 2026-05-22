export function assertProductionSecrets() {
  if (process.env.NODE_ENV !== 'production') return;

  const secret = process.env.JWT_SECRET?.trim() ?? '';
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
  if (secret === 'change-me-in-production-min-32-chars') {
    throw new Error('Set a strong JWT_SECRET in production');
  }
}
