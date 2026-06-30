import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { PaymentPolicyNotice } from '../../src/components/legal/PaymentPolicyNotice';
import { PAYMENT_POLICY_ACK, PAYMENT_POLICY_OFFER_URL } from '../../src/constants/paymentPolicy';
import { cancelBooking, createBooking, payBooking } from '../../src/api/bookings';
import { ApiError } from '../../src/api/client';
import { fetchMe } from '../../src/api/users';
import { Header } from '../../src/components/ui/Header';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { StopkekLoader } from '../../src/components/ui/StopkekLoader';
import { useAppDispatch, useAppSelector } from '../../src/store/hooks';
import { loginSuccess } from '../../src/store/authSlice';
import { clearDraft, setActiveBooking, setPendingBookingId, setCalculatedPrice } from '../../src/store/bookingSlice';
import { parseTimeWindowId } from '../../src/constants/bookingPricing';
import { reloadFloorMap } from '../../src/utils/reloadFloorMap';
import { colors } from '../../src/theme/colors';
import { radius, spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { formatMoney } from '../../src/utils/format';

export default function PaymentScreen() {
  const dispatch = useAppDispatch();
  const { calculatedPrice, pendingBookingId, selectedSeatIds, seats, durationHours, startAt, activePackageId } = useAppSelector(
    (s) => s.booking
  );
  const balance = useAppSelector((s) => s.auth.user?.balance ?? 0);
  const seat = seats.find((s) => s.id === selectedSeatIds[0]);
  const [method, setMethod] = useState<'balance' | 'card'>('balance');
  const [loading, setLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(!pendingBookingId);
  const [bookingError, setBookingError] = useState('');
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const paidRef = useRef(false);
  const bookingIdRef = useRef<string | null>(pendingBookingId);

  // Создаём бронь только здесь — кабинка резервируется только на экране оплаты
  useEffect(() => {
    if (!seat) {
      bookingIdRef.current = null;
      setBookingLoading(false);
      return;
    }
    if (!startAt) {
      setBookingError('Не выбрано время начала');
      setBookingLoading(false);
      return;
    }

    let cancelled = false;
    setBookingLoading(true);
    setBookingError('');
    bookingIdRef.current = null;
    dispatch(setPendingBookingId(null));

    createBooking(seat.id, durationHours, startAt, parseTimeWindowId(activePackageId))
      .then((b) => {
        if (cancelled) return;
        dispatch(setPendingBookingId(b.id));
        dispatch(setCalculatedPrice(b.totalPrice));
        bookingIdRef.current = b.id;
      })
      .catch((e) => {
        if (cancelled) return;
        setBookingError(e instanceof ApiError ? e.message : 'Не удалось зарезервировать место');
      })
      .finally(() => {
        if (!cancelled) setBookingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [seat?.id, durationHours, startAt, activePackageId, dispatch]);

  // При уходе с экрана без оплаты — отменяем бронь и освобождаем кабинку
  useEffect(() => {
    return () => {
      if (!paidRef.current && bookingIdRef.current) {
        cancelBooking(bookingIdRef.current).catch(() => {});
        dispatch(setPendingBookingId(null));
      }
    };
  }, []);

  const pay = async () => {
    const bookingId = bookingIdRef.current;
    if (!bookingId) return;
    if (!policyAccepted) {
      Alert.alert('Условия оплаты', PAYMENT_POLICY_ACK);
      return;
    }
    setLoading(true);
    try {
      const booking = await payBooking(bookingId);
      paidRef.current = true;
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

  if (bookingLoading) {
    return (
      <Screen>
        <Header title="Оплата" back />
        <StopkekLoader flex size="md" message="Резервируем место…" />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Header title="Оплата" back />
      {bookingError ? (
        <Text style={styles.bookingError}>{bookingError}</Text>
      ) : null}
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
      {method === 'balance' && balance < calculatedPrice && (
        <StopButton
          title="Пополнить баланс"
          variant="ghost"
          onPress={() => router.push('/wallet/topup')}
        />
      )}
      <PaymentPolicyNotice />
      <Pressable style={styles.policyRow} onPress={() => setPolicyAccepted((v) => !v)}>
        <Ionicons
          name={policyAccepted ? 'checkbox' : 'square-outline'}
          size={22}
          color={policyAccepted ? colors.accent : colors.textSecondary}
        />
        <Text style={styles.policyText}>
          {PAYMENT_POLICY_ACK}{' '}
          <Text
            style={styles.policyLink}
            onPress={() => Linking.openURL(PAYMENT_POLICY_OFFER_URL)}
          >
            Оферта
          </Text>
        </Text>
      </Pressable>
      <StopButton
        title="Оплатить"
        onPress={pay}
        disabled={
          method !== 'balance' ||
          balance < calculatedPrice ||
          loading ||
          !bookingIdRef.current ||
          !policyAccepted ||
          Boolean(bookingError)
        }
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
  policyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  policyText: { ...typography.caption, flex: 1, color: colors.textSecondary, lineHeight: 18 },
  policyLink: { color: colors.accentBright, textDecorationLine: 'underline' },
  bookingError: { ...typography.caption, color: colors.danger, textAlign: 'center', marginBottom: spacing.md },
});
