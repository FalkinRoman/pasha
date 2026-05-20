import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Header } from '../../src/components/ui/Header';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { Input } from '../../src/components/ui/Input';
import { colors } from '../../src/theme/colors';
import { radius, spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

const ITEMS = ['Монитор', 'Мышь', 'Клавиатура', 'Наушники'];

export default function AcceptanceScreen() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [comment, setComment] = useState('');

  const toggle = (item: string) => {
    setChecked((c) => ({ ...c, [item]: !c[item] }));
  };

  const submit = (ok: boolean) => {
    router.back();
  };

  return (
    <Screen scroll>
      <Header title="Приёмка места" back />
      <Text style={typography.bodySecondary}>
        Отметь, что на месте. Если чего-то нет — напиши в комментарии.
      </Text>
      <View style={styles.list}>
        {ITEMS.map((item) => (
          <StopButton
            key={item}
            title={`${checked[item] ? '✓ ' : ''}${item}`}
            variant={checked[item] ? 'primary' : 'ghost'}
            onPress={() => toggle(item)}
            style={styles.item}
          />
        ))}
      </View>
      <Input
        label="Комментарий"
        value={comment}
        onChangeText={setComment}
        placeholder="Например: нет наушников"
        multiline
      />
      <StopButton title="Всё в порядке" onPress={() => submit(true)} style={{ marginTop: spacing.lg }} />
      <StopButton title="Есть проблема" variant="danger" onPress={() => submit(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { marginVertical: spacing.lg, gap: spacing.sm },
  item: { width: '100%' },
});
