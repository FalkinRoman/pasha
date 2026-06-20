import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchBookingHistory } from '../../src/api/bookings';
import { Booking } from '../../src/types';
import { EmptyHint } from '../../src/components/ui/EmptyHint';
import { Header } from '../../src/components/ui/Header';
import { Screen } from '../../src/components/ui/Screen';
import { StopkekLoader } from '../../src/components/ui/StopkekLoader';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { formatMoney } from '../../src/utils/format';

export default function BookingsHistoryScreen() {
  const [list, setList] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchBookingHistory()
      .then(setList)
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Screen scroll>
      <Header title="История броней" back />
      {loading ? (
        <StopkekLoader flex size="sm" message="Загружаем" />
      ) : list.length === 0 ? (
        <EmptyHint />
      ) : (
        list.map((b) => (
          <Pressable
            key={b.id}
            style={styles.row}
            onPress={() => router.push(`/profile/booking/${b.id}` as never)}
          >
            <View>
              <Text style={typography.body}>
                Место #{b.seatNumbers.join(', ')} · {b.zoneName}
              </Text>
              <Text style={typography.caption}>{b.status}</Text>
            </View>
            <Text style={typography.h3}>{formatMoney(b.totalPrice)}</Text>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
