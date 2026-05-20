import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Header } from '../../src/components/ui/Header';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { useAppSelector } from '../../src/store/hooks';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { formatDuration } from '../../src/utils/format';

export default function ActiveSessionScreen() {
  const booking = useAppSelector((s) => s.booking.activeBooking);
  const [remaining, setRemaining] = useState(0);
  const seatNum = booking?.seatNumbers[0] ?? 0;

  useEffect(() => {
    if (!booking) return;
    const tick = () => setRemaining(new Date(booking.endAt).getTime() - Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [booking]);

  const openDoor = (type: 'main' | 'cell') => {
    Alert.alert(
      type === 'main' ? 'Главная дверь' : `Ячейка #${seatNum}`,
      'Команда отправлена (mock)',
      [{ text: 'OK' }]
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

  return (
    <Screen scroll>
      <Header title="Сеанс" back />
      <View style={styles.timerWrap}>
        <Text style={[typography.timer, remaining < 900000 && { color: colors.warning }]}>
          {formatDuration(remaining)}
        </Text>
        <Text style={typography.caption}>осталось</Text>
      </View>
      <Text style={[typography.h2, styles.center]}>
        Место #{seatNum}
      </Text>
      <Text style={[typography.bodySecondary, styles.center]}>{booking.zoneName}</Text>

      <View style={styles.doors}>
        <StopButton title="Открыть главную дверь" onPress={() => openDoor('main')} />
        <StopButton
          title={`Открыть ячейку #${seatNum}`}
          variant="ghost"
          onPress={() => openDoor('cell')}
        />
      </View>

      <View style={styles.row}>
        <StopButton title="Продлить" onPress={() => router.push('/session/extend')} style={{ flex: 1 }} />
        <StopButton
          title="Приёмка"
          variant="ghost"
          onPress={() => router.push('/session/acceptance')}
          style={{ flex: 1 }}
        />
      </View>

      <View style={styles.qrHint}>
        <Ionicons name="qr-code-outline" size={48} color={colors.textSecondary} />
        <Text style={[typography.caption, styles.center]}>
          QR для входа на ПК — скоро
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  timerWrap: { alignItems: 'center', marginVertical: spacing.xl },
  doors: { gap: spacing.sm, marginTop: spacing.xl },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  qrHint: { alignItems: 'center', marginTop: spacing.xxl, gap: spacing.sm, opacity: 0.6 },
});
