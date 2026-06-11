import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { requestCall, verifyCall } from '../../src/api/auth';
import { ApiError } from '../../src/api/client';
import { setAccessToken } from '../../src/api/client';
import { AuthSupportHint } from '../../src/components/support/AuthSupportHint';
import { CodeInput } from '../../src/components/auth/CodeInput';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { saveTokens } from '../../src/storage/authStorage';
import { useAppDispatch, useAppSelector } from '../../src/store/hooks';
import { loginSuccess } from '../../src/store/authSlice';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

const CODE_LEN = 4;

export default function VerifyCallScreen() {
  const dispatch = useAppDispatch();
  const phone = useAppSelector((s) => s.auth.pendingPhone);
  const [sessionId, setSessionId] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [calling, setCalling] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const pulse = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  const finishLogin = async (
    user: Parameters<typeof loginSuccess>[0]['user'],
    accessToken: string,
    needsProfileSetup: boolean,
    refreshToken?: string
  ) => {
    setAccessToken(accessToken);
    await saveTokens(accessToken, refreshToken ?? null);
    dispatch(loginSuccess({ user, accessToken, needsProfileSetup }));
    if (needsProfileSetup) router.replace('/(auth)/setup-name');
    else router.replace('/(tabs)/home');
  };

  const startCallFlow = async () => {
    if (!phone) return;
    setCalling(true);
    setCode('');
    setError('');
    try {
      const res = await requestCall(phone);
      setSessionId(res.sessionId);
      setDevCode(res.devCode ?? null);
      setCountdown(res.retryAfterSec ?? 15);
      setTimeout(() => setCalling(false), 2500);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429 && e.body && typeof e.body === 'object') {
        const body = e.body as { message?: { retryAfterSec?: number; message?: string } | string };
        const nested = typeof body.message === 'object' ? body.message : null;
        const wait = nested?.retryAfterSec ?? 15;
        setCountdown(wait);
        setError(nested?.message ?? e.message);
      } else {
        setError(e instanceof ApiError ? e.message : 'Не удалось позвонить');
      }
      setCalling(false);
    }
  };

  useEffect(() => {
    startCallFlow();
  }, [phone]);

  useEffect(() => {
    if (countdown <= 0 || calling) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [calling, countdown]);

  useEffect(() => {
    if (!calling) {
      pulseLoop.current?.stop();
      pulse.setValue(1);
      return;
    }
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
    return () => pulseLoop.current?.stop();
  }, [calling, pulse]);

  const submitCode = async (value: string) => {
    setCode(value);
    setError('');
    if (value.length < CODE_LEN || !phone) return;
    if (!sessionId) {
      setError('Сессия не создана — нажмите «Позвонить снова»');
      return;
    }
    try {
      const res = await verifyCall(phone, sessionId, value);
      await finishLogin(res.user, res.accessToken, res.needsProfileSetup, res.refreshToken);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Неверные цифры');
      setCode('');
    }
  };

  const resend = () => {
    if (calling || countdown > 0) return;
    startCallFlow();
  };

  return (
    <Screen scroll>
      <View style={styles.iconWrap}>
        {calling && (
          <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulse }] }]} />
        )}
        <View
          style={[
            styles.iconCircle,
            !calling && styles.iconCircleIdle,
            !calling && code.length > 0 && styles.iconCircleActive,
          ]}
        >
          <Ionicons
            name={calling ? 'call' : 'keypad'}
            size={36}
            color={!calling && code.length > 0 ? colors.accentBright : colors.accent}
          />
        </View>
      </View>

      <Text style={[typography.h1, styles.center]}>
        {calling ? 'Входящий звонок' : 'Код из звонка'}
      </Text>
      <Text style={[typography.bodySecondary, styles.center, styles.mb]}>
        {calling
          ? `Звоним на ${phone || 'ваш номер'}… Не сбрасывайте`
          : 'Введите последние 4 цифры звонка'}
      </Text>

      {!calling && (
        <>
          <CodeInput
            value={code}
            onChange={submitCode}
            error={Boolean(error)}
            autoFocus
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {__DEV__ && devCode ? (
            <Text style={[typography.caption, styles.demo]}>Dev-код: {devCode}</Text>
          ) : null}
        </>
      )}

      {calling && (
        <View style={styles.waiting}>
          <Text style={typography.caption}>Звонок сбросится сам — это бесплатно</Text>
        </View>
      )}

      <View style={styles.footer}>
        {countdown > 0 && !calling ? (
          <Text style={[typography.caption, styles.center]}>
            Повторный звонок через {countdown} сек
          </Text>
        ) : (
          <StopButton title="Позвонить снова" variant="ghost" onPress={resend} disabled={calling} />
        )}
        <StopButton title="Изменить номер" variant="ghost" onPress={() => router.back()} />
        <Pressable style={styles.alt} onPress={() => router.replace('/(auth)/phone-sms')}>
          <Text style={styles.altText}>Войти по SMS</Text>
        </Pressable>
        <AuthSupportHint />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  mb: { marginBottom: spacing.xl },
  iconWrap: { alignItems: 'center', justifyContent: 'center', height: 120, marginVertical: spacing.lg },
  pulseRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.accentGlow,
  },
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
  iconCircleIdle: { borderColor: colors.border },
  iconCircleActive: {
    borderColor: colors.accentBright,
    backgroundColor: '#1f1010',
  },
  error: { ...typography.caption, color: colors.danger, textAlign: 'center', marginTop: spacing.md },
  demo: { textAlign: 'center', marginTop: spacing.md, color: colors.textDisabled },
  waiting: { alignItems: 'center', paddingVertical: spacing.xl },
  footer: { marginTop: 'auto', gap: spacing.sm, paddingTop: spacing.xl },
  alt: { alignItems: 'center', paddingVertical: spacing.xs },
  altText: { ...typography.body, color: colors.accentBright, textAlign: 'center' },
});
