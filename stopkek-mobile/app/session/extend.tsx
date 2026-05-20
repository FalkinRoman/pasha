import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Header } from '../../src/components/ui/Header';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { colors } from '../../src/theme/colors';
import { radius, spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';
import { formatMoney } from '../../src/utils/format';

const OPTIONS = [
  { h: 1, price: 280 },
  { h: 2, price: 560 },
  { h: 3, price: 840 },
];

export default function ExtendScreen() {
  const [selected, setSelected] = useState(1);

  return (
    <Screen scroll>
      <Header title="Продлить сеанс" back />
      {OPTIONS.map((o) => (
        <Pressable
          key={o.h}
          style={[styles.opt, selected === o.h && styles.optActive]}
          onPress={() => setSelected(o.h)}
        >
          <Text style={typography.h3}>+{o.h} ч</Text>
          <Text style={typography.bodySecondary}>{formatMoney(o.price)}</Text>
        </Pressable>
      ))}
      <StopButton
        title={`Оплатить ${formatMoney(OPTIONS.find((o) => o.h === selected)!.price)}`}
        onPress={() => router.back()}
        style={{ marginTop: 'auto' }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  opt: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    backgroundColor: colors.bgCard,
  },
  optActive: { borderColor: colors.accent, backgroundColor: '#1a1010' },
});
