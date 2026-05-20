import { router } from 'expo-router';
import { useState } from 'react';
import { updateProfile } from '../../src/api/users';
import { ApiError } from '../../src/api/client';
import { Header } from '../../src/components/ui/Header';
import { Input } from '../../src/components/ui/Input';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { useAppDispatch, useAppSelector } from '../../src/store/hooks';
import { updateUser } from '../../src/store/authSlice';

export default function EditProfileScreen() {
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const [name, setName] = useState(user?.name ?? '');
  const [error, setError] = useState('');

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
    </Screen>
  );
}
