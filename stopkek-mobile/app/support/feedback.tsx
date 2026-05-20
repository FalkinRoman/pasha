import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { sendFeedback } from '../../src/api/feedback';
import { ApiError } from '../../src/api/client';
import { Header } from '../../src/components/ui/Header';
import { Input } from '../../src/components/ui/Input';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function FeedbackScreen() {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!text.trim()) {
      Alert.alert('Введите сообщение');
      return;
    }
    setLoading(true);
    try {
      await sendFeedback(rating, text.trim());
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/profile');
    } catch (e) {
      Alert.alert('Ошибка', e instanceof ApiError ? e.message : 'Не отправлено');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <Header title="Обратная связь" back />
      <Text style={typography.caption}>Оценка</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setRating(n)}>
            <Text style={{ fontSize: 32, color: n <= rating ? colors.warning : colors.border }}>
              ★
            </Text>
          </Pressable>
        ))}
      </View>
      <Input
        label="Сообщение"
        value={text}
        onChangeText={setText}
        multiline
        placeholder="Отзыв или предложение"
      />
      <StopButton title="Отправить" onPress={submit} disabled={loading} style={{ marginTop: 'auto' }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stars: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md },
});
