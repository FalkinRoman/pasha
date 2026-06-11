import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { deleteAccount, updateProfile } from '../../src/api/users';
import { ApiError, setAccessToken } from '../../src/api/client';
import { Header } from '../../src/components/ui/Header';
import { Input } from '../../src/components/ui/Input';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { saveTokens } from '../../src/storage/authStorage';
import { useAppDispatch, useAppSelector } from '../../src/store/hooks';
import { logout, updateUser } from '../../src/store/authSlice';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function EditProfileScreen() {
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const [name, setName] = useState(user?.name ?? '');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const onDeleteAccount = () => {
    Alert.alert(
      'Удалить аккаунт?',
      'Все данные — профиль, история броней, баланс и фото верификации — будут удалены безвозвратно. Остаток баланса не возвращается.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount();
              setAccessToken(null);
              await saveTokens(null, null);
              dispatch(logout());
              router.replace('/(auth)/phone');
              Alert.alert('Аккаунт удалён', 'Все данные удалены.');
            } catch (e) {
              Alert.alert(
                'Не удалось удалить',
                e instanceof ApiError ? e.message : 'Попробуйте позже'
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Screen scroll>
      <Header title="Редактирование" back />
      <Input label="Имя" value={name} onChangeText={setName} error={error} />
      <StopButton
        title="Сохранить"
        onPress={async () => {
          try {
            const updated = await updateProfile(name.trim());
            dispatch(updateUser(updated));
            router.back();
          } catch (e) {
            setError(e instanceof ApiError ? e.message : 'Ошибка');
          }
        }}
        style={{ marginTop: 24 }}
      />
      <Pressable onPress={onDeleteAccount} style={styles.deleteBtn} disabled={deleting}>
        <Text style={styles.deleteText}>
          {deleting ? 'Удаляем…' : 'Удалить аккаунт'}
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  deleteBtn: {
    alignItems: 'center',
    padding: spacing.md,
    marginTop: 'auto',
    marginBottom: spacing.lg,
  },
  deleteText: { ...typography.caption, color: colors.danger },
});
