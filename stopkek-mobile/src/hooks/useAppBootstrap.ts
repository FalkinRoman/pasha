import { useEffect } from 'react';
import { fetchActiveBooking } from '../api/bookings';
import { fetchClub, fetchFloorMap } from '../api/club';
import { ApiError, getAccessToken, refreshSession, setAccessToken } from '../api/client';
import { fetchMe } from '../api/users';
import { loadStoredRefreshToken, loadStoredToken, saveTokens } from '../storage/authStorage';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { clearSessionAndRedirect } from '../api/session';
import { loginSuccess, logout, setHydrated, setNeedsProfileSetup } from '../store/authSlice';
import {
  setActiveBooking,
  setClub,
  setFloorMap,
} from '../store/bookingSlice';
import { setupPushNotifications } from '../services/push';
import type { AppDispatch } from '../store';

async function fetchMeWithRetry(retries = 3) {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fetchMe();
    } catch (e) {
      lastError = e;
      if (e instanceof ApiError && e.status === 401) throw e;
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

export function useAppBootstrap() {
  const dispatch = useAppDispatch();
  const hydrated = useAppSelector((s) => s.auth.hydrated);
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);

  useEffect(() => {
    if (hydrated) return;
    (async () => {
      const storedAccess = await loadStoredToken();
      const storedRefresh = await loadStoredRefreshToken();

      if (!storedAccess && !storedRefresh) {
        dispatch(setHydrated());
        return;
      }

      if (storedAccess) setAccessToken(storedAccess);
      if (storedRefresh) await refreshSession();

      try {
        const user = await fetchMeWithRetry();
        dispatch(
          loginSuccess({
            user,
            accessToken: getAccessToken() ?? storedAccess,
            needsProfileSetup: !user.profileCompleted,
          })
        );
        await refreshAppData(dispatch);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          setAccessToken(null);
          await saveTokens(null, null);
          dispatch(logout());
        }
      } finally {
        dispatch(setHydrated());
      }
    })();
  }, [dispatch, hydrated]);

  useEffect(() => {
    if (!isAuthenticated || !hydrated) return;
    refreshAppData(dispatch).catch(() => {});
    setupPushNotifications().catch(() => {});
  }, [isAuthenticated, hydrated, dispatch]);
}

export async function refreshAppData(dispatch: AppDispatch) {
  let user;
  try {
    user = await fetchMe();
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      await clearSessionAndRedirect(dispatch);
      return;
    }
    throw e;
  }
  const [active, club, floor] = await Promise.all([
    fetchActiveBooking(),
    fetchClub(),
    fetchFloorMap(),
  ]);
  dispatch(loginSuccess({ user, accessToken: getAccessToken() ?? undefined }));
  dispatch(setNeedsProfileSetup(!user.profileCompleted));
  dispatch(setActiveBooking(active));
  dispatch(
    setClub({
      name: club.name,
      address: club.address,
      rating: club.rating,
      hours: club.hours,
    })
  );
  dispatch(setFloorMap({ seats: floor.seats, zones: floor.zones }));
}
