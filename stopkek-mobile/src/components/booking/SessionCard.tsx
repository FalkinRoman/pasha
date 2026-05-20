import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Booking } from '../../types';
import { formatDuration, formatMoney } from '../../utils/format';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Card } from '../ui/Card';
import { StopButton } from '../ui/StopButton';

interface Props {
  booking: Booking;
}

export function SessionCard({ booking }: Props) {
  const [remaining, setRemaining] = useState(
    new Date(booking.endAt).getTime() - Date.now()
  );

  useEffect(() => {
    const t = setInterval(() => {
      setRemaining(new Date(booking.endAt).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(t);
  }, [booking.endAt]);

  const urgent = remaining < 15 * 60 * 1000;

  return (
    <Card accent style={styles.card}>
      <View style={styles.top}>
        <View>
          <Text style={typography.caption}>Активный сеанс</Text>
          <Text style={typography.h2}>
            Место #{booking.seatNumbers.join(', ')}
          </Text>
          <Text style={typography.bodySecondary}>{booking.zoneName}</Text>
        </View>
        <Ionicons name="game-controller" size={32} color={colors.accent} />
      </View>
      <Text style={[typography.timer, urgent && { color: colors.warning }]}>
        {formatDuration(remaining)}
      </Text>
      <View style={styles.actions}>
        <StopButton
          title="Управление"
          onPress={() => router.push('/session/active')}
          style={styles.btn}
        />
        <StopButton
          title="Продлить"
          variant="ghost"
          onPress={() => router.push('/session/extend')}
          style={styles.btn}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  btn: { flex: 1 },
});
