import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Input } from '../../src/components/ui/Input';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { StopLogo } from '../../src/components/ui/StopLogo';
import { useAppDispatch } from '../../src/store/hooks';
import { setPendingPhone } from '../../src/store/authSlice';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { formatPhone, phoneDigits } from '../../src/utils/format';

export default function PhoneScreen() {
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
    router.push('/(auth)/verify-call');
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
      />
      <View style={styles.hint}>
        <Text style={typography.caption}>
          Нажимая «Позвонить мне», вы соглашаетесь с политикой конфиденциальности
        </Text>
      </View>
      <StopButton title="Позвонить мне" onPress={submit} style={styles.cta} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  title: { marginTop: spacing.md },
  hint: { marginTop: spacing.md, marginBottom: spacing.lg },
  cta: { marginTop: 'auto' },
});
