import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'stopkek_access_token';
const REFRESH_KEY = 'stopkek_refresh_token';

export async function loadStoredToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function loadStoredRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function saveToken(token: string | null) {
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function saveRefreshToken(token: string | null) {
  if (token) await SecureStore.setItemAsync(REFRESH_KEY, token);
  else await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export async function saveTokens(access: string | null, refresh: string | null) {
  await Promise.all([saveToken(access), saveRefreshToken(refresh)]);
}
