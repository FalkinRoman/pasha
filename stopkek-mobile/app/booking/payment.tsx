import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { payBooking } from '../../src/api/bookings';
import { ApiError } from '../../src/api/client';
import { fetchMe } from '../../src/api/users';
import { Header } from '../../src/components/ui/Header';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { useAppDispatch, useAppSelector } from '../../src/store/hooks';
import { loginSuccess } from '../../src/store/authSlice';
import { clearDraft, setActiveBooking } from '../../src/store/bookingSlice';
import { reloadFloorMap } from '../../src/utils/reloadFloorMap';
import { colors } from '../../src/theme/colors';
import { radius, spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { formatMoney } from '../../src/utils/format';

export default function PaymentScreen() {
  const dispatch = useAppDispatch();
  const { calculatedPrice, pendingBookingId, selectedSeatIds, seats } = useAppSelector(
    (s) => s.booking
  );
  const balance = useAppSelector((s) => s.auth.user?.balance ?? 0);
  const seat = seats.find((s) => s.id === selectedSeatIds[0]);
  const [method, setMethod] = useState<'balance' | 'card'>('balance');
  const [loading, setLoading] = useState(false);

  const pay = async () => {
    if (!pendingBookingId) return;
    setLoading(true);
    try {
      const booking = await payBooking(pendingBookingId);
      const user = await fetchMe();
      dispatch(loginSuccess({ user }));
      dispatch(setActiveBooking(booking));
      dispatch(clearDraft());
      await reloadFloorMap(dispatch);
      router.replace('/session/active');
    } catch (e) {
      Alert.alert('Ошибка', e instanceof ApiError ? e.message : 'Не удалось оплатить');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <Header title="Оплата" back />
      <Text style={typography.h1}>{formatMoney(calculatedPrice)}</Text>
      <Text style={[typography.bodySecondary, { marginBottom: spacing.xl }]}>
        Место #{seat?.number} · Баланс: {formatMoney(balance)}
      </Text>
      <Pressable
        style={[styles.method, method === 'balance' && styles.methodActive]}
        onPress={() => setMethod('balance')}
      >
        <Text style={typography.body}>С баланса</Text>
        {balance < calculatedPrice && (
          <Text style={[typography.caption, { color: colors.warning }]}>Недостаточно — пополните</Text>
        )}
      </Pressable>
      <Pressable
        style={[styles.method, method === 'card' && styles.methodActive]}
        onPress={() => setMethod('card')}
      >
        <Text style={typography.body}>Карта / СБП</Text>
        <Text style={typography.caption}>Скоро (YooKassa)</Text>
      </Pressable>
      {method === 'balance' && balance < calculatedPrice && (
        <StopButton
          title="Пополнить баланс"
          variant="ghost"
          onPress={() => router.push('/wallet/topup')}
        />
      )}
      <StopButton
        title="Оплатить"
        onPress={pay}
        disabled={method !== 'balance' || balance < calculatedPrice || loading || !pendingBookingId}
        style={{ marginTop: 'auto' }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  method: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    backgroundColor: colors.bgCard,
  },
  methodActive: { borderColor: colors.accent, backgroundColor: '#1a1010' },
});
