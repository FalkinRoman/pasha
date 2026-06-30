import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PaymentPolicyNotice } from '../../src/components/legal/PaymentPolicyNotice';
import { buildTimePackages } from '../../src/constants/bookingPricing';
import { Header } from '../../src/components/ui/Header';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { useAppSelector } from '../../src/store/hooks';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import {
  formatDurationHours,
  formatMoney,
  formatSessionDay,
  formatTimeHM,
} from '../../src/utils/format';

export default function SummaryScreen() {
  const {
    selectedSeatIds,
    seats,
    zones,
    durationHours,
    startAt,
    activePackageId,
    calculatedPrice,
    priceQuote,
    clubPricing,
  } = useAppSelector((s) => s.booking);

  const seat = seats.find((s) => s.id === selectedSeatIds[0]);
  const zone = zones.find((z) => z.id === seat?.zoneId);

  const startDate = useMemo(() => (startAt ? new Date(startAt) : new Date()), [startAt]);
  const endDate = useMemo(
    () => new Date(startDate.getTime() + durationHours * 3_600_000),
    [startDate, durationHours]
  );

  const timePackages = useMemo(
    () => buildTimePackages(clubPricing?.timeWindows ?? []),
    [clubPricing]
  );
  const activePkg = timePackages.find((p) => p.id === activePackageId) ?? null;
  const packageLabel = priceQuote?.packageLabel ?? activePkg?.label ?? null;

  const totalPrice = priceQuote?.totalPriceRub ?? calculatedPrice;
  const hasDiscount = (priceQuote?.discountRub ?? 0) > 0;
  const originalPrice = priceQuote?.basePriceRub ?? 0;

  return (
    <Screen scroll>
      <Header title="Итого" back />
      <>
        <View style={styles.row}>
          <Text style={typography.bodySecondary}>Место</Text>
          <Text style={[typography.body, styles.rowValue]}>
            #{seat?.number} · {zone?.name}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={typography.bodySecondary}>Начало</Text>
          <Text style={[typography.body, styles.rowValue]}>
            {formatSessionDay(startDate)} · {formatTimeHM(startDate)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={typography.bodySecondary}>Окончание</Text>
          <Text style={[typography.body, styles.rowValue]}>
            {formatSessionDay(endDate)} · {formatTimeHM(endDate)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={typography.bodySecondary}>Длительность</Text>
          <Text style={[typography.body, styles.rowValue]}>
            {formatDurationHours(durationHours)}
            {packageLabel ? ` · ${packageLabel}` : ''}
          </Text>
        </View>
        <View style={styles.total}>
          <Text style={typography.h2}>К оплате</Text>
          {hasDiscount ? (
            <Text style={styles.origPrice}>{formatMoney(originalPrice)}</Text>
          ) : null}
          <Text style={typography.h1}>{formatMoney(totalPrice)}</Text>
        </View>
        <PaymentPolicyNotice />
        <StopButton
          title="Оплатить"
          onPress={() => router.push('/booking/payment')}
          disabled={!seat}
          style={{ marginTop: 'auto' }}
        />
      </>
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
  origPrice: { ...typography.body, color: colors.textDisabled, textDecorationLine: 'line-through' },
});
