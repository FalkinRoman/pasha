import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Booking } from '../../types';
import { formatBookingStartLine, formatCountdown } from '../../utils/format';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Card } from '../ui/Card';
import { StopButton } from '../ui/StopButton';

interface Props {
  booking: Booking;
  /** Вызывается, когда локальный отсчёт дошёл до нуля — нужен refresh с API */
  onCountdownEnd?: () => void;
}

export function SessionCard({ booking, onCountdownEnd }: Props) {
  const isPlaying = booking.gameRunning === true;
  const isWaiting =
    !isPlaying &&
    (booking.timerMode === 'until_start' ||
      booking.timerMode === 'until_door' ||
      (booking.untilStartMs != null && booking.untilStartMs > 0));
  const base =
    booking.displayRemainingMs ??
    (booking.durationMinutes ?? 60) * 60_000;
  const [remaining, setRemaining] = useState(base);
  const onCountdownEndRef = useRef(onCountdownEnd);
  onCountdownEndRef.current = onCountdownEnd;

  useEffect(() => {
    if (booking.timerMode === 'pre_play') {
      setRemaining(base);
      return;
    }
    const loadedAt = Date.now();
    let ended = false;
    const tick = () => {
      const next = Math.max(0, base - (Date.now() - loadedAt));
      setRemaining(next);
      if (next === 0 && !ended && isWaiting) {
        ended = true;
        onCountdownEndRef.current?.();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [booking.id, booking.timerMode, base, isWaiting]);

  const urgent = isPlaying && remaining < 15 * 60 * 1000;
  const timerCaption =
    booking.timerLabel ??
    (isPlaying ? 'осталось' : isWaiting ? 'до начала' : 'осталось');

  const statusLine = isPlaying
    ? 'Игра началась!'
    : formatBookingStartLine(booking.startAt);

  return (
    <Card accent style={styles.card}>
      <View style={styles.top}>
        <View>
          <Text style={typography.caption}>
            {isWaiting ? 'Ожидание начала' : booking.status === 'paid' ? 'Бронь оплачена' : 'Активный сеанс'}
          </Text>
          <Text style={typography.h2}>
            Место #{booking.seatNumbers.join(', ')}
          </Text>
          <Text style={typography.bodySecondary}>{booking.zoneName}</Text>
          <Text style={styles.until}>{statusLine}</Text>
        </View>
        <Ionicons
          name={isPlaying ? 'game-controller' : 'time-outline'}
          size={32}
          color={colors.accent}
        />
      </View>
      <Text style={[typography.timer, urgent && { color: colors.warning }]}>
        {formatCountdown(remaining)}
      </Text>
      <Text style={typography.caption}>{timerCaption}</Text>
      <View style={styles.actions}>
        <StopButton
          title="Управление"
          onPress={() => router.push('/session/active')}
          style={styles.btn}
        />
        {isPlaying ? (
          <StopButton
            title="Продлить"
            variant="ghost"
            onPress={() => router.push('/session/extend')}
            style={styles.btn}
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  until: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  btn: { flex: 1 },
});
