import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';
import {
  fetchNotificationPrefs,
  updateNotificationPrefs,
} from '../../src/api/notifications';
import { Header } from '../../src/components/ui/Header';
import { Screen } from '../../src/components/ui/Screen';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

const ROWS = [
  { key: 'session' as const, label: 'Начало и конец сеанса' },
  { key: 'remind' as const, label: 'Напоминание за 15 мин' },
  { key: 'promo' as const, label: 'Акции клуба' },
];

export default function NotificationsScreen() {
  const [state, setState] = useState({ session: true, remind: true, promo: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchNotificationPrefs()
      .then(setState)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (key: keyof typeof state, value: boolean) => {
    const next = { ...state, [key]: value };
    setState(next);
    setSaving(true);
    try {
      const saved = await updateNotificationPrefs({ [key]: value });
      setState(saved);
    } catch {
      setState(state);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll>
      <Header title="Уведомления" back />
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : (
        <>
          {ROWS.map((r) => (
            <View key={r.key} style={styles.row}>
              <Text style={typography.body}>{r.label}</Text>
              <Switch
                value={state[r.key]}
                onValueChange={(v) => toggle(r.key, v)}
                disabled={saving}
                trackColor={{ false: colors.bgMuted, true: colors.accentMuted }}
                thumbColor={state[r.key] ? colors.accent : colors.textDisabled}
              />
            </View>
          ))}
        </>
      )}
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
