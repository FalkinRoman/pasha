import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { Seat, SeatStatus } from '../../types';
import { formatBookingUntil } from '../../utils/format';

const STATUS_LABEL: Record<SeatStatus, string> = {
  free: 'Свободно',
  reserved: 'Забронировано',
  occupied: 'Занято',
  repair: 'На обслуживании',
};

type Props = {
  seat: Seat;
  embedded?: boolean;
};

export function BookedSeatPanel({ seat, embedded = true }: Props) {
  return (
    <View style={[styles.root, embedded && styles.rootEmbedded]}>
      <Text style={[styles.title, embedded && styles.titleEmbedded]}>
        Капсула #{seat.number}
      </Text>
      <Text style={[styles.status, embedded && styles.statusEmbedded]}>
        {STATUS_LABEL[seat.status]}
      </Text>
      {seat.bookedUntil ? (
        <View style={styles.block}>
          <Text style={[styles.label, embedded && styles.labelEmbedded]}>До</Text>
          <Text style={[styles.value, embedded && styles.valueEmbedded]}>
            {formatBookingUntil(seat.bookedUntil)}
          </Text>
        </View>
      ) : null}
      {seat.status === 'repair' ? (
        <Text style={[styles.hint, embedded && styles.hintEmbedded]}>
          Место временно недоступно для брони
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    gap: 10,
    padding: 14,
  },
  rootEmbedded: {
    justifyContent: 'space-evenly',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  title: {
    ...typography.h3,
    fontSize: 15,
  },
  titleEmbedded: {
    fontSize: 12,
    lineHeight: 14,
  },
  status: {
    ...typography.caption,
    color: colors.accentBright,
    fontWeight: '700',
  },
  statusEmbedded: {
    fontSize: 10,
    lineHeight: 12,
  },
  block: {
    gap: 2,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
  },
  labelEmbedded: {
    fontSize: 9,
    lineHeight: 11,
  },
  value: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 15,
  },
  valueEmbedded: {
    fontSize: 10,
    lineHeight: 12,
  },
  hint: {
    ...typography.caption,
    color: colors.textDisabled,
    fontSize: 11,
    lineHeight: 14,
  },
  hintEmbedded: {
    fontSize: 9,
    lineHeight: 11,
  },
});
