import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'stopkek_access_token';

export async function loadStoredToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function saveToken(token: string | null) {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}
