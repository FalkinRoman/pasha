import { useEffect } from 'react';
import { fetchActiveBooking } from '../api/bookings';
import { fetchClub, fetchFloorMap } from '../api/club';
import { setAccessToken } from '../api/client';
import { fetchMe } from '../api/users';
import { loadStoredToken, saveToken } from '../storage/authStorage';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { loginSuccess, setHydrated, setNeedsProfileSetup } from '../store/authSlice';
import {
  setActiveBooking,
  setClub,
  setFloorMap,
} from '../store/bookingSlice';
import type { AppDispatch } from '../store';

export function useAppBootstrap() {
  const dispatch = useAppDispatch();
  const hydrated = useAppSelector((s) => s.auth.hydrated);
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);

  useEffect(() => {
    if (hydrated) return;
    (async () => {
      const token = await loadStoredToken();
      if (!token) {
        dispatch(setHydrated());
        return;
      }
      setAccessToken(token);
      try {
        const user = await fetchMe();
        dispatch(
          loginSuccess({
            user,
            accessToken: token,
            needsProfileSetup: !user.profileCompleted,
          })
        );
        await refreshAppData(dispatch);
      } catch {
        setAccessToken(null);
        await saveToken(null);
      } finally {
        dispatch(setHydrated());
      }
    })();
  }, [dispatch, hydrated]);

  useEffect(() => {
    if (!isAuthenticated || !hydrated) return;
    refreshAppData(dispatch).catch(() => {});
  }, [isAuthenticated, hydrated, dispatch]);
}

export async function refreshAppData(dispatch: AppDispatch) {
  const [user, active, club, floor] = await Promise.all([
    fetchMe(),
    fetchActiveBooking(),
    fetchClub(),
    fetchFloorMap(),
  ]);
  dispatch(loginSuccess({ user }));
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
