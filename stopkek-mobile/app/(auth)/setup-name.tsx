import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { updateProfile } from '../../src/api/users';
import { ApiError } from '../../src/api/client';
import { Input } from '../../src/components/ui/Input';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { StopLogo } from '../../src/components/ui/StopLogo';
import { useAppDispatch } from '../../src/store/hooks';
import { updateUser } from '../../src/store/authSlice';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function SetupNameScreen() {
  const dispatch = useAppDispatch();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('Минимум 2 символа');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const user = await updateProfile(trimmed);
      dispatch(updateUser(user));
      router.replace('/(tabs)/home');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.top}>
        <StopLogo size={64} />
        <Text style={[typography.h1, styles.title]}>Как вас зовут?</Text>
        <Text style={typography.bodySecondary}>
          Имя будет на главной и в профиле
        </Text>
      </View>
      <Input label="Имя" value={name} onChangeText={setName} error={error} autoFocus />
      <StopButton title="Продолжить" onPress={submit} disabled={loading} style={styles.cta} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  title: { marginTop: spacing.md },
  cta: { marginTop: 'auto' },
});
