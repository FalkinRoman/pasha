import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../../src/api/client';
import { fetchIdentityStatus } from '../../src/api/identity';
import { clearSessionAndRedirect } from '../../src/api/session';
import { fetchMe } from '../../src/api/users';
import { VerificationTimer } from '../../src/components/verification/VerificationTimer';
import { Header } from '../../src/components/ui/Header';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { useAppDispatch } from '../../src/store/hooks';
import { updateUser } from '../../src/store/authSlice';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function VerificationPendingScreen() {
  const dispatch = useAppDispatch();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const poll = useCallback(async () => {
    try {
      const s = await fetchIdentityStatus();
      setSecondsLeft(s.secondsUntilAutoApprove);

      if (s.canBook) {
        const user = await fetchMe();
        dispatch(updateUser(user));
        router.replace('/booking/time');
      }
      if (s.status === 'rejected') {
        router.replace({
          pathname: '/verification/rejected',
          params: { reason: s.rejectReason ?? '' },
        });
      }
      if (s.status === 'none') {
        router.replace('/verification');
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await clearSessionAndRedirect(dispatch);
      }
    }
  }, [dispatch]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, [poll]);

  return (
    <Screen>
      <Header title="На проверке" />
      <View style={styles.center}>
        <VerificationTimer secondsLeft={secondsLeft} />
        <Text style={typography.h3}>Данные отправлены</Text>
        <Text style={styles.sub}>
          Администратор проверяет заявку. Обычно это до 5 минут — не закрывайте
          приложение, статус обновится автоматически.
        </Text>
      </View>
      <View style={styles.actions}>
        <StopButton title="Обновить статус" onPress={poll} variant="ghost" />
        <StopButton title="На главную" onPress={() => router.replace('/(tabs)/home')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  sub: {
    ...typography.bodySecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  actions: { gap: spacing.md, paddingBottom: spacing.md },
});
