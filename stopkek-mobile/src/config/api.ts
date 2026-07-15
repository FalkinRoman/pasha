/** Базовый URL API без слэша в конце */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3001/api';

/** Prod API — тест-бронь 16 мин не показываем даже в Expo dev */
export const IS_PROD_API = /stopkek\.site/i.test(API_URL);

export const SHOW_TEST_BOOKING = __DEV__ && !IS_PROD_API;
