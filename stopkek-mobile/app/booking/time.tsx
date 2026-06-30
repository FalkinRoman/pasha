import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { quoteBooking } from '../../src/api/bookings';
import { fetchClubPricing } from '../../src/api/club';
import {
  BOOKING_MAX_HOURS,
  BOOKING_MIN_HOURS,
  BookingPackage,
  buildDurationPresetHours,
  buildTimePackages,
  calcBookingPrice,
  getBookingSummaryPricing,
  getTierDiscountForHours,
  resolveBookingStartDate,
} from '../../src/constants/bookingPricing';
import { Card } from '../../src/components/ui/Card';
import { Header } from '../../src/components/ui/Header';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { useAppDispatch, useAppSelector } from '../../src/store/hooks';
import { setActivePackageId, setCalculatedPrice, setDuration, setPriceQuote, setStartAt } from '../../src/store/bookingSlice';
import { colors } from '../../src/theme/colors';
import { radius, spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { formatDurationHours, formatMoney, formatSessionDay, formatSessionRange, formatTimeHM, maxBookingDate } from '../../src/utils/format';


export default function TimeScreen() {
  const dispatch = useAppDispatch();
  const { selectedSeatIds, seats, zones, durationHours, activePackageId, priceQuote } = useAppSelector(
    (s) => s.booking
  );
  const seat         = seats.find((s) => s.id === selectedSeatIds[0]);
  const zone         = zones.find((z) => z.id === seat?.zoneId);
  const pricePerHour = zone?.pricePerHour ?? 150;

  const [pickedDate,   setPickedDate]   = useState(() => { const d = new Date(); d.setSeconds(0,0); return d; });
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [clubPricing, setClubPricing] = useState<Awaited<ReturnType<typeof fetchClubPricing>> | null>(null);

  useEffect(() => {
    fetchClubPricing().then(setClubPricing).catch(() => {});
  }, []);

  const timePackages = useMemo(
    () => buildTimePackages(clubPricing?.timeWindows ?? []),
    [clubPricing]
  );
  const durationPresetHours = useMemo(
    () => buildDurationPresetHours(clubPricing?.packages ?? []),
    [clubPricing]
  );
  const durationPackages = clubPricing?.packages ?? [];

  const [useCustom, setUseCustom] = useState(
    () => !activePackageId && !durationPresetHours.some((h) => h === durationHours)
  );
  const [customHoursText, setCustomHoursText] = useState(() => String(durationHours));
  const customActive = useCustom && !activePackageId;

  const customHours = useMemo(() => {
    const n = parseInt(customHoursText.replace(/\D/g, ''), 10);
    if (!n || n < BOOKING_MIN_HOURS) return BOOKING_MIN_HOURS;
    if (n > BOOKING_MAX_HOURS) return BOOKING_MAX_HOURS;
    return n;
  }, [customHoursText]);

  const hoursError = useMemo(() => {
    if (!customActive) return '';
    const n = parseInt(customHoursText.replace(/\D/g, ''), 10);
    if (!n || n < BOOKING_MIN_HOURS || n > BOOKING_MAX_HOURS) {
      return `От ${BOOKING_MIN_HOURS} до ${BOOKING_MAX_HOURS} ч`;
    }
    return '';
  }, [customHoursText, customActive]);

  const effectiveHours = customActive ? customHours : durationHours;

  const minDate = useMemo(() => { const d = new Date(); d.setSeconds(0, 0); return d; }, []);
  const maxDate = useMemo(() => maxBookingDate(), []);

  const startDate = useMemo(
    () => resolveBookingStartDate(pickedDate, activePackageId, timePackages),
    [pickedDate, activePackageId, timePackages]
  );

  const endDate    = useMemo(() => new Date(startDate.getTime() + effectiveHours * 3_600_000), [startDate, effectiveHours]);
  const startAtIso = startDate.toISOString();
  const summaryPricing = useMemo(
    () =>
      getBookingSummaryPricing(
        pricePerHour,
        effectiveHours,
        activePackageId,
        timePackages,
        durationPackages
      ),
    [pricePerHour, effectiveHours, activePackageId, timePackages, durationPackages]
  );
  const pkg = summaryPricing.pkg;

  useEffect(() => {
    dispatch(setCalculatedPrice(summaryPricing.discounted));
    dispatch(setStartAt(startAtIso));
  }, [summaryPricing.discounted, startAtIso, dispatch]);

  useEffect(() => {
    if (!seat?.id || hoursError) return;
    let cancelled = false;
    setQuoteLoading(true);
    quoteBooking(seat.id, effectiveHours, startAtIso)
      .then((q) => { if (!cancelled) dispatch(setPriceQuote(q)); })
      .catch(() => { if (!cancelled) dispatch(setPriceQuote(null)); })
      .finally(() => { if (!cancelled) setQuoteLoading(false); });
    return () => { cancelled = true; };
  }, [seat?.id, effectiveHours, startAtIso, hoursError, dispatch]);

  const selectPreset = (h: number) => {
    setUseCustom(false);
    dispatch(setActivePackageId(null));
    dispatch(setDuration(h));
    setCustomHoursText(String(h));
  };

  const selectPackage = (p: BookingPackage) => {
    const isActive = activePackageId === p.id;
    setUseCustom(false);
    dispatch(setActivePackageId(isActive ? null : p.id));
    const next = isActive ? effectiveHours : p.hours;
    dispatch(setDuration(next));
    setCustomHoursText(String(next));
  };

  const activateCustom = () => {
    setUseCustom(true);
    dispatch(setActivePackageId(null));
    dispatch(setDuration(customHours));
    setCustomHoursText(String(customHours));
  };

  const onCustomHours = (text: string) => {
    setUseCustom(true);
    dispatch(setActivePackageId(null));
    const digits = text.replace(/\D/g, '');
    setCustomHoursText(digits);
    const n = parseInt(digits, 10);
    if (n >= BOOKING_MIN_HOURS && n <= BOOKING_MAX_HOURS) dispatch(setDuration(n));
  };

  const stepCustomHours = (delta: number) => {
    setUseCustom(true);
    dispatch(setActivePackageId(null));
    const next = Math.min(BOOKING_MAX_HOURS, Math.max(BOOKING_MIN_HOURS, customHours + delta));
    setCustomHoursText(String(next));
    dispatch(setDuration(next));
  };

  const customPricing = useMemo(
    () =>
      calcBookingPrice(
        pricePerHour,
        customHours,
        getTierDiscountForHours(customHours, durationPackages)
      ),
    [pricePerHour, customHours, durationPackages]
  );
  const customDiscount = getTierDiscountForHours(customHours, durationPackages);

  const presetRows = useMemo(() => {
    return durationPresetHours.map((hours) => {
      const fromQuote = priceQuote?.presets?.find((p) => p.hours === hours);
      const pkg = durationPackages.find((p) => p.minHours === hours);
      const discountPct =
        hours === 1
          ? 0
          : fromQuote && fromQuote.basePriceRub > 0
            ? Math.round((fromQuote.discountRub / fromQuote.basePriceRub) * 100)
            : pkg?.discountPercent ?? getTierDiscountForHours(hours, durationPackages);
      const pricing = fromQuote
        ? {
            original: fromQuote.basePriceRub,
            discounted: fromQuote.totalPriceRub,
            discount: fromQuote.discountRub,
            hasDiscount: fromQuote.discountRub > 0,
          }
        : calcBookingPrice(pricePerHour, hours, discountPct);
      return { hours, discountPct, pricing, badge: pkg?.badge ?? fromQuote?.badge ?? null };
    });
  }, [durationPresetHours, priceQuote, durationPackages, pricePerHour]);

  return (
    <Screen scroll>
      <Header title="Время сеанса" back />

      {/* Место */}
      <Card style={styles.seatCard}>
        <View style={styles.seatRow}>
          <View style={styles.seatBadge}>
            <Text style={styles.seatNum}>#{seat?.number ?? '—'}</Text>
          </View>
          <View style={styles.seatInfo}>
            <Text style={typography.h3}>{zone?.name ?? 'Зона'}</Text>
            <Text style={typography.caption}>{zone?.specs}</Text>
          </View>
          <Text style={typography.caption}>{formatMoney(pricePerHour)}/ч</Text>
        </View>
      </Card>

      {/* Начало сеанса */}
      <Text style={styles.sectionTitle}>Начало сеанса</Text>
      <Card style={styles.pickerCard}>
        <Text style={styles.pickerHint}>{formatSessionRange(startDate, endDate)}</Text>
        <DateTimePicker
          value={pickedDate}
          mode="datetime"
          display="spinner"
          locale="ru_RU"
          is24Hour
          minuteInterval={1}
          minimumDate={minDate}
          maximumDate={maxDate}
          textColor={colors.text}
          accentColor={colors.accent}
          themeVariant="dark"
          onChange={(_: unknown, date?: Date) => {
            if (!date) return;
            const d = new Date(date);
            d.setSeconds(0, 0);
            if (d < minDate) { setPickedDate(minDate); dispatch(setActivePackageId(null)); return; }
            if (d > maxDate) { setPickedDate(maxDate); dispatch(setActivePackageId(null)); return; }
            setPickedDate(d);
            dispatch(setActivePackageId(null));
          }}
          style={styles.picker}
        />
      </Card>

      {/* Сколько играть */}
      <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Сколько играть</Text>
      <View style={styles.presetsBlock}>
        <View style={styles.presets}>
          {presetRows.map(({ hours, discountPct, pricing }) => {
            const active  = !activePackageId && !customActive && durationHours === hours;
            return (
              <Pressable key={hours} style={[styles.preset, active && styles.presetActive]} onPress={() => selectPreset(hours)}>
                {discountPct > 0 && (
                  <View style={[styles.discBadge, active && styles.discBadgeActive]}>
                    <Text style={[styles.discBadgeText, active && styles.discBadgeTextActive]}>−{discountPct}%</Text>
                  </View>
                )}
                <Text style={[styles.presetHours, active && styles.presetTextActive]}>{hours} ч</Text>
                {pricing.hasDiscount ? (
                  <>
                    <Text style={[styles.presetOrigPrice, active && styles.presetOrigPriceActive]}>{formatMoney(pricing.original)}</Text>
                    <Text style={[styles.presetDiscPrice, active && styles.presetTextActive]}>{formatMoney(pricing.discounted)}</Text>
                  </>
                ) : (
                  <Text style={[styles.presetDiscPrice, active && styles.presetTextActive]}>{formatMoney(pricing.original)}</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[styles.customRow, customActive && styles.presetActive]}
          onPress={activateCustom}
        >
          <Text style={[styles.customTag, customActive && styles.presetTextActive]}>Своё</Text>
          <View style={[styles.customControls, customActive && styles.customControlsActive]}>
            <Pressable
              style={[styles.customBtn, customActive && styles.customBtnActive]}
              onPress={() => stepCustomHours(-1)}
              hitSlop={4}
            >
              <Text style={[styles.customBtnText, customActive && styles.presetTextActive]}>−</Text>
            </Pressable>
            <View style={[styles.customValueWrap, customActive && styles.customValueWrapActive]}>
              <TextInput
                style={[styles.customInput, customActive && styles.presetTextActive]}
                value={customHoursText}
                onChangeText={onCustomHours}
                onFocus={activateCustom}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
              />
              <Text style={[styles.customUnit, customActive && styles.presetTextActive]}>ч</Text>
            </View>
            <Pressable
              style={[styles.customBtn, customActive && styles.customBtnActive]}
              onPress={() => stepCustomHours(1)}
              hitSlop={4}
            >
              <Text style={[styles.customBtnText, customActive && styles.presetTextActive]}>+</Text>
            </Pressable>
          </View>
          <View style={styles.customPriceWrap}>
            {customActive && customDiscount > 0 && (
              <View style={[styles.discBadgeInline, customActive && styles.discBadgeActive]}>
                <Text style={[styles.discBadgeText, customActive && styles.discBadgeTextActive]}>−{customDiscount}%</Text>
              </View>
            )}
            <Text style={[styles.customPrice, customActive && styles.presetTextActive]}>
              {formatMoney(customPricing.discounted)}
            </Text>
          </View>
        </Pressable>
        {customActive && hoursError ? <Text style={styles.customError}>{hoursError}</Text> : null}
      </View>

      {/* Пакеты */}
      <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Пакеты</Text>
      <View style={styles.packages}>
        {timePackages.map((p) => {
          const active  = activePackageId === p.id;
          const pricing = calcBookingPrice(pricePerHour, p.hours, p.discountPct);
          return (
            <Pressable key={p.id} style={[styles.packageCard, active && styles.packageCardActive]} onPress={() => selectPackage(p)}>
              <View style={[styles.pkgDiscBadge, active && styles.pkgDiscBadgeActive]}>
                <Text style={[styles.pkgDiscText, active && styles.pkgDiscTextActive]}>−{p.discountPct}%</Text>
              </View>
              <View style={styles.pkgInfo}>
                <Text style={[typography.body, { fontWeight: '700' }, active && styles.pkgTextActive]}>{p.label}</Text>
                <Text style={[styles.pkgWindow, active && styles.pkgWindowActive]}>{p.window} · {p.hours} ч</Text>
              </View>
              <View style={styles.pkgPriceCol}>
                <Text style={[styles.pkgOrigPrice, active && styles.pkgOrigPriceActive]}>{formatMoney(pricing.original)}</Text>
                <Text style={[styles.pkgDiscPrice, active && styles.pkgDiscPriceActive]}>{formatMoney(pricing.discounted)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Итог */}
      <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Итог</Text>
      <Card accent style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              {formatSessionDay(startDate)} · {formatTimeHM(startDate)} — {formatTimeHM(endDate)}
            </Text>
            <Text style={typography.body}>
              {formatDurationHours(effectiveHours)}{pkg ? `  ·  ${pkg.label}` : ''}
            </Text>
          </View>
          <View style={styles.priceCol}>
            {summaryPricing.hasDiscount && (
              <Text style={styles.origPriceLabel}>{formatMoney(summaryPricing.original)}</Text>
            )}
            <View style={styles.priceRow}>
              {quoteLoading && <ActivityIndicator size="small" color={colors.accent} />}
              <Text style={typography.h2}>{formatMoney(summaryPricing.discounted)}</Text>
            </View>
          </View>
        </View>
      </Card>

      <StopButton
        title="Продолжить"
        onPress={() => { if (!quoteLoading && !(customActive && hoursError)) router.push('/booking/summary'); }}
        disabled={quoteLoading || (customActive && Boolean(hoursError))}
        style={styles.cta}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  seatCard: { marginBottom: spacing.lg },
  seatRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  seatBadge: {
    width: 48, height: 48, borderRadius: radius.md,
    backgroundColor: colors.accentMuted, borderWidth: 1, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  seatNum:  { ...typography.h3, color: colors.accent },
  seatInfo: { flex: 1, minWidth: 0, gap: 2 },
  sectionTitle: { ...typography.caption, marginBottom: spacing.sm, color: colors.textSecondary },

  presetsBlock: { marginBottom: spacing.md, gap: spacing.sm },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    gap: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgMuted,
  },
  customTag: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 12,
    color: colors.textSecondary,
    width: 38,
  },
  customControls: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    overflow: 'hidden',
  },
  customControlsActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.28)',
  },
  customBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customBtnActive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  customBtnText: {
    fontSize: 22,
    fontWeight: '500',
    color: colors.text,
    lineHeight: 24,
  },
  customValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
    height: 44,
    paddingHorizontal: spacing.xs,
    gap: 3,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  customValueWrapActive: { borderColor: 'rgba(255,255,255,0.28)' },
  customInput: {
    width: 26,
    height: 44,
    textAlign: 'center',
    ...typography.body,
    fontWeight: '700',
    fontSize: 17,
    lineHeight: 22,
    paddingVertical: 0,
    paddingHorizontal: 0,
    color: colors.text,
  },
  customUnit: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 17,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  customPriceWrap: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 76,
    justifyContent: 'flex-end',
  },
  discBadgeInline: {
    backgroundColor: colors.accentMuted,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  customPrice: { ...typography.caption, fontWeight: '600', fontSize: 13, color: colors.text },
  customError: { ...typography.caption, color: colors.danger, textAlign: 'center' },
  preset: {
    width: '22%', flexGrow: 1, alignItems: 'center',
    paddingVertical: spacing.md, paddingTop: 20,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bgMuted, position: 'relative', minHeight: 90, gap: 2,
  },
  presetActive:          { backgroundColor: colors.accent, borderColor: colors.accent },
  presetTextActive:      { color: '#fff' },
  presetHours:           { ...typography.body, fontWeight: '700' },
  presetOrigPrice:       { ...typography.caption, color: colors.textDisabled, textDecorationLine: 'line-through', fontSize: 11 },
  presetOrigPriceActive: { color: 'rgba(255,255,255,0.5)' },
  presetDiscPrice:       { ...typography.caption, fontWeight: '600', color: colors.text },
  discBadge: {
    position: 'absolute', top: 5, right: 5,
    backgroundColor: colors.accentMuted, borderRadius: radius.sm,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  discBadgeActive:     { backgroundColor: 'rgba(255,255,255,0.25)' },
  discBadgeText:       { fontSize: 9, fontWeight: '800', color: colors.accentBright },
  discBadgeTextActive: { color: '#fff' },

  packages: { gap: spacing.sm, marginBottom: spacing.md },
  packageCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bgMuted,
  },
  packageCardActive:  { backgroundColor: colors.accent, borderColor: colors.accent },
  pkgDiscBadge:       {
    backgroundColor: colors.accentMuted, borderRadius: radius.sm,
    paddingHorizontal: 8, paddingVertical: 5, minWidth: 50, alignItems: 'center',
  },
  pkgDiscBadgeActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  pkgDiscText:        { fontSize: 14, fontWeight: '800', color: colors.accentBright },
  pkgDiscTextActive:  { color: '#fff' },
  pkgInfo:            { flex: 1, gap: 2 },
  pkgWindow:          { ...typography.caption, color: colors.textSecondary },
  pkgWindowActive:    { color: 'rgba(255,255,255,0.75)' },
  pkgTextActive:      { color: '#fff' },
  pkgPriceCol:        { alignItems: 'flex-end', gap: 3 },
  pkgOrigPrice:       { ...typography.caption, color: colors.textDisabled, textDecorationLine: 'line-through' },
  pkgOrigPriceActive: { color: 'rgba(255,255,255,0.5)' },
  pkgDiscPrice:       { ...typography.body, fontWeight: '700', color: colors.text },
  pkgDiscPriceActive: { color: '#fff' },

  pickerCard: { marginBottom: spacing.md, alignItems: 'center', paddingBottom: spacing.md },
  pickerHint: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    paddingTop: spacing.xs,
  },
  picker:          { width: '100%', height: 180 },

  summaryCard:    { marginBottom: spacing.md },
  summaryRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  priceCol:       { alignItems: 'flex-end' },
  priceRow:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  origPriceLabel: { ...typography.caption, color: colors.textDisabled, textDecorationLine: 'line-through' },

  cta: { marginTop: 'auto' },
});
