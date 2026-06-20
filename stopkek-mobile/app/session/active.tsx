import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import {
  cancelBooking,
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
import { CANCEL_BOOKING_WARNING, EARLY_END_WARNING } from '../../src/constants/paymentPolicy';
import { formatCountdown } from '../../src/utils/format';

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
    const base =
      booking.displayRemainingMs ??
      (booking.durationMinutes ?? 60) * 60_000;
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

  const onOpenMainDoor = async () => {
    if (!booking) return;
    setLoading(true);
    try {
      const updated = await openSessionDoor(booking.id);
      dispatch(setActiveBooking(updated));
      Alert.alert('Главная дверь', 'Команда отправлена');
    } catch (e) {
      Alert.alert('Ошибка', e instanceof ApiError ? e.message : 'Не удалось');
    } finally {
      setLoading(false);
    }
  };

  const onFinish = () => {
    if (!booking) return;
    Alert.alert('Завершить сеанс?', EARLY_END_WARNING, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Завершить',
        style: 'destructive',
        onPress: async () => {
          try {
            await endSession(booking.id);
            dispatch(setActiveBooking(null));
            Alert.alert('Сеанс завершён', 'Спасибо за визит');
            router.replace('/(tabs)/home');
          } catch (e) {
            Alert.alert('Ошибка', e instanceof ApiError ? e.message : 'Не удалось');
          }
        },
      },
    ]);
  };

  const onCancelBooking = () => {
    if (!booking) return;
    Alert.alert('Отменить бронь?', CANCEL_BOOKING_WARNING, [
      { text: 'Назад', style: 'cancel' },
      {
        text: 'Отменить бронь',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await cancelBooking(booking.id);
            dispatch(setActiveBooking(null));
            Alert.alert('Бронь отменена', 'Деньги на баланс не возвращаются');
            router.replace('/(tabs)/home');
          } catch (e) {
            Alert.alert('Ошибка', e instanceof ApiError ? e.message : 'Не удалось отменить');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  if (!booking) {
    return (
      <Screen>
        <Header title="Управление" back />
        <Text style={typography.bodySecondary}>Нет активного сеанса</Text>
        <StopButton title="На главную" onPress={() => router.replace('/(tabs)/home')} />
      </Screen>
    );
  }

  const isPlaying = booking.gameRunning ?? (phase === 'playing' && booking.status === 'active');
  const waiting =
    phase === 'awaiting_arrival' || (booking.status === 'paid' && !booking.doorWindowOpen);
  const canCancel = booking.status === 'paid';

  const timerLabel =
    booking.timerLabel ??
    (waiting ? 'до начала' : isPlaying ? 'осталось' : 'до старта');

  return (
    <Screen scroll>
      <Header title="Управление" back />
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
          {formatCountdown(remaining)}
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
          onPress={onOpenMainDoor}
          disabled={loading}
          style={styles.action}
        />
      )}

      {(isPlaying || booking.canOpenMainDoor) && (
        <StopButton
          title="Сканировать QR на мониторе"
          variant="ghost"
          onPress={() => router.push('/session/scan-pc')}
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

      {canCancel && (
        <StopButton
          title="Отменить бронь"
          variant="ghost"
          onPress={onCancelBooking}
          disabled={loading}
          style={styles.cancelBtn}
        />
      )}
      {canCancel && (
        <Text style={styles.cancelHint}>
          При отмене деньги на баланс не возвращаются
        </Text>
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
  cancelBtn: { marginTop: spacing.xl },
  cancelHint: {
    ...typography.caption,
    color: colors.textDisabled,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
