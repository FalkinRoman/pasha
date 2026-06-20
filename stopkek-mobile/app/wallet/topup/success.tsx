import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fetchTopupStatus } from '../../../src/api/wallet';
import { fetchMe } from '../../../src/api/users';
import { Header } from '../../../src/components/ui/Header';
import { Screen } from '../../../src/components/ui/Screen';
import { StopButton } from '../../../src/components/ui/StopButton';
import { StopkekLoader } from '../../../src/components/ui/StopkekLoader';
import { useAppDispatch } from '../../../src/store/hooks';
import { loginSuccess } from '../../../src/store/authSlice';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { typography } from '../../../src/theme/typography';
import { formatMoney } from '../../../src/utils/format';

type State =
  | { kind: 'loading' }
  | { kind: 'succeeded'; amountRub: number; balanceRub: number }
  | { kind: 'pending' }
  | { kind: 'error' };

const POLL_ATTEMPTS = 5;
const POLL_DELAY_MS = 2000;

export default function TopupSuccessScreen() {
  const { paymentId } = useLocalSearchParams<{ paymentId?: string }>();
  const dispatch = useAppDispatch();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    if (!paymentId) {
      setState({ kind: 'error' });
      return;
    }
    let cancelled = false;

    const poll = async (attempt: number) => {
      try {
        const st = await fetchTopupStatus(paymentId);
        if (cancelled) return;
        if (st.status === 'succeeded') {
          const me = await fetchMe();
          if (cancelled) return;
          dispatch(loginSuccess({ user: me }));
          setState({
            kind: 'succeeded',
            amountRub: st.amountRub,
            balanceRub: st.balanceRub,
          });
          return;
        }
        if (attempt < POLL_ATTEMPTS) {
          setTimeout(() => poll(attempt + 1), POLL_DELAY_MS);
        } else {
          setState({ kind: 'pending' });
        }
      } catch {
        if (!cancelled) setState({ kind: 'error' });
      }
    };

    poll(1);
    return () => {
      cancelled = true;
    };
  }, [paymentId, dispatch]);

  const goHome = () => router.replace('/(tabs)/home');

  return (
    <Screen>
      <Header title="Оплата" />
      {state.kind === 'loading' && (
        <StopkekLoader flex size="md" message="Проверяем оплату" />
      )}
      {state.kind === 'succeeded' && (
        <View style={styles.center}>
          <Text style={styles.emoji}>✅</Text>
          <Text style={typography.h2}>Баланс пополнен</Text>
          <Text style={typography.bodySecondary}>
            +{formatMoney(state.amountRub)} · на счёте {formatMoney(state.balanceRub)}
          </Text>
          <StopButton title="Отлично" onPress={goHome} style={styles.cta} />
        </View>
      )}
      {state.kind === 'pending' && (
        <View style={styles.center}>
          <Text style={styles.emoji}>⏳</Text>
          <Text style={typography.h2}>Платёж обрабатывается</Text>
          <Text style={[typography.bodySecondary, styles.hint]}>
            Зачисление может занять пару минут. Баланс обновится автоматически.
          </Text>
          <StopButton title="На главную" onPress={goHome} style={styles.cta} />
        </View>
      )}
      {state.kind === 'error' && (
        <View style={styles.center}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={typography.h2}>Не удалось проверить</Text>
          <Text style={[typography.bodySecondary, styles.hint]}>
            Проверьте баланс в профиле или свяжитесь с поддержкой.
          </Text>
          <StopButton title="На главную" onPress={goHome} style={styles.cta} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  emoji: { fontSize: 48, marginBottom: spacing.sm },
  hint: { textAlign: 'center', color: colors.textSecondary },
  cta: { marginTop: spacing.xl, alignSelf: 'stretch' },
});
