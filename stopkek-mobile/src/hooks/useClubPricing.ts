import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { fetchClubPricing } from '../api/club';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setClubPricing } from '../store/bookingSlice';

/** Тарифы из админки — подтягиваем при каждом заходе на экран бронирования. */
export function useClubPricing(zoneId?: string) {
  const dispatch = useAppDispatch();
  const clubPricing = useAppSelector((s) => s.booking.clubPricing);

  const refresh = useCallback(() => {
    return fetchClubPricing(zoneId)
      .then((p) => {
        dispatch(setClubPricing(p));
        return p;
      })
      .catch(() => null);
  }, [dispatch, zoneId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { clubPricing, refresh };
}
