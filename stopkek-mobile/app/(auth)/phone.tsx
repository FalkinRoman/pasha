import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { requestCallDeduped } from '../../src/api/auth';
import { ApiError } from '../../src/api/client';
import { LEGAL_URLS } from '../../src/constants/legal';
import { Input } from '../../src/components/ui/Input';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { AuthSupportHint } from '../../src/components/support/AuthSupportHint';
import { StopLogo } from '../../src/components/ui/StopLogo';
import { useAppDispatch } from '../../src/store/hooks';
import { setPendingPhone } from '../../src/store/authSlice';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { formatPhone, phoneDigits } from '../../src/utils/format';

export default function PhoneScreen() {
  const dispatch = useAppDispatch();
  const [phone, setPhone] = useState('+7');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    if (digits.length <= 11) setPhone(formatPhone(digits.length ? digits : '7'));
    setError('');
  };

  const submit = async () => {
    const normalized = phoneDigits(phone);
    if (normalized.replace(/\D/g, '').length < 11) {
      setError('Введите номер полностью');
      return;
    }
    const nonce = String(Date.now());
    setLoading(true);
    setError('');
    try {
      const res = await requestCallDeduped(normalized, nonce);
      dispatch(setPendingPhone(normalized));
      router.push({
        pathname: '/(auth)/verify-call',
        params: {
          phone: normalized,
          sessionId: res.sessionId,
          retryAfterSec: String(res.retryAfterSec ?? 15),
          ...(res.devCode ? { devCode: res.devCode } : {}),
        },
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 429 && e.body && typeof e.body === 'object') {
        const body = e.body as { message?: { message?: string } | string };
        const nested = typeof body.message === 'object' ? body.message : null;
        setError(nested?.message ?? e.message);
      } else {
        setError(e instanceof ApiError ? e.message : 'Не удалось позвонить');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.top}>
        <StopLogo size={64} />
        <Text style={[typography.h1, styles.title]}>Вход</Text>
        <Text style={typography.bodySecondary}>
          Подтвердим номер входящим звонком — введёте последние 4 цифры
        </Text>
      </View>
      <Input
        label="Номер телефона"
        value={phone}
        onChangeText={onChange}
        keyboardType="phone-pad"
        error={error}
        autoFocus
        editable={!loading}
      />
      <View style={styles.hint}>
        <Text style={typography.caption}>
          Нажимая «Позвонить мне», вы соглашаетесь с{' '}
          <Text style={styles.link} onPress={() => Linking.openURL(LEGAL_URLS.privacy)}>
            политикой конфиденциальности
          </Text>
          {' '}и{' '}
          <Text style={styles.link} onPress={() => Linking.openURL(LEGAL_URLS.terms)}>
            пользовательским соглашением
          </Text>
        </Text>
      </View>
      <StopButton
        title={loading ? 'Звоним…' : 'Позвонить мне'}
        onPress={submit}
        style={styles.cta}
        disabled={loading}
      />
      <AuthSupportHint />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  title: { marginTop: spacing.md },
  hint: { marginTop: spacing.md, marginBottom: spacing.lg },
  link: { color: colors.accentBright, textDecorationLine: 'underline' },
  cta: { marginTop: 'auto' },
});
