import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { pollCallcheck, requestCallcheck } from '../../src/api/auth';
import { ApiError } from '../../src/api/client';
import { setAccessToken } from '../../src/api/client';
import { AuthSupportHint } from '../../src/components/support/AuthSupportHint';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { saveTokens } from '../../src/storage/authStorage';
import { useAppDispatch, useAppSelector } from '../../src/store/hooks';
import { loginSuccess } from '../../src/store/authSlice';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { formatPhone } from '../../src/utils/format';
import { pickRouteParam } from '../../src/utils/routeParams';

const POLL_MS = 2500;

function displayPhone(raw: string | null | undefined) {
  if (!raw) return 'вашего телефона';
  const digits = raw.replace(/\D/g, '');
  return formatPhone(digits.length ? digits : '7');
}

export default function VerifyCallScreen() {
  const dispatch = useAppDispatch();
  const params = useLocalSearchParams<{
    phone?: string | string[];
    sessionId?: string | string[];
    callPhone?: string | string[];
    callPhonePretty?: string | string[];
    expiresInSec?: string | string[];
    retryAfterSec?: string | string[];
  }>();
  const pendingPhone = useAppSelector((s) => s.auth.pendingPhone);
  const phone = pickRouteParam(params.phone) || pendingPhone;
  const [sessionId, setSessionId] = useState(pickRouteParam(params.sessionId) ?? '');
  const [callPhone, setCallPhone] = useState(pickRouteParam(params.callPhone) ?? '');
  const [callPhonePretty, setCallPhonePretty] = useState(
    pickRouteParam(params.callPhonePretty) ?? ''
  );
  const initialRetryAfter = Number(pickRouteParam(params.retryAfterSec)) || 15;
  const [expiresInSec, setExpiresInSec] = useState(
    Number(pickRouteParam(params.expiresInSec)) || 300
  );
  const [countdown, setCountdown] = useState(initialRetryAfter);
  const [waiting, setWaiting] = useState(true);
  const [error, setError] = useState('');
  const pollInFlight = useRef(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiresTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  const finishLogin = useCallback(
    async (
      user: Parameters<typeof loginSuccess>[0]['user'],
      accessToken: string,
      needsProfileSetup: boolean,
      refreshToken?: string
    ) => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      if (expiresTimer.current) clearInterval(expiresTimer.current);
      setAccessToken(accessToken);
      await saveTokens(accessToken, refreshToken ?? null);
      dispatch(loginSuccess({ user, accessToken, needsProfileSetup }));
      if (needsProfileSetup) router.replace('/(auth)/setup-name');
      else router.replace('/(tabs)/home');
    },
    [dispatch]
  );

  const doPoll = useCallback(async () => {
    if (!phone || !sessionId || pollInFlight.current) return;
    pollInFlight.current = true;
    try {
      const res = await pollCallcheck(phone, sessionId);
      if (res.status === 'confirmed') {
        setWaiting(false);
        await finishLogin(res.user, res.accessToken, res.needsProfileSetup, res.refreshToken);
        return;
      }
      setExpiresInSec(res.expiresInSec);
      setError('');
    } catch (e) {
      setWaiting(false);
      setError(e instanceof ApiError ? e.message : 'Не удалось проверить звонок');
      if (pollTimer.current) clearInterval(pollTimer.current);
    } finally {
      pollInFlight.current = false;
    }
  }, [phone, sessionId, finishLogin]);

  useEffect(() => {
    if (!phone || !sessionId) return;
    void doPoll();
    pollTimer.current = setInterval(() => void doPoll(), POLL_MS);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [phone, sessionId, doPoll]);

  useEffect(() => {
    if (expiresTimer.current) clearInterval(expiresTimer.current);
    expiresTimer.current = setInterval(() => {
      setExpiresInSec((s) => Math.max(0, s - 1));
    }, 1000);
    return () => {
      if (expiresTimer.current) clearInterval(expiresTimer.current);
    };
  }, [sessionId]);

  useEffect(() => {
    if (countdown <= 0 || waiting) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown, waiting]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') doPoll();
    });
    return () => sub.remove();
  }, [doPoll]);

  useEffect(() => {
    if (!waiting) {
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
  }, [waiting, pulse]);

  const dial = () => {
    if (!callPhone) return;
    Linking.openURL(`tel:${callPhone}`);
  };

  const restart = async () => {
    if (!phone || (countdown > 0 && waiting)) return;
    setError('');
    setWaiting(true);
    try {
      const res = await requestCallcheck(phone);
      setSessionId(res.sessionId);
      setCallPhone(res.callPhone);
      setCallPhonePretty(res.callPhonePretty);
      setExpiresInSec(res.expiresInSec);
      setCountdown(res.retryAfterSec ?? 15);
    } catch (e) {
      setWaiting(false);
      setError(e instanceof ApiError ? e.message : 'Не удалось обновить номер');
    }
  };

  const mmss = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <Screen scroll>
      <View style={styles.iconWrap}>
        {waiting && (
          <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulse }] }]} />
        )}
        <View style={styles.iconCircle}>
          <Ionicons name="call-outline" size={36} color={colors.accent} />
        </View>
      </View>

      <Text style={[typography.h1, styles.center]}>Позвоните для входа</Text>
      <Text style={[typography.bodySecondary, styles.center, styles.mb]}>
        С номера {displayPhone(phone)}. Нажмите «Позвонить», дождитесь сброса и вернитесь в
        приложение.
      </Text>

      <View style={styles.numberCard}>
        <Text style={typography.caption}>Номер для звонка</Text>
        <Text style={styles.number}>{callPhonePretty || callPhone}</Text>
        <StopButton title="Позвонить" onPress={dial} style={styles.dialBtn} />
      </View>

      {waiting ? (
        <View style={styles.waiting}>
          <Text style={[typography.caption, styles.center, styles.waitingText]}>
            Ожидаем звонок…
          </Text>
          {expiresInSec > 0 ? (
            <Text style={[typography.caption, styles.center, styles.timer]}>
              Осталось {mmss(expiresInSec)}
            </Text>
          ) : null}
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.footer}>
        {countdown > 0 && !waiting ? (
          <Text style={[typography.caption, styles.center]}>
            Новый номер через {countdown} сек
          </Text>
        ) : (
          <StopButton title="Получить номер снова" variant="ghost" onPress={restart} />
        )}
        <StopButton title="Изменить номер" variant="ghost" onPress={() => router.back()} />
        <AuthSupportHint />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  mb: { marginBottom: spacing.lg },
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
  numberCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  number: {
    ...typography.h1,
    fontSize: 28,
    color: colors.accentBright,
    textAlign: 'center',
  },
  dialBtn: { alignSelf: 'stretch', marginTop: spacing.sm },
  waiting: { alignItems: 'center', paddingVertical: spacing.md },
  waitingText: { color: colors.textSecondary },
  timer: { color: colors.accentBright, marginTop: spacing.xs },
  error: { ...typography.caption, color: colors.danger, textAlign: 'center', marginTop: spacing.md },
  footer: { marginTop: 'auto', gap: spacing.sm, paddingTop: spacing.xl },
});
