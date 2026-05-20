import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Header } from '../../src/components/ui/Header';
import { Screen } from '../../src/components/ui/Screen';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

const ROWS = [
  { key: 'session', label: 'Начало и конец сеанса' },
  { key: 'remind', label: 'Напоминание за 15 мин' },
  { key: 'promo', label: 'Акции клуба' },
];

export default function NotificationsScreen() {
  const [state, setState] = useState({ session: true, remind: true, promo: false });

  return (
    <Screen scroll>
      <Header title="Уведомления" back />
      {ROWS.map((r) => (
        <View key={r.key} style={styles.row}>
          <Text style={typography.body}>{r.label}</Text>
          <Switch
            value={state[r.key as keyof typeof state]}
            onValueChange={(v) => setState((s) => ({ ...s, [r.key]: v }))}
            trackColor={{ false: colors.bgMuted, true: colors.accentMuted }}
            thumbColor={state[r.key as keyof typeof state] ? colors.accent : colors.textDisabled}
          />
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
