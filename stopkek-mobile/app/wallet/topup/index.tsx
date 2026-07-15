import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  createTopup,
  fetchTopupStatus,
  fetchWalletConfig,
  mockTopup,
  type WalletConfig,
} from '../../../src/api/wallet';
import { fetchMe } from '../../../src/api/users';
import { ApiError } from '../../../src/api/client';
import { Card } from '../../../src/components/ui/Card';
import { Header } from '../../../src/components/ui/Header';
import { Input } from '../../../src/components/ui/Input';
import { Screen } from '../../../src/components/ui/Screen';
import { StopButton } from '../../../src/components/ui/StopButton';
import { useAppDispatch, useAppSelector } from '../../../src/store/hooks';
import { loginSuccess } from '../../../src/store/authSlice';
import { colors } from '../../../src/theme/colors';
import { radius, spacing } from '../../../src/theme/spacing';
import { typography } from '../../../src/theme/typography';
import { formatMoney } from '../../../src/utils/format';

const PRESETS = [500, 1000, 2000, 5000];
const DEFAULT_MIN = 100;

type PayMethod = 'yookassa' | 'mock';

export default function TopupScreen() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [amountText, setAmountText] = useState('1000');
  const [config, setConfig] = useState<WalletConfig | null>(null);
  const [method, setMethod] = useState<PayMethod>('yookassa');
  const [loading, setLoading] = useState(false);
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);

  const effectiveMethod: PayMethod = config?.yookassaEnabled && config?.mockTopupEnabled
    ? method
    : config?.yookassaEnabled
      ? 'yookassa'
      : 'mock';

  const minAmount =
    effectiveMethod === 'mock'
      ? (config?.minMockTopupRub ?? DEFAULT_MIN)
      : (config?.minTopupRub ?? DEFAULT_MIN);
  const maxAmount = config?.maxTopupRub ?? 100_000;

  const amount = Number(amountText.replace(/\D/g, '')) || 0;
  const amountError =
    amount < minAmount
      ? `Минимум ${formatMoney(minAmount)}`
      : amount > maxAmount
        ? `Максимум ${formatMoney(maxAmount)}`
        : '';
  const canPay = amount >= minAmount && amount <= maxAmount;
  const topupAvailable = config?.yookassaEnabled || config?.mockTopupEnabled;
  const showMethodChoice = Boolean(config?.yookassaEnabled && config?.mockTopupEnabled);

  useEffect(() => {
    fetchWalletConfig()
      .then((cfg) => {
        setConfig(cfg);
        if (cfg.yookassaEnabled) setMethod('yookassa');
        else if (cfg.mockTopupEnabled) setMethod('mock');
      })
      .catch(() => {});
  }, []);

  const refreshBalance = async () => {
    const me = await fetchMe();
    dispatch(loginSuccess({ user: me }));
    return me.balance;
  };

  const payYooKassa = async () => {
    if (!canPay) return;
    setLoading(true);
    try {
      const res = await createTopup(amount);
      setPendingPaymentId(res.paymentId);
      if (res.confirmationUrl) {
        await Linking.openURL(res.confirmationUrl);
        Alert.alert(
          'Оплата',
          'Завершите оплату в браузере. После оплаты вернитесь в приложение — баланс обновится автоматически.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Ошибка', 'Не удалось открыть страницу оплаты');
      }
    } catch (e) {
      Alert.alert('Ошибка', e instanceof ApiError ? e.message : 'Не удалось создать платёж');
    } finally {
      setLoading(false);
    }
  };

  const checkPayment = async () => {
    if (!pendingPaymentId) return;
    setLoading(true);
    try {
      const st = await fetchTopupStatus(pendingPaymentId);
      if (st.status === 'succeeded') {
        await refreshBalance();
        Alert.alert('Готово', `На баланс зачислено ${formatMoney(st.amountRub)}`);
        setPendingPaymentId(null);
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)/home');
      } else {
        Alert.alert('Ожидание', 'Платёж ещё обрабатывается. Попробуйте снова через несколько секунд.');
      }
    } catch (e) {
      Alert.alert('Ошибка', e instanceof ApiError ? e.message : 'Не удалось проверить статус');
    } finally {
      setLoading(false);
    }
  };

  const payDirect = async () => {
    if (!canPay) return;
    setLoading(true);
    try {
      const res = await mockTopup(amount);
      await refreshBalance();
      Alert.alert('Готово', `На баланс зачислено ${formatMoney(res.amountRub)}`);
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/home');
    } catch (e) {
      Alert.alert('Ошибка', e instanceof ApiError ? e.message : 'Не удалось пополнить');
    } finally {
      setLoading(false);
    }
  };

  const onTopup = () => {
    const effectiveMethod = showMethodChoice
      ? method
      : config?.yookassaEnabled
        ? 'yookassa'
        : 'mock';
    if (effectiveMethod === 'yookassa') payYooKassa();
    else payDirect();
  };

  const paymentHint = config?.yookassaEnabled
    ? 'Карта или СБП · ЮKassa'
    : config?.mockTopupEnabled
      ? 'Тестовое пополнение без списания'
      : '';

  return (
    <Screen scroll>
      <Header title="Пополнение" back />

      <Card style={styles.balanceCard}>
        <Text style={typography.caption}>Текущий баланс</Text>
        <Text style={[typography.h1, styles.balanceValue]}>
          {formatMoney(user?.balance ?? 0)}
        </Text>
      </Card>

      <Text style={[typography.caption, styles.sectionLabel]}>Сумма пополнения</Text>
      <View style={styles.chips}>
        {PRESETS.map((p) => (
          <Pressable
            key={p}
            style={[styles.chip, amount === p && styles.chipActive]}
            onPress={() => setAmountText(String(p))}
          >
            <Text
              style={[
                typography.body,
                amount === p && styles.chipTextActive,
              ]}
            >
              {formatMoney(p)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.inputWrap}>
        <Input
          label="Другая сумма"
          value={amountText}
          onChangeText={(t) => setAmountText(t.replace(/\D/g, ''))}
          keyboardType="number-pad"
          placeholder="Введите сумму в рублях"
          error={amountError}
        />
      </View>

      {showMethodChoice ? (
        <>
          <Text style={[typography.caption, styles.sectionLabel]}>Способ оплаты</Text>
          <Pressable
            style={[styles.method, method === 'yookassa' && styles.methodActive]}
            onPress={() => {
              setMethod('yookassa');
            }}
          >
            <Text style={typography.body}>Карта / СБП</Text>
            <Text style={typography.caption}>ЮKassa</Text>
          </Pressable>
          <Pressable
            style={[styles.method, method === 'mock' && styles.methodActive]}
            onPress={() => {
              setMethod('mock');
            }}
          >
            <Text style={typography.body}>Тестовое пополнение</Text>
            <Text style={typography.caption}>Без списания</Text>
          </Pressable>
        </>
      ) : null}

      <Card accent style={styles.totalCard}>
        <Text style={typography.caption}>К оплате</Text>
        <Text style={styles.totalValue}>{canPay ? formatMoney(amount) : '—'}</Text>
        {paymentHint ? (
          <Text style={[typography.caption, styles.hint]}>
            {paymentHint} · от {formatMoney(minAmount)}
          </Text>
        ) : null}
      </Card>

      <View style={styles.actions}>
        {topupAvailable ? (
          <>
            <StopButton
              title={method === 'mock' && !config?.yookassaEnabled ? 'Пополнить (тест)' : 'Пополнить'}
              onPress={onTopup}
              disabled={loading || !canPay}
            />
            {config?.yookassaEnabled && pendingPaymentId ? (
              <StopButton
                title="Проверить оплату"
                variant="ghost"
                onPress={checkPayment}
                disabled={loading}
              />
            ) : null}
          </>
        ) : (
          <Text style={[typography.bodySecondary, styles.unavailable]}>
            Пополнение временно недоступно
          </Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  balanceCard: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  balanceValue: {
    marginTop: spacing.xs,
  },
  sectionLabel: {
    marginBottom: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    flexGrow: 1,
    flexBasis: '47%',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgMuted,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  chipTextActive: {
    color: colors.text,
    fontWeight: '600',
  },
  inputWrap: {
    marginBottom: spacing.lg,
  },
  method: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    backgroundColor: colors.bgCard,
  },
  methodActive: {
    borderColor: colors.accent,
    backgroundColor: '#1a1010',
  },
  totalCard: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  totalValue: {
    ...typography.h1,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  hint: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
  actions: {
    marginTop: 'auto',
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  unavailable: {
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
