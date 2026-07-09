import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { requestCallcheck } from '../../src/api/auth';
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

export default function PhoneCallcheckScreen() {
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
    setLoading(true);
    setError('');
    try {
      const res = await requestCallcheck(normalized);
      dispatch(setPendingPhone(normalized));
      router.push({
        pathname: '/(auth)/verify-callcheck',
        params: {
          phone: normalized,
          sessionId: res.sessionId,
          callPhone: res.callPhone,
          callPhonePretty: res.callPhonePretty,
          expiresInSec: String(res.expiresInSec),
          retryAfterSec: String(res.retryAfterSec ?? 15),
        },
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 429 && e.body && typeof e.body === 'object') {
        const body = e.body as { message?: { message?: string } | string };
        const nested = typeof body.message === 'object' ? body.message : null;
        setError(nested?.message ?? e.message);
      } else {
        setError(e instanceof ApiError ? e.message : 'Не удалось начать вход');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.top}>
        <StopLogo size={64} />
        <Text style={[typography.h1, styles.title]}>Вход звонком</Text>
        <Text style={typography.bodySecondary}>
          Укажите номер — мы дадим телефон, на который нужно позвонить с этого номера. Звонок
          бесплатный, сбросится сам.
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
          Продолжая, вы соглашаетесь с{' '}
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
        title={loading ? 'Готовим номер…' : 'Продолжить'}
        onPress={submit}
        style={styles.cta}
        disabled={loading}
      />
      <StopButton
        title="Вход по коду из звонка"
        variant="ghost"
        onPress={() => router.replace('/(auth)/phone')}
        style={styles.back}
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
  cta: { marginTop: spacing.md },
  back: { marginTop: spacing.sm },
});
