import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card } from '../../src/components/ui/Card';
import { Header } from '../../src/components/ui/Header';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { useAppDispatch, useAppSelector } from '../../src/store/hooks';
import { setCalculatedPrice, setDuration, setStartAt } from '../../src/store/bookingSlice';
import { colors } from '../../src/theme/colors';
import { radius, spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import {
  formatDurationHours,
  formatMoney,
  formatSessionDateLine,
  formatSessionDay,
  formatTimeHM,
} from '../../src/utils/format';

const PRESETS = [1, 2, 3, 4, 6, 8];
const MIN_HOURS = 1;
const MAX_HOURS = 12;

function roundToNextSlot(d: Date) {
  const x = new Date(d);
  const m = x.getMinutes();
  const add = m % 30 === 0 ? 0 : 30 - (m % 30);
  x.setMinutes(m + add, 0, 0);
  return x;
}

function buildTimeSlots(from: Date) {
  const slots: Date[] = [];
  let t = roundToNextSlot(from);
  const end = new Date(t);
  end.setHours(23, 30, 0, 0);
  while (t.getTime() <= end.getTime()) {
    slots.push(new Date(t));
    t = new Date(t.getTime() + 30 * 60_000);
  }
  return slots;
}

export default function TimeScreen() {
  const dispatch = useAppDispatch();
  const { selectedSeatIds, seats, zones, durationHours } = useAppSelector((s) => s.booking);
  const seat = seats.find((s) => s.id === selectedSeatIds[0]);
  const zone = zones.find((z) => z.id === seat?.zoneId);
  const pricePerHour = zone?.pricePerHour ?? 150;

  const [startMode, setStartMode] = useState<'now' | 'pick'>('now');
  const [nowAnchor, setNowAnchor] = useState(() => new Date());
  const timeSlots = useMemo(() => buildTimeSlots(new Date()), []);
  const [pickedStart, setPickedStart] = useState(() => timeSlots[0] ?? new Date());
  const [customHoursText, setCustomHoursText] = useState(String(durationHours));
  const [useCustomHours, setUseCustomHours] = useState(!PRESETS.includes(durationHours));

  const hours = useMemo(() => {
    const n = parseInt(customHoursText.replace(/\D/g, ''), 10);
    if (!n || n < MIN_HOURS) return MIN_HOURS;
    if (n > MAX_HOURS) return MAX_HOURS;
    return n;
  }, [customHoursText]);

  const effectiveHours = useCustomHours ? hours : durationHours;

  const startDate = startMode === 'now' ? nowAnchor : pickedStart;

  useEffect(() => {
    if (startMode === 'now') setNowAnchor(new Date());
  }, [startMode]);

  const endDate = useMemo(
    () => new Date(startDate.getTime() + effectiveHours * 3600_000),
    [startDate, effectiveHours]
  );

  const totalPrice = pricePerHour * effectiveHours;
  const hoursError =
    hours < MIN_HOURS || hours > MAX_HOURS
      ? `От ${MIN_HOURS} до ${MAX_HOURS} ч`
      : '';

  useEffect(() => {
    dispatch(setDuration(effectiveHours));
    dispatch(setStartAt(startDate.toISOString()));
    dispatch(setCalculatedPrice(totalPrice));
  }, [effectiveHours, startDate, totalPrice, dispatch]);

  const selectPreset = (h: number) => {
    setUseCustomHours(false);
    dispatch(setDuration(h));
    setCustomHoursText(String(h));
  };

  const onCustomHours = (text: string) => {
    setUseCustomHours(true);
    setCustomHoursText(text.replace(/\D/g, ''));
  };

  const stepHours = (delta: number) => {
    setUseCustomHours(true);
    const next = Math.min(MAX_HOURS, Math.max(MIN_HOURS, hours + delta));
    setCustomHoursText(String(next));
  };

  const next = () => {
    if (hoursError) return;
    router.push('/booking/summary');
  };

  return (
    <Screen scroll>
      <Header title="Время сеанса" back />

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

      <Text style={styles.sectionTitle}>Когда начать</Text>
      <View style={styles.segment}>
        <Pressable
          style={[styles.segmentBtn, startMode === 'now' && styles.segmentActive]}
          onPress={() => setStartMode('now')}
        >
          <Ionicons
            name="flash"
            size={16}
            color={startMode === 'now' ? '#fff' : colors.textSecondary}
          />
          <Text style={[styles.segmentText, startMode === 'now' && styles.segmentTextActive]}>
            Сейчас
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segmentBtn, startMode === 'pick' && styles.segmentActive]}
          onPress={() => setStartMode('pick')}
        >
          <Ionicons
            name="time-outline"
            size={16}
            color={startMode === 'pick' ? '#fff' : colors.textSecondary}
          />
          <Text style={[styles.segmentText, startMode === 'pick' && styles.segmentTextActive]}>
            По расписанию
          </Text>
        </Pressable>
      </View>

      {startMode === 'pick' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.slotsRow}
        >
          {timeSlots.map((slot) => {
            const active = pickedStart.getTime() === slot.getTime();
            return (
              <Pressable
                key={slot.toISOString()}
                style={[styles.slotChip, active && styles.slotChipActive]}
                onPress={() => setPickedStart(slot)}
              >
                <Text style={[typography.body, active && styles.slotTextActive]}>
                  {formatTimeHM(slot)}
                </Text>
                <Text style={[typography.caption, active && styles.slotTextActive]}>
                  {formatSessionDay(slot)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <Text style={[typography.caption, styles.nowHint]}>
          Сеанс начнётся сразу после оплаты
        </Text>
      )}

      <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Сколько играть</Text>
      <View style={styles.presets}>
        {PRESETS.map((h) => (
          <Pressable
            key={h}
            style={[styles.preset, !useCustomHours && durationHours === h && styles.presetActive]}
            onPress={() => selectPreset(h)}
          >
            <Text
              style={[
                typography.body,
                !useCustomHours && durationHours === h && styles.presetTextActive,
              ]}
            >
              {h} ч
            </Text>
          </Pressable>
        ))}
      </View>

      <Card style={styles.customCard}>
        <Text style={typography.caption}>Своя длительность</Text>
        <View style={styles.stepperRow}>
          <Pressable style={styles.stepBtn} onPress={() => stepHours(-1)}>
            <Ionicons name="remove" size={22} color={colors.text} />
          </Pressable>
          <TextInput
            style={styles.hoursInput}
            value={customHoursText}
            onChangeText={onCustomHours}
            keyboardType="number-pad"
            maxLength={2}
            selectTextOnFocus
          />
          <Pressable style={styles.stepBtn} onPress={() => stepHours(1)}>
            <Ionicons name="add" size={22} color={colors.text} />
          </Pressable>
          <Text style={typography.body}>часов</Text>
        </View>
        {hoursError ? <Text style={styles.error}>{hoursError}</Text> : null}
      </Card>

      <Card accent style={styles.timelineCard}>
        <View style={styles.timelineHeader}>
          <View style={styles.timelineCol}>
            <Text style={typography.caption}>Начало</Text>
            <Text style={styles.timelineTime}>{formatTimeHM(startDate)}</Text>
            <Text style={typography.caption}>{formatSessionDateLine(startDate)}</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color={colors.textSecondary} />
          <View style={[styles.timelineCol, styles.timelineColEnd]}>
            <Text style={typography.caption}>Конец</Text>
            <Text style={styles.timelineTime}>{formatTimeHM(endDate)}</Text>
            <Text style={typography.caption}>{formatSessionDateLine(endDate)}</Text>
          </View>
        </View>

        <View style={styles.barTrack}>
          <View style={styles.barFill} />
          <View style={styles.barDotStart} />
          <View style={styles.barDotEnd} />
        </View>

        <View style={styles.summaryRow}>
          <Text style={typography.body}>{formatDurationHours(effectiveHours)}</Text>
          <Text style={typography.h3}>{formatMoney(totalPrice)}</Text>
        </View>
        <Text style={[typography.caption, styles.tariff]}>
          Тариф {zone?.name} · {formatMoney(pricePerHour)}/ч
        </Text>
      </Card>

      <StopButton
        title="Продолжить"
        onPress={next}
        disabled={Boolean(hoursError)}
        style={styles.cta}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  seatCard: { marginBottom: spacing.lg },
  seatRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
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
  seatInfo: { flex: 1, minWidth: 0, gap: 2 },
  sectionTitle: { ...typography.caption, marginBottom: spacing.sm, color: colors.textSecondary },
  segment: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgMuted,
  },
  segmentActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  segmentText: { ...typography.body, color: colors.textSecondary },
  segmentTextActive: { color: '#fff', fontWeight: '600' },
  nowHint: { marginBottom: spacing.sm, color: colors.textDisabled },
  slotsRow: { gap: spacing.sm, paddingBottom: spacing.xs },
  slotChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgMuted,
    minWidth: 72,
    alignItems: 'center',
  },
  slotChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  slotTextActive: { color: colors.accentBright, fontWeight: '600' },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  preset: {
    width: '30%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgMuted,
  },
  presetActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  presetTextActive: { color: '#fff', fontWeight: '600' },
  customCard: { marginBottom: spacing.lg },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hoursInput: {
    minWidth: 56,
    textAlign: 'center',
    ...typography.h1,
    fontSize: 32,
    color: colors.text,
    paddingVertical: spacing.xs,
  },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.sm },
  timelineCard: { marginBottom: spacing.lg },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  timelineCol: { flex: 1, gap: 2 },
  timelineColEnd: { alignItems: 'flex-end' },
  timelineTime: { ...typography.h2, marginVertical: 2 },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
    position: 'relative',
  },
  barFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 3,
    backgroundColor: colors.accent,
    width: '100%',
  },
  barDotStart: {
    position: 'absolute',
    left: 0,
    top: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accentBright,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  barDotEnd: {
    position: 'absolute',
    right: 0,
    top: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accentBright,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tariff: { marginTop: spacing.xs, color: colors.textSecondary, textAlign: 'center' },
  cta: { marginTop: 'auto' },
});
