import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
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

export default function PhoneSmsScreen() {
  const dispatch = useAppDispatch();
  const [phone, setPhone] = useState('+7');
  const [error, setError] = useState('');

  const onChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    if (digits.length <= 11) setPhone(formatPhone(digits.length ? digits : '7'));
    setError('');
  };

  const submit = () => {
    const normalized = phoneDigits(phone);
    if (normalized.replace(/\D/g, '').length < 11) {
      setError('Введите номер полностью');
      return;
    }
    dispatch(setPendingPhone(normalized));
    router.push('/(auth)/verify-sms');
  };

  return (
    <Screen scroll>
      <View style={styles.top}>
        <StopLogo size={64} />
        <Text style={[typography.h1, styles.title]}>Вход по SMS</Text>
        <Text style={typography.bodySecondary}>
          Введите номер — отправим SMS с кодом из 4 цифр
        </Text>
      </View>
      <Input
        label="Номер телефона"
        value={phone}
        onChangeText={onChange}
        keyboardType="phone-pad"
        error={error}
        autoFocus
      />
      <View style={styles.hint}>
        <Text style={typography.caption}>
          Основной способ — бесплатный входящий звонок. SMS — запасной вариант.
        </Text>
        <Text style={[typography.caption, { marginTop: spacing.sm }]}>
          Нажимая «Отправить SMS», вы соглашаетесь с{' '}
          <Text style={styles.link} onPress={() => Linking.openURL(LEGAL_URLS.privacy)}>
            политикой конфиденциальности
          </Text>
          {' '}и{' '}
          <Text style={styles.link} onPress={() => Linking.openURL(LEGAL_URLS.terms)}>
            пользовательским соглашением
          </Text>
        </Text>
      </View>
      <StopButton title="Отправить SMS" onPress={submit} style={styles.cta} />
      <Pressable style={styles.alt} onPress={() => router.back()}>
        <Text style={styles.altText}>Вернуться к входу по звонку</Text>
      </Pressable>
      <AuthSupportHint />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  title: { marginTop: spacing.md },
  hint: { marginTop: spacing.md, marginBottom: spacing.lg },
  cta: { marginTop: 'auto' },
  alt: { alignItems: 'center', paddingVertical: spacing.md },
  altText: { ...typography.body, color: colors.accentBright },
  link: { color: colors.accentBright, textDecorationLine: 'underline' },
});
