import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../src/api/client';
import { clearSessionAndRedirect } from '../../src/api/session';
import { fetchMe } from '../../src/api/users';
import { SessionCard } from '../../src/components/booking/SessionCard';
import { Card } from '../../src/components/ui/Card';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { StopLogo } from '../../src/components/ui/StopLogo';
import { useAppDispatch, useAppSelector } from '../../src/store/hooks';
import { updateUser } from '../../src/store/authSlice';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { BrandTitle } from '../../src/components/ui/BrandTitle';
import { formatMoney } from '../../src/utils/format';

export default function HomeScreen() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const activeBooking = useAppSelector((s) => s.booking.activeBooking);
  const club = useAppSelector((s) => s.booking.club);
  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) return;

      const poll = async () => {
        try {
          const me = await fetchMe();
          dispatch(updateUser(me));
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) {
            await clearSessionAndRedirect(dispatch);
          }
        }
      };

      poll();
      const id = setInterval(poll, 10000);
      return () => clearInterval(id);
    }, [isAuthenticated, dispatch])
  );

  return (
    <Screen scroll>
      <View style={styles.header}>
        <View>
          <BrandTitle size="sm" color={colors.textSecondary} />
          <Text style={typography.h2}>Привет, {user?.name ?? 'Игрок'}</Text>
        </View>
        <StopLogo size={44} />
      </View>

      <Pressable onPress={() => router.push('/wallet/topup')}>
        <Card style={styles.balance}>
          <Text style={typography.caption}>Баланс</Text>
          <View style={styles.balanceRow}>
            <Text style={typography.h1}>{formatMoney(user?.balance ?? 0)}</Text>
            <Ionicons name="add-circle" size={28} color={colors.accent} />
          </View>
        </Card>
      </Pressable>

      {activeBooking && ['paid', 'active'].includes(activeBooking.status) ? (
        <SessionCard booking={activeBooking} />
      ) : (
        <Card style={styles.empty}>
          <Ionicons name="desktop-outline" size={40} color={colors.textSecondary} />
          <Text style={[typography.h3, { marginTop: spacing.md }]}>Нет активного сеанса</Text>
          <Text style={typography.bodySecondary}>Забронируй место и приходи в клуб</Text>
          <StopButton
            title="Забронировать"
            onPress={() => router.push('/booking/map')}
            style={{ marginTop: spacing.md }}
          />
        </Card>
      )}

      {club ? (
        <>
          <Text style={[typography.caption, styles.section]}>Клуб</Text>
          <Card onPress={() => router.push('/club/info')}>
            <Text style={typography.h3}>{club.name}</Text>
            <Text style={typography.bodySecondary}>{club.address}</Text>
            <View style={styles.rating}>
              <Ionicons name="star" size={14} color={colors.warning} />
              <Text style={typography.caption}>{club.rating}</Text>
              <Text style={typography.caption}> · {club.hours}</Text>
            </View>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  balance: { marginBottom: spacing.md },
  balanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  empty: { alignItems: 'center', paddingVertical: spacing.xl },
  section: { marginTop: spacing.lg, marginBottom: spacing.sm },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
});
