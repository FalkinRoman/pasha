import { router } from 'expo-router';
import { setAccessToken } from './client';
import { saveToken } from '../storage/authStorage';
import type { AppDispatch } from '../store';
import { logout } from '../store/authSlice';

/** 401 — сброс сессии и на экран входа */
export async function clearSessionAndRedirect(dispatch: AppDispatch) {
  setAccessToken(null);
  await saveToken(null);
  dispatch(logout());
  router.replace('/(auth)/phone');
}
