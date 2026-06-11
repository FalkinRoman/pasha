import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createBooking } from '../../src/api/bookings';
import { ApiError } from '../../src/api/client';
import { PaymentPolicyNotice } from '../../src/components/legal/PaymentPolicyNotice';
import { Header } from '../../src/components/ui/Header';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { StopkekLoader } from '../../src/components/ui/StopkekLoader';
import { useAppDispatch, useAppSelector } from '../../src/store/hooks';
import { setCalculatedPrice, setPendingBookingId } from '../../src/store/bookingSlice';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import {
  formatMoney,
  formatSessionDateLine,
  formatTimeHM,
  formatDurationHours,
} from '../../src/utils/format';

export default function SummaryScreen() {
  const dispatch = useAppDispatch();
  const {
    selectedSeatIds,
    seats,
    zones,
    durationHours,
    startAt,
    calculatedPrice,
    priceQuote,
    pendingBookingId,
  } = useAppSelector((s) => s.booking);
  const seat = seats.find((s) => s.id === selectedSeatIds[0]);
  const zone = zones.find((z) => z.id === seat?.zoneId);
  const [loading, setLoading] = useState(!pendingBookingId);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!seat || pendingBookingId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    createBooking(seat.id, durationHours, startAt ?? undefined)
      .then((b) => {
        dispatch(setPendingBookingId(b.id));
        dispatch(setCalculatedPrice(b.totalPrice));
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : 'Не удалось забронировать место');
      })
      .finally(() => setLoading(false));
  }, [seat?.id, durationHours, pendingBookingId, dispatch]);

  return (
    <Screen scroll>
      <Header title="Итого" back />
      {loading ? (
        <StopkekLoader flex size="md" message="Резервируем место" />
      ) : (
        <>
          <View style={styles.row}>
            <Text style={typography.bodySecondary}>Место</Text>
            <Text style={[typography.body, styles.rowValue]}>
              #{seat?.number} · {zone?.name}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={typography.bodySecondary}>Железо</Text>
            <Text style={[typography.body, styles.rowValue]} numberOfLines={2}>
              {zone?.specs}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={typography.bodySecondary}>Начало</Text>
            <Text style={[typography.body, styles.rowValue]}>
              {startAt
                ? `${formatTimeHM(new Date(startAt))} · ${formatSessionDateLine(new Date(startAt))}`
                : 'Сейчас'}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={typography.bodySecondary}>Длительность</Text>
            <Text style={[typography.body, styles.rowValue]}>
              {formatDurationHours(durationHours)}
            </Text>
          </View>
          {(priceQuote?.discountRub ?? 0) > 0 ? (
            <>
              <View style={styles.row}>
                <Text style={typography.bodySecondary}>Без скидки</Text>
                <Text style={[typography.body, styles.rowValue, styles.strike]}>
                  {formatMoney(priceQuote?.basePriceRub ?? calculatedPrice)}
                </Text>
              </View>
              {priceQuote?.discounts.map((d, i) => (
                <View key={i} style={styles.row}>
                  <Text style={typography.bodySecondary}>{d.label}</Text>
                  <Text style={[typography.body, styles.rowValue, styles.discount]}>
                    −{formatMoney(Math.round(d.amountKopecks / 100))}
                  </Text>
                </View>
              ))}
            </>
          ) : null}
          <View style={styles.total}>
            <Text style={typography.h2}>К оплате</Text>
            <Text style={typography.h1}>{formatMoney(calculatedPrice)}</Text>
          </View>
          <PaymentPolicyNotice />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <StopButton
            title="Оплатить"
            onPress={() => router.push('/booking/payment')}
            disabled={!pendingBookingId || Boolean(error)}
            style={{ marginTop: 'auto' }}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  rowValue: { flex: 1, textAlign: 'right', flexShrink: 1 },
  total: { marginTop: spacing.xl, alignItems: 'center', gap: spacing.sm },
  strike: { textDecorationLine: 'line-through', color: colors.textDisabled },
  discount: { color: colors.accentBright },
  error: { ...typography.caption, color: colors.danger, textAlign: 'center', marginTop: spacing.md },
});
