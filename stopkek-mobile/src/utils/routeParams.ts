/** Expo Router иногда отдаёт string | string[] */
export function pickRouteParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}
