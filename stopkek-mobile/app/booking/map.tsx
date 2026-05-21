import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useSegments } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cancelBooking } from '../../src/api/bookings';
import { fetchFloorMap } from '../../src/api/club';
import { fetchIdentityStatus } from '../../src/api/identity';
import { useAppDispatch, useAppSelector } from '../../src/store/hooks';
import { setFloorMap, setPendingBookingId } from '../../src/store/bookingSlice';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND_NAME } from '../../src/constants/brand';
import { FloorMap } from '../../src/components/map/FloorMap';
import { StopkekLoader } from '../../src/components/ui/StopkekLoader';
import { Header } from '../../src/components/ui/Header';
import { StopLogo } from '../../src/components/ui/StopLogo';
import { StopButton } from '../../src/components/ui/StopButton';
import { colors } from '../../src/theme/colors';
import { SCREEN_PADDING } from '../../src/theme/layout';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function MapScreen() {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const inBookTab = segments.includes('book');
  const { selectedSeatIds, seats, pendingBookingId } = useAppSelector((s) => s.booking);
  const selected = seats.filter((s) => selectedSeatIds.includes(s.id));
  const club = useAppSelector((s) => s.booking.club);
  const [loading, setLoading] = useState(true);

  const loadMap = useCallback(() => {
    setLoading(true);
    fetchFloorMap()
      .then((data) => {
        dispatch(setFloorMap({ seats: data.seats, zones: data.zones }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      loadMap();
    }, [loadMap])
  );

  const goTime = async () => {
    if (pendingBookingId) {
      await cancelBooking(pendingBookingId).catch(() => {});
      dispatch(setPendingBookingId(null));
    }
    try {
      const id = await fetchIdentityStatus();
      if (id.status === 'pending') {
        router.push('/verification/pending');
        return;
      }
      if (id.status === 'rejected') {
        router.push({
          pathname: '/verification/rejected',
          params: { reason: id.rejectReason ?? '' },
        });
        return;
      }
      if (!id.canBook) {
        router.push('/verification');
        return;
      }
    } catch {
      router.push('/verification');
      return;
    }
    router.push('/booking/time');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.pad}>
        <Header
          title="Выбрать место"
          back={!inBookTab}
          backFallback="/(tabs)/home"
          right={
            <Pressable onPress={() => router.push('/club/info')} hitSlop={12}>
              <Ionicons name="information-circle-outline" size={24} color={colors.text} />
            </Pressable>
          }
        />
        <View style={styles.clubRow}>
          <View style={styles.thumb}>
            <StopLogo size={48} />
          </View>
          <View style={styles.clubInfo}>
            <Text style={typography.h3} numberOfLines={1}>
              {club?.name ?? BRAND_NAME}
            </Text>
            <Text style={typography.caption} numberOfLines={2}>
              {club?.address ?? ''}
            </Text>
            <View style={styles.rating}>
              <Ionicons name="star" size={12} color={colors.warning} />
              <Text style={typography.caption}>{club?.rating ?? 5}</Text>
            </View>
          </View>
        </View>
        <View style={styles.legend}>
          <LegendDot color={colors.seatFree} label="Свободно" />
          <LegendDot color={colors.seatReserved} label="Бронь" />
          <LegendDot color={colors.seatOccupied} label="Занято" />
        </View>
      </View>

      <View style={styles.mapArea}>
        {loading ? (
          <StopkekLoader flex size="md" message="Карта зала" />
        ) : (
          <FloorMap />
        )}
      </View>

      <View
        style={[
          styles.footer,
          styles.pad,
          { paddingBottom: inBookTab ? spacing.sm : Math.max(insets.bottom, spacing.md) },
        ]}
      >
        <Text style={[typography.caption, styles.footerText]}>
          {selected[0]
            ? `Место #${selected[0].number} · ${selected[0].status === 'free' ? 'свободно' : 'недоступно'}`
            : 'Выберите свободное место'}
        </Text>
        <StopButton
          title="Выбрать время"
          onPress={goTime}
          disabled={selectedSeatIds.length === 0 || selected[0]?.status !== 'free'}
        />
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={typography.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, width: '100%', overflow: 'hidden' },
  pad: { paddingHorizontal: SCREEN_PADDING },
  clubRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  clubInfo: { flex: 1, justifyContent: 'center', minWidth: 0 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  mapArea: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginHorizontal: -spacing.xs,
  },
  footer: {
    paddingTop: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bgElevated,
    width: '100%',
  },
  footerText: { textAlign: 'center' },
});
