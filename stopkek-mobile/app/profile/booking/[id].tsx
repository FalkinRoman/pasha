import { useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { Header } from '../../../src/components/ui/Header';
import { Screen } from '../../../src/components/ui/Screen';
import { MOCK_BOOKING_HISTORY } from '../../../src/mock/data';
import { typography } from '../../../src/theme/typography';
import { formatBookingRange, formatMoney } from '../../../src/utils/format';

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const booking = MOCK_BOOKING_HISTORY.find((b) => b.id === id);

  if (!booking) {
    return (
      <Screen>
        <Header title="Бронь" back />
        <Text style={typography.bodySecondary}>Не найдено</Text>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Header title={`Бронь #${booking.seatNumbers[0]}`} back />
      <Text style={typography.h3}>{booking.zoneName}</Text>
      <Text style={typography.bodySecondary}>
        {formatBookingRange(booking.startAt, booking.endAt)}
      </Text>
      <Text style={typography.h2}>{formatMoney(booking.totalPrice)}</Text>
      <Text style={typography.caption}>Статус: {booking.status}</Text>
    </Screen>
  );
}
