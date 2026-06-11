import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { extendBooking, quoteBooking } from '../../src/api/bookings';
import { ApiError } from '../../src/api/client';
import { PaymentPolicyNotice } from '../../src/components/legal/PaymentPolicyNotice';
import { Header } from '../../src/components/ui/Header';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { useAppDispatch, useAppSelector } from '../../src/store/hooks';
import { setActiveBooking } from '../../src/store/bookingSlice';
import { colors } from '../../src/theme/colors';
import { radius, spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { PresetQuote } from '../../src/types';
import { formatMoney } from '../../src/utils/format';

const HOURS = [1, 2, 3, 4];

export default function ExtendScreen() {
  const dispatch = useAppDispatch();
  const booking = useAppSelector((s) => s.booking.activeBooking);
  const seatId = useAppSelector((s) => {
    const nums = s.booking.activeBooking?.seatNumbers;
    if (!nums?.length) return null;
    return s.booking.seats.find((seat) => seat.number === nums[0])?.id ?? null;
  });
  const [selected, setSelected] = useState(1);
  const [loading, setLoading] = useState(false);
  const [presets, setPresets] = useState<PresetQuote[]>([]);
  const [quoteLoading, setQuoteLoading] = useState(true);

  useEffect(() => {
    if (!seatId || !booking?.endAt) {
      setQuoteLoading(false);
      return;
    }
    let cancelled = false;
    setQuoteLoading(true);
    quoteBooking(seatId, 4, booking.endAt)
      .then((q) => {
        if (!cancelled) setPresets(q.presets.filter((p) => HOURS.includes(p.hours)));
      })
      .catch(() => {
        if (!cancelled) setPresets([]);
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [seatId, booking?.endAt]);

  const selectedQuote = presets.find((p) => p.hours === selected);
  const payAmount =
    selectedQuote?.totalPriceRub ??
    (booking?.totalPrice && booking.durationMinutes
      ? Math.round((booking.totalPrice / (booking.durationMinutes / 60)) * selected)
      : 150 * selected);

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
      {HOURS.map((h) => {
        const meta = presets.find((p) => p.hours === h);
        const active = selected === h;
        return (
          <Pressable
            key={h}
            style={[styles.opt, active && styles.optActive]}
            onPress={() => setSelected(h)}
          >
            <View>
              <Text style={typography.h3}>+{h} ч</Text>
              {meta?.badge ? (
                <Text style={styles.badge}>{meta.badge}</Text>
              ) : null}
            </View>
            <View style={styles.priceCol}>
              {meta && meta.discountRub > 0 ? (
                <Text style={styles.basePrice}>{formatMoney(meta.basePriceRub)}</Text>
              ) : null}
              <Text style={typography.bodySecondary}>
                {quoteLoading && active ? (
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                ) : (
                  formatMoney(meta?.totalPriceRub ?? payAmount)
                )}
              </Text>
            </View>
          </Pressable>
        );
      })}
      <PaymentPolicyNotice compact />
      <StopButton
        title={`Оплатить ${formatMoney(payAmount)}`}
        onPress={pay}
        disabled={loading || quoteLoading}
        style={{ marginTop: 'auto' }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  opt: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    backgroundColor: colors.bgCard,
  },
  optActive: { borderColor: colors.accent, backgroundColor: '#1a1010' },
  priceCol: { alignItems: 'flex-end' },
  basePrice: {
    ...typography.caption,
    textDecorationLine: 'line-through',
    color: colors.textDisabled,
  },
  badge: {
    ...typography.caption,
    color: colors.accentBright,
    marginTop: 2,
  },
});
