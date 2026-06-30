import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { fetchActiveBooking } from '../api/bookings';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setActiveBooking } from '../store/bookingSlice';
import type { Booking } from '../types';

function needsServerSync(booking: Booking | null): boolean {
  if (!booking) return false;
  if (booking.gameRunning === true) return false;
  return (
    booking.status === 'paid' ||
    booking.timerMode === 'until_start' ||
    booking.timerMode === 'until_door'
  );
}

/** Подтягивает active booking с API (активация по startAt, смена таймера). */
export function useActiveBookingSync() {
  const dispatch = useAppDispatch();
  const booking = useAppSelector((s) => s.booking.activeBooking);

  const refresh = useCallback(() => {
    return fetchActiveBooking()
      .then((b) => {
        dispatch(setActiveBooking(b));
        return b;
      })
      .catch(() => null);
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      if (booking) refresh();
    }, [booking?.id, refresh])
  );

  useEffect(() => {
    if (!needsServerSync(booking)) return;
    const t = setInterval(() => refresh(), 3000);
    return () => clearInterval(t);
  }, [booking?.id, booking?.gameRunning, booking?.timerMode, booking?.status, refresh]);

  return { booking, refresh };
}
