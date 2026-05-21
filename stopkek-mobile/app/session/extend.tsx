import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { extendBooking } from '../../src/api/bookings';
import { ApiError } from '../../src/api/client';
import { Header } from '../../src/components/ui/Header';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { useAppDispatch, useAppSelector } from '../../src/store/hooks';
import { setActiveBooking } from '../../src/store/bookingSlice';
import { colors } from '../../src/theme/colors';
import { radius, spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { formatMoney } from '../../src/utils/format';

const HOURS = [1, 2, 3, 4];

export default function ExtendScreen() {
  const dispatch = useAppDispatch();
  const booking = useAppSelector((s) => s.booking.activeBooking);
  const [selected, setSelected] = useState(1);
  const [loading, setLoading] = useState(false);

  const pricePerHour = useMemo(() => {
    if (!booking?.durationMinutes || !booking.totalPrice) return 280;
    const hours = booking.durationMinutes / 60;
    return hours > 0 ? Math.round(booking.totalPrice / hours) : 280;
  }, [booking]);

  const pay = async () => {
    if (!booking) return;
    setLoading(true);
    try {
      const updated = await extendBooking(booking.id, selected);
      dispatch(setActiveBooking(updated));
      router.back();
    } catch (e) {
      Alert.alert('Ошибка', e instanceof ApiError ? e.message : 'Не удалось продлить');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <Header title="Продлить сеанс" back />
      {HOURS.map((h) => (
        <Pressable
          key={h}
          style={[styles.opt, selected === h && styles.optActive]}
          onPress={() => setSelected(h)}
        >
          <Text style={typography.h3}>+{h} ч</Text>
          <Text style={typography.bodySecondary}>{formatMoney(pricePerHour * h)}</Text>
        </Pressable>
      ))}
      <StopButton
        title={`Оплатить ${formatMoney(pricePerHour * selected)}`}
        onPress={pay}
        disabled={loading}
        style={{ marginTop: 'auto' }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  opt: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    backgroundColor: colors.bgCard,
  },
  optActive: { borderColor: colors.accent, backgroundColor: '#1a1010' },
});
