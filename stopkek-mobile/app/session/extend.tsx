import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { extendBooking, quoteExtend } from '../../src/api/bookings';
import { ApiError } from '../../src/api/client';
import { PaymentPolicyNotice } from '../../src/components/legal/PaymentPolicyNotice';
import { Card } from '../../src/components/ui/Card';
import { Header } from '../../src/components/ui/Header';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { useAppDispatch, useAppSelector } from '../../src/store/hooks';
import { setActiveBooking } from '../../src/store/bookingSlice';
import { colors } from '../../src/theme/colors';
import { radius, spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { ExtendHourQuote, ExtendMinuteQuote } from '../../src/types';
import {
  formatBookingUntil,
  formatDurationMinutes,
  formatMoney,
} from '../../src/utils/format';

type ExtendMode = 'minutes' | 'hours';

export default function ExtendScreen() {
  const dispatch = useAppDispatch();
  const booking = useAppSelector((s) => s.booking.activeBooking);
  const seatNum = booking?.seatNumbers[0] ?? 0;

  const [mode, setMode] = useState<ExtendMode>('minutes');
  const [selectedMinutes, setSelectedMinutes] = useState(15);
  const [selectedHours, setSelectedHours] = useState(1);
  const [loading, setLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [minutePresets, setMinutePresets] = useState<ExtendMinuteQuote[]>([]);
  const [hourPresets, setHourPresets] = useState<ExtendHourQuote[]>([]);
  const [pricePerHour, setPricePerHour] = useState(150);

  useEffect(() => {
    if (!booking?.id) {
      setQuoteLoading(false);
      return;
    }
    let cancelled = false;
    setQuoteLoading(true);
    quoteExtend(booking.id)
      .then((q) => {
        if (cancelled) return;
        setMinutePresets(q.minutePresets);
        setHourPresets(q.hourPresets);
        setPricePerHour(q.pricePerHour);
        if (q.minutePresets.length) {
          const preferred = q.minutePresets.find((p) => p.minutes === 15);
          setSelectedMinutes(preferred?.minutes ?? q.minutePresets[0].minutes);
        }
        if (q.hourPresets.length) {
          setSelectedHours(q.hourPresets[0].hours);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMinutePresets([]);
          setHourPresets([]);
        }
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [booking?.id]);

  const selectedMinuteQuote = useMemo(
    () => minutePresets.find((p) => p.minutes === selectedMinutes),
    [minutePresets, selectedMinutes]
  );
  const selectedHourQuote = useMemo(
    () => hourPresets.find((p) => p.hours === selectedHours),
    [hourPresets, selectedHours]
  );

  const payAmount = useMemo(() => {
    if (mode === 'minutes') {
      return (
        selectedMinuteQuote?.totalPriceRub ??
        Math.round((pricePerHour / 60) * selectedMinutes)
      );
    }
    return (
      selectedHourQuote?.totalPriceRub ??
      pricePerHour * selectedHours
    );
  }, [
    mode,
    selectedMinuteQuote,
    selectedHourQuote,
    pricePerHour,
    selectedMinutes,
    selectedHours,
  ]);

  const selectionLabel =
    mode === 'minutes'
      ? formatDurationMinutes(selectedMinutes)
      : `+${selectedHours} ч`;

  const pay = async () => {
    if (!booking) return;
    setLoading(true);
    try {
      const updated = await extendBooking(
        booking.id,
        mode === 'minutes'
          ? { minutes: selectedMinutes }
          : { hours: selectedHours }
      );
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

      {booking ? (
        <Card accent style={styles.sessionCard}>
          <View style={styles.sessionRow}>
            <View style={styles.seatBadge}>
              <Text style={styles.seatNum}>#{seatNum}</Text>
            </View>
            <View style={styles.sessionInfo}>
              <Text style={typography.h3}>{booking.zoneName}</Text>
              <Text style={typography.caption}>
                Сейчас {formatBookingUntil(booking.endAt)}
              </Text>
            </View>
            <Ionicons name="time-outline" size={22} color={colors.accent} />
          </View>
        </Card>
      ) : null}

      <Text style={styles.sectionTitle}>На сколько продлить</Text>

      <View style={styles.segment}>
        <Pressable
          style={[styles.segmentBtn, mode === 'minutes' && styles.segmentBtnActive]}
          onPress={() => setMode('minutes')}
        >
          <Text
            style={[
              styles.segmentText,
              mode === 'minutes' && styles.segmentTextActive,
            ]}
          >
            Минуты
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segmentBtn, mode === 'hours' && styles.segmentBtnActive]}
          onPress={() => setMode('hours')}
        >
          <Text
            style={[
              styles.segmentText,
              mode === 'hours' && styles.segmentTextActive,
            ]}
          >
            Часы
          </Text>
        </Pressable>
      </View>

      {mode === 'minutes' ? (
        <View style={styles.minuteGrid}>
          {minutePresets.map((preset) => {
            const active = selectedMinutes === preset.minutes;
            return (
              <Pressable
                key={preset.minutes}
                style={[styles.minuteChip, active && styles.chipActive]}
                onPress={() => setSelectedMinutes(preset.minutes)}
              >
                <Text style={[styles.chipValue, active && styles.chipTextActive]}>
                  {preset.minutes}
                </Text>
                <Text style={[styles.chipUnit, active && styles.chipUnitActive]}>
                  мин
                </Text>
                <View style={styles.chipPriceWrap}>
                  {quoteLoading && active ? (
                    <ActivityIndicator size="small" color={active ? '#fff' : colors.accent} />
                  ) : (
                    <Text style={[styles.chipPrice, active && styles.chipTextActive]}>
                      {formatMoney(preset.totalPriceRub)}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.hourList}>
          {hourPresets.map((preset) => {
            const active = selectedHours === preset.hours;
            return (
              <Pressable
                key={preset.hours}
                style={[styles.hourRow, active && styles.hourRowActive]}
                onPress={() => setSelectedHours(preset.hours)}
              >
                <View style={styles.hourLeft}>
                  <Text style={[styles.hourLabel, active && styles.chipTextActive]}>
                    +{preset.hours} ч
                  </Text>
                  {preset.badge ? (
                    <Text style={[styles.hourBadge, active && styles.hourBadgeActive]}>
                      {preset.badge}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.priceCol}>
                  {preset.discountRub > 0 ? (
                    <Text style={[styles.basePrice, active && styles.basePriceActive]}>
                      {formatMoney(preset.basePriceRub)}
                    </Text>
                  ) : null}
                  {quoteLoading && active ? (
                    <ActivityIndicator size="small" color={colors.textSecondary} />
                  ) : (
                    <Text style={[styles.hourPrice, active && styles.chipTextActive]}>
                      {formatMoney(preset.totalPriceRub)}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <Card style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={typography.caption}>Продление</Text>
            <Text style={typography.body}>{selectionLabel}</Text>
          </View>
          <View style={styles.priceCol}>
            {quoteLoading ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text style={typography.h2}>{formatMoney(payAmount)}</Text>
            )}
            <Text style={typography.caption}>{formatMoney(pricePerHour)}/ч</Text>
          </View>
        </View>
      </Card>

      <PaymentPolicyNotice compact />
      <StopButton
        title={`Оплатить ${formatMoney(payAmount)}`}
        onPress={pay}
        disabled={loading || quoteLoading}
        style={styles.cta}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sessionCard: { marginBottom: spacing.lg },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  seatBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatNum: { ...typography.h3, color: colors.accent },
  sessionInfo: { flex: 1, minWidth: 0, gap: 2 },
  sectionTitle: {
    ...typography.caption,
    marginBottom: spacing.sm,
    color: colors.textSecondary,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.bgMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginBottom: spacing.md,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  segmentBtnActive: {
    backgroundColor: colors.accent,
  },
  segmentText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: '#fff',
  },
  minuteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  minuteChip: {
    width: '30%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 88,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgMuted,
    gap: 2,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipValue: {
    ...typography.h3,
    fontWeight: '800',
    lineHeight: 28,
  },
  chipUnit: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: -2,
  },
  chipUnitActive: {
    color: 'rgba(255,255,255,0.75)',
  },
  chipPrice: {
    ...typography.caption,
    fontWeight: '600',
    marginTop: 4,
  },
  chipPriceWrap: {
    minHeight: 18,
    justifyContent: 'center',
    marginTop: 4,
  },
  chipTextActive: {
    color: '#fff',
  },
  hourList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  hourRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  hourRowActive: {
    borderColor: colors.accent,
    backgroundColor: '#1a1010',
  },
  hourLeft: { gap: 4 },
  hourLabel: { ...typography.h3 },
  hourBadge: {
    ...typography.caption,
    color: colors.accentBright,
  },
  hourBadgeActive: {
    color: 'rgba(255,255,255,0.85)',
  },
  hourPrice: { ...typography.bodySecondary },
  priceCol: { alignItems: 'flex-end', gap: 2 },
  basePrice: {
    ...typography.caption,
    textDecorationLine: 'line-through',
    color: colors.textDisabled,
  },
  basePriceActive: {
    color: 'rgba(255,255,255,0.5)',
  },
  summaryCard: { marginBottom: spacing.md },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  cta: { marginTop: 'auto' },
});
