import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { setAccessToken } from '../../src/api/client';
import { IdentityBadge } from '../../src/components/verification/IdentityBadge';
import { Card } from '../../src/components/ui/Card';
import { Screen } from '../../src/components/ui/Screen';
import { LEGAL_URLS } from '../../src/constants/legal';
import { useAppDispatch, useAppSelector } from '../../src/store/hooks';
import { logout } from '../../src/store/authSlice';
import { saveTokens } from '../../src/storage/authStorage';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { formatMoney, formatPhone } from '../../src/utils/format';

const MENU = [
  { icon: 'time-outline' as const, label: 'История броней', href: '/profile/bookings' },
  { icon: 'wallet-outline' as const, label: 'Транзакции', href: '/wallet/history' },
  { icon: 'notifications-outline' as const, label: 'Уведомления', href: '/profile/notifications' },
  { icon: 'chatbubble-outline' as const, label: 'Обратная связь', href: '/support/feedback' },
  { icon: 'headset-outline' as const, label: 'Поддержка', href: '/support' },
  { icon: 'information-circle-outline' as const, label: 'О клубе', href: '/club/info' },
];

const LEGAL_MENU = [
  { label: 'Политика конфиденциальности', url: LEGAL_URLS.privacy },
  { label: 'Пользовательское соглашение', url: LEGAL_URLS.terms },
  { label: 'Публичная оферта', url: LEGAL_URLS.offer },
];

export default function ProfileScreen() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  const clearSession = async () => {
    setAccessToken(null);
    await saveTokens(null, null);
    dispatch(logout());
    router.replace('/(auth)/phone');
  };

  const onLogout = () => {
    Alert.alert('Выход', 'Выйти из аккаунта?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: clearSession },
    ]);
  };

  return (
    <Screen scroll>
      <Text style={typography.h1}>Профиль</Text>
      <Card style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.name ?? '?')[0].toUpperCase()}</Text>
        </View>
        <View style={styles.userInfo}>
          <Pressable onPress={() => router.push('/profile/edit')}>
            <Text style={typography.h2}>{user?.name}</Text>
            <Text style={typography.bodySecondary}>
              {formatPhone(user?.phone.replace('+', '') ?? '7')}
            </Text>
          </Pressable>
          <Text style={[typography.caption, { marginTop: 4 }]}>
            Баланс: {formatMoney(user?.balance ?? 0)}
          </Text>
          <IdentityBadge
            status={user?.identityStatus}
            verified={user?.identityVerified}
          />
        </View>
      </Card>

      <View style={styles.menu}>
        {MENU.map((item) => (
          <Pressable
            key={item.href}
            style={styles.menuItem}
            onPress={() => router.push(item.href as never)}
          >
            <Ionicons name={item.icon} size={22} color={colors.textSecondary} />
            <Text style={[typography.body, { flex: 1 }]}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textDisabled} />
          </Pressable>
        ))}
      </View>

      <View style={styles.legal}>
        {LEGAL_MENU.map((item) => (
          <Pressable key={item.url} onPress={() => Linking.openURL(item.url)}>
            <Text style={styles.legalLink}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={onLogout} style={styles.logout}>
        <Text style={{ color: colors.danger, ...typography.body }}>Выйти</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  userCard: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    width: '100%',
  },
  userInfo: { flex: 1, minWidth: 0 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.accent,
  },
  avatarText: { ...typography.h2, color: colors.accent },
  menu: { marginTop: spacing.lg, gap: 2 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    width: '100%',
    maxWidth: '100%',
  },
  logout: { alignItems: 'center', marginTop: spacing.xl, padding: spacing.md },
  legal: { marginTop: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  legalLink: {
    ...typography.caption,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
});
