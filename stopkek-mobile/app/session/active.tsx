import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import {
  cancelBooking,
  endSession,
  openSessionDoor,
} from '../../src/api/bookings';
import { ApiError } from '../../src/api/client';
import { Header } from '../../src/components/ui/Header';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { useActiveBookingSync } from '../../src/hooks/useActiveBookingSync';
import { useAppDispatch } from '../../src/store/hooks';
import { setActiveBooking } from '../../src/store/bookingSlice';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { CANCEL_BOOKING_WARNING, EARLY_END_WARNING } from '../../src/constants/paymentPolicy';
import { DOOR_EARLY_MIN } from '../../src/constants/session';
import { formatBookingStartLine, formatCountdown, formatGameStartedLine } from '../../src/utils/format';

export default function ActiveSessionScreen() {
  const dispatch = useAppDispatch();
  const { booking, refresh } = useActiveBookingSync();
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(false);
  const [doorCooldownSec, setDoorCooldownSec] = useState(0);
  const [doorCooldownActive, setDoorCooldownActive] = useState(false);
  const cooldownEndsAt = useRef(0);
  const seatNum = booking?.seatNumbers[0] ?? 0;
  const phase = booking?.sessionPhase ?? 'arrival';

  const isPlayingNow = booking?.gameRunning === true;
  const isWaitingNow =
    !!booking &&
    !isPlayingNow &&
    (booking.timerMode === 'until_start' ||
      booking.timerMode === 'until_door' ||
      (booking.untilStartMs != null && booking.untilStartMs > 0));

  useEffect(() => {
    if (!booking) return;
    const base =
      booking.displayRemainingMs ??
      (booking.durationMinutes ?? 60) * 60_000;
    const loadedAt = Date.now();
    let ended = false;
    const tick = () => {
      const next = Math.max(0, base - (Date.now() - loadedAt));
      setRemaining(next);
      if (next === 0 && !ended && isWaitingNow) {
        ended = true;
        refresh();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [
    booking?.id,
    booking?.timerMode,
    booking?.displayRemainingMs,
    booking?.durationMinutes,
    isWaitingNow,
    refresh,
  ]);

  useEffect(() => {
    if (!doorCooldownActive) return;
    const t = setInterval(() => {
      const left = Math.max(
        0,
        Math.ceil((cooldownEndsAt.current - Date.now()) / 1000)
      );
      setDoorCooldownSec(left);
      if (left <= 0) setDoorCooldownActive(false);
    }, 250);
    return () => clearInterval(t);
  }, [doorCooldownActive]);

  const onOpenMainDoor = async () => {
    if (!booking || doorCooldownSec > 0) return;
    setLoading(true);
    try {
      const updated = await openSessionDoor(booking.id);
      dispatch(setActiveBooking(updated));
      const pulse = updated.lockPulseSeconds ?? 5;
      const cooldown = updated.lockCooldownSeconds ?? 30;
      cooldownEndsAt.current = Date.now() + cooldown * 1000;
      setDoorCooldownSec(cooldown);
      setDoorCooldownActive(true);
      Alert.alert(
        'Главная дверь',
        updated.lockMessage ??
          `Дверь открыта на ~${pulse} сек. Можно войти.`
      );
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

  const isPlaying = booking.gameRunning === true;
  const waiting =
    !isPlaying &&
    (booking.timerMode === 'until_start' ||
      booking.timerMode === 'until_door' ||
      phase === 'awaiting_arrival' ||
      phase === 'arrival' ||
      (booking.untilStartMs != null && booking.untilStartMs > 0));
  const canCancel = booking.status === 'paid';
  const doorReady = !!booking.canOpenMainDoor;
  const doorSoon =
    !doorReady &&
    (booking.timerMode === 'until_door' ||
      (booking.doorOpensInMs != null && booking.doorOpensInMs > 0));

  const timerLabel = booking.timerLabel ?? (isPlaying ? 'осталось' : 'до начала');
  const doorBtnTitle =
    doorCooldownSec > 0
      ? `Подождите ${doorCooldownSec} сек`
      : 'Открыть главную дверь';

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
      <Text style={[typography.caption, styles.until]}>
        {isPlaying
          ? formatGameStartedLine(booking.startedAt ?? booking.startAt)
          : formatBookingStartLine(booking.startAt)}
      </Text>

      {waiting && doorSoon && (
        <Text style={[typography.bodySecondary, styles.hint]}>
          {booking.doorHint ??
            `Доступ в клуб откроется за ${DOOR_EARLY_MIN} минут до начала брони`}
        </Text>
      )}
      {waiting && booking.timerMode === 'until_start' && !doorSoon && (
        <Text style={[typography.bodySecondary, styles.hint]}>
          Сеанс начнётся в выбранное время — дождитесь отсчёта
        </Text>
      )}
      {doorReady && (
        <Text style={[typography.bodySecondary, styles.hint]}>
          {booking.doorHint ?? 'Можно открыть главную дверь клуба'}
        </Text>
      )}

      {doorReady && (
        <StopButton
          title={doorBtnTitle}
          onPress={onOpenMainDoor}
          disabled={loading || doorCooldownSec > 0}
          style={styles.action}
        />
      )}

      {(isPlaying || doorReady) && (
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
  until: { textAlign: 'center', marginTop: spacing.xs },
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
