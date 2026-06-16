import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { PaymentPolicyNotice } from '../../src/components/legal/PaymentPolicyNotice';
import { Header } from '../../src/components/ui/Header';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { useAppSelector } from '../../src/store/hooks';
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
  const {
    selectedSeatIds,
    seats,
    zones,
    durationHours,
    startAt,
    calculatedPrice,
    priceQuote,
  } = useAppSelector((s) => s.booking);
  const seat = seats.find((s) => s.id === selectedSeatIds[0]);
  const zone = zones.find((z) => z.id === seat?.zoneId);

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
  strike: { textDecorationLine: 'line-through', color: colors.textDisabled },
  discount: { color: colors.accentBright },
});
