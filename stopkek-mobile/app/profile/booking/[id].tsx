import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { fetchBookingById } from '../../../src/api/bookings';
import { Header } from '../../../src/components/ui/Header';
import { Screen } from '../../../src/components/ui/Screen';
import { StopkekLoader } from '../../../src/components/ui/StopkekLoader';
import { typography } from '../../../src/theme/typography';
import { Booking } from '../../../src/types';
import { formatBookingRange, formatMoney } from '../../../src/utils/format';

const STATUS_LABELS: Record<string, string> = {
  completed: 'Завершена',
  cancelled: 'Отменена',
  active: 'Идёт сеанс',
  paid: 'Оплачена',
  no_show: 'Неявка',
  pending_payment: 'Ожидает оплаты',
};

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    fetchBookingById(id)
      .then(setBooking)
      .catch(() => setBooking(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Screen>
        <Header title="Бронь" back />
        <StopkekLoader flex size="md" />
      </Screen>
    );
  }

  if (!booking) {
    return (
      <Screen>
        <Header title="Бронь" back />
        <Text style={typography.bodySecondary}>Бронь не найдена</Text>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Header title={`Место #${booking.seatNumbers[0]}`} back />
      <Text style={typography.h3}>{booking.zoneName}</Text>
      <Text style={typography.bodySecondary}>
        {formatBookingRange(booking.startAt, booking.endAt)}
      </Text>
      <Text style={typography.h2}>{formatMoney(booking.totalPrice)}</Text>
      <Text style={typography.caption}>
        Статус: {STATUS_LABELS[booking.status] ?? booking.status}
      </Text>
    </Screen>
  );
}
