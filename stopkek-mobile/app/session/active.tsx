import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import {
  endSession,
  fetchActiveBooking,
  openSessionDoor,
} from '../../src/api/bookings';
import { ApiError } from '../../src/api/client';
import { Header } from '../../src/components/ui/Header';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { useAppDispatch, useAppSelector } from '../../src/store/hooks';
import { setActiveBooking } from '../../src/store/bookingSlice';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { formatDuration } from '../../src/utils/format';

export default function ActiveSessionScreen() {
  const dispatch = useAppDispatch();
  const booking = useAppSelector((s) => s.booking.activeBooking);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(false);
  const seatNum = booking?.seatNumbers[0] ?? 0;
  const phase = booking?.sessionPhase ?? 'arrival';

  const refresh = useCallback(() => {
    fetchActiveBooking()
      .then((b) => dispatch(setActiveBooking(b)))
      .catch(() => {});
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    if (!booking) return;
    const mode = booking.timerMode ?? 'until_end';
    const base =
      booking.displayRemainingMs ??
      (booking.durationMinutes ?? 60) * 60_000;
    if (mode !== 'playing' && mode !== 'until_end') {
      setRemaining(base);
      return;
    }
    const loadedAt = Date.now();
    const tick = () => setRemaining(Math.max(0, base - (Date.now() - loadedAt)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [
    booking?.id,
    booking?.timerMode,
    booking?.displayRemainingMs,
    booking?.durationMinutes,
  ]);

  const onDoor = async (type: 'main' | 'cell') => {
    if (!booking) return;
    setLoading(true);
    try {
      const updated = await openSessionDoor(booking.id, type);
      dispatch(setActiveBooking(updated));
      Alert.alert(
        type === 'main' ? 'Главная дверь' : `Бокс #${seatNum}`,
        'Команда отправлена'
      );
    } catch (e) {
      Alert.alert('Ошибка', e instanceof ApiError ? e.message : 'Не удалось');
    } finally {
      setLoading(false);
    }
  };

  const onFinish = () => {
    if (!booking) return;
    Alert.alert(
      'Завершить сеанс?',
      'Неиспользованное время вернётся на баланс (от 30 мин)',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Завершить',
          onPress: async () => {
            try {
              const res = await endSession(booking.id);
              dispatch(setActiveBooking(null));
              Alert.alert(
                'Сеанс завершён',
                res.refundRub > 0
                  ? `На баланс вернули ${res.refundRub} ₽`
                  : 'Спасибо за визит'
              );
              router.replace('/(tabs)/home');
            } catch (e) {
              Alert.alert('Ошибка', e instanceof ApiError ? e.message : 'Не удалось');
            }
          },
        },
      ]
    );
  };

  if (!booking) {
    return (
      <Screen>
        <Header title="Сеанс" back />
        <Text style={typography.bodySecondary}>Нет активного сеанса</Text>
        <StopButton title="На главную" onPress={() => router.replace('/(tabs)/home')} />
      </Screen>
    );
  }

  const isPlaying = booking.gameRunning ?? (phase === 'playing' && booking.status === 'active');
  const waiting =
    phase === 'awaiting_arrival' || (booking.status === 'paid' && !booking.doorWindowOpen);

  const timerLabel =
    booking.timerLabel ??
    (waiting ? 'до начала' : isPlaying ? 'осталось' : 'до старта');

  return (
    <Screen scroll>
      <Header title="Сеанс" back />
      <View style={styles.timerWrap}>
        {isPlaying && (
          <View style={styles.playingBadge}>
            <Ionicons name="game-controller" size={20} color={colors.accent} />
            <Text style={typography.caption}>Идёт игра</Text>
          </View>
        )}
        <Text
          style={[
            typography.timer,
            remaining < 900000 && isPlaying && { color: colors.warning },
          ]}
        >
          {formatDuration(remaining)}
        </Text>
        <Text style={typography.caption}>{timerLabel}</Text>
      </View>
      <Text style={[typography.h2, styles.center]}>Место #{seatNum}</Text>
      <Text style={[typography.bodySecondary, styles.center]}>{booking.zoneName}</Text>

      {waiting && (
        <Text style={[typography.bodySecondary, styles.hint]}>
          Доступ в клуб откроется за 15 минут до начала брони
        </Text>
      )}

      {booking.canOpenMainDoor && (
        <StopButton
          title="Открыть главную дверь"
          onPress={() => onDoor('main')}
          disabled={loading}
          style={styles.action}
        />
      )}

      {booking.canOpenCell && (
        <StopButton
          title={`Открыть бокс #${seatNum}`}
          variant="ghost"
          onPress={() => onDoor('cell')}
          disabled={loading}
          style={styles.action}
        />
      )}

      {isPlaying && (
        <View style={styles.row}>
          <StopButton
            title="Продлить"
            onPress={() => router.push('/session/extend')}
            style={{ flex: 1 }}
          />
          <StopButton
            title="Завершить"
            variant="ghost"
            onPress={onFinish}
            style={{ flex: 1 }}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  timerWrap: { alignItems: 'center', marginVertical: spacing.xl },
  playingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  hint: { textAlign: 'center', marginTop: spacing.lg },
  action: { marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
});
