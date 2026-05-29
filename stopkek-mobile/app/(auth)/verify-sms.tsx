import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { requestSms, verifySms } from '../../src/api/auth';
import { ApiError } from '../../src/api/client';
import { setAccessToken } from '../../src/api/client';
import { AuthSupportHint } from '../../src/components/support/AuthSupportHint';
import { CodeInput } from '../../src/components/auth/CodeInput';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { saveToken } from '../../src/storage/authStorage';
import { useAppDispatch, useAppSelector } from '../../src/store/hooks';
import { loginSuccess } from '../../src/store/authSlice';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

const CODE_LEN = 4;

export default function VerifySmsScreen() {
  const dispatch = useAppDispatch();
  const phone = useAppSelector((s) => s.auth.pendingPhone);
  const [sessionId, setSessionId] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [sending, setSending] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const finishLogin = async (
    user: Parameters<typeof loginSuccess>[0]['payload']['user'],
    accessToken: string,
    needsProfileSetup: boolean
  ) => {
    setAccessToken(accessToken);
    await saveToken(accessToken);
    dispatch(loginSuccess({ user, accessToken, needsProfileSetup }));
    if (needsProfileSetup) router.replace('/(auth)/setup-name');
    else router.replace('/(tabs)/home');
  };

  const sendSms = async () => {
    if (!phone) return;
    setSending(true);
    setCode('');
    setError('');
    try {
      const res = await requestSms(phone);
      setSessionId(res.sessionId);
      setDevCode(res.devCode ?? null);
      setCountdown(res.retryAfterSec ?? 60);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429 && e.body && typeof e.body === 'object') {
        const body = e.body as { message?: { retryAfterSec?: number; message?: string } | string };
        const nested = typeof body.message === 'object' ? body.message : null;
        const wait = nested?.retryAfterSec ?? 60;
        setCountdown(wait);
        setError(nested?.message ?? e.message);
      } else {
        setError(e instanceof ApiError ? e.message : 'Не удалось отправить SMS');
      }
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    sendSms();
  }, [phone]);

  useEffect(() => {
    if (countdown <= 0 || sending) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [sending, countdown]);

  const submitCode = async (value: string) => {
    setCode(value);
    setError('');
    if (value.length < CODE_LEN || !phone) return;
    if (!sessionId) {
      setError('Сессия не создана — отправьте SMS снова');
      return;
    }
    try {
      const res = await verifySms(phone, sessionId, value);
      await finishLogin(res.user, res.accessToken, res.needsProfileSetup);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Неверный код');
      setCode('');
    }
  };

  const resend = () => {
    if (sending || countdown > 0) return;
    sendSms();
  };

  return (
    <Screen scroll>
      <View style={styles.iconWrap}>
        <View style={[styles.iconCircle, code.length > 0 && styles.iconCircleActive]}>
          <Ionicons
            name={sending ? 'hourglass-outline' : 'chatbubble-ellipses'}
            size={36}
            color={code.length > 0 ? colors.accentBright : colors.accent}
          />
        </View>
      </View>

      <Text style={[typography.h1, styles.center]}>
        {sending ? 'Отправляем SMS…' : 'Код из SMS'}
      </Text>
      <Text style={[typography.bodySecondary, styles.center, styles.mb]}>
        {sending
          ? `Сообщение на ${phone || 'ваш номер'}`
          : 'Введите 4 цифры из SMS'}
      </Text>

      {!sending && (
        <>
          <CodeInput value={code} onChange={submitCode} error={Boolean(error)} autoFocus />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {devCode ? (
            <Text style={[typography.caption, styles.demo]}>Dev-код: {devCode}</Text>
          ) : null}
        </>
      )}

      <View style={styles.footer}>
        {countdown > 0 && !sending ? (
          <Text style={[typography.caption, styles.center]}>
            Повторная SMS через {countdown} сек
          </Text>
        ) : (
          <StopButton title="Отправить снова" variant="ghost" onPress={resend} disabled={sending} />
        )}
        <StopButton title="Изменить номер" variant="ghost" onPress={() => router.back()} />
        <StopButton
          title="Вход по звонку"
          variant="ghost"
          onPress={() => router.replace('/(auth)/phone')}
        />
        <AuthSupportHint />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  mb: { marginBottom: spacing.xl },
  iconWrap: { alignItems: 'center', justifyContent: 'center', height: 120, marginVertical: spacing.lg },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.bgElevated,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleActive: {
    borderColor: colors.accentBright,
    backgroundColor: '#1f1010',
  },
  error: { ...typography.caption, color: colors.danger, textAlign: 'center', marginTop: spacing.md },
  demo: { textAlign: 'center', marginTop: spacing.md, color: colors.textDisabled },
  footer: { marginTop: 'auto', gap: spacing.sm, paddingTop: spacing.xl },
});
