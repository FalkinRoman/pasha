import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { extendBooking, quoteExtend } from '../../src/api/bookings';
import { ApiError } from '../../src/api/client';
import { ExtendHoursSection } from '../../src/components/booking/ExtendHoursSection';
import { ExtendMinutesSection } from '../../src/components/booking/ExtendMinutesSection';
import { ExtendMode, ExtendModeTabs } from '../../src/components/booking/ExtendModeTabs';
import { PaymentPolicyNotice } from '../../src/components/legal/PaymentPolicyNotice';
import { parseTimeWindowId } from '../../src/constants/bookingPricing';
import { Card } from '../../src/components/ui/Card';
import { Header } from '../../src/components/ui/Header';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { useAppDispatch, useAppSelector } from '../../src/store/hooks';
import { setActiveBooking } from '../../src/store/bookingSlice';
import { colors } from '../../src/theme/colors';
import { radius, spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { ExtendHourQuote, ExtendMinuteQuote, ExtendPackageQuote } from '../../src/types';
import {
  formatDurationMinutes,
  formatGameEndLine,
  formatMoney,
} from '../../src/utils/format';

export default function ExtendScreen() {
  const dispatch = useAppDispatch();
  const booking = useAppSelector((s) => s.booking.activeBooking);
  const seatNum = booking?.seatNumbers[0] ?? 0;

  const [mode, setMode] = useState<ExtendMode>('hours');
  const [selectedMinutes, setSelectedMinutes] = useState(15);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [selectedHours, setSelectedHours] = useState(1);
  const [loading, setLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [minutePresets, setMinutePresets] = useState<ExtendMinuteQuote[]>([]);
  const [hourPresets, setHourPresets] = useState<ExtendHourQuote[]>([]);
  const [packagePresets, setPackagePresets] = useState<ExtendPackageQuote[]>([]);
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
        setPackagePresets(q.packagePresets ?? []);
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
          setPackagePresets([]);
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
  const selectedPackageQuote = useMemo(
    () => packagePresets.find((p) => p.packageId === selectedPackageId),
    [packagePresets, selectedPackageId]
  );

  const resolvedPackagePay = useMemo(() => {
    if (!selectedPackageId) return null;
    if (selectedPackageQuote) return selectedPackageQuote.totalPriceRub;
    const hourMeta = hourPresets.find((p) => p.hours === selectedHours);
    return hourMeta?.totalPriceRub ?? null;
  }, [selectedPackageId, selectedPackageQuote, hourPresets, selectedHours]);

  const selectPreset = (hours: number) => {
    setSelectedPackageId(null);
    setSelectedHours(hours);
  };

  const selectPackage = (packageId: string, hours: number) => {
    if (selectedPackageId === packageId) {
      setSelectedPackageId(null);
      setSelectedHours(1);
      return;
    }
    setSelectedPackageId(packageId);
    setSelectedHours(hours);
  };

  const payAmount = useMemo(() => {
    if (mode === 'minutes') {
      return (
        selectedMinuteQuote?.totalPriceRub ??
        Math.round((pricePerHour / 60) * selectedMinutes)
      );
    }
    if (resolvedPackagePay != null) return resolvedPackagePay;
    return (
      selectedHourQuote?.totalPriceRub ??
      pricePerHour * selectedHours
    );
  }, [
    mode,
    selectedMinuteQuote,
    selectedHourQuote,
    resolvedPackagePay,
    pricePerHour,
    selectedMinutes,
    selectedHours,
  ]);

  const selectionLabel =
    mode === 'minutes'
      ? formatDurationMinutes(selectedMinutes)
      : selectedPackageId
        ? `+${selectedPackageQuote?.label ?? selectedHours + ' ч'}`
        : `+${selectedHours} ч`;

  const pay = async () => {
    if (!booking) return;
    setLoading(true);
    try {
      const updated = await extendBooking(
        booking.id,
        mode === 'minutes'
          ? { minutes: selectedMinutes }
          : {
              hours: selectedHours,
              timeWindowId: selectedPackageId
                ? parseTimeWindowId(selectedPackageId)
                : undefined,
            }
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
    <Screen scroll style={styles.screen}>
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
                {formatGameEndLine(booking.endAt)}
              </Text>
            </View>
            <Ionicons name="time-outline" size={22} color={colors.accent} />
          </View>
        </Card>
      ) : null}

      <Text style={styles.sectionTitle}>На сколько продлить</Text>
      <ExtendModeTabs mode={mode} onChange={setMode} />

      {mode === 'hours' ? (
        <ExtendHoursSection
          presets={hourPresets}
          packagePresets={packagePresets}
          selectedHours={selectedHours}
          selectedPackageId={selectedPackageId}
          quoteLoading={quoteLoading}
          onSelectPreset={selectPreset}
          onSelectPackage={selectPackage}
        />
      ) : (
        <ExtendMinutesSection
          presets={minutePresets}
          selectedMinutes={selectedMinutes}
          onSelect={setSelectedMinutes}
        />
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

      <View style={styles.policyWrap}>
        <PaymentPolicyNotice compact />
      </View>

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
  screen: { paddingBottom: spacing.xxl },
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
  summaryCard: { marginTop: spacing.md, marginBottom: spacing.md },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  priceCol: { alignItems: 'flex-end', gap: 2 },
  policyWrap: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  cta: { marginTop: 0 },
});
