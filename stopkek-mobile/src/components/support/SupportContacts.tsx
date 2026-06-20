import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import {
  mailUrl,
  openExternal,
  SupportContacts as Contacts,
  telUrl,
  telegramUrl,
} from '../../utils/support';

type Props = {
  contacts: Contacts;
  compact?: boolean;
};

export function SupportContactsBlock({ contacts, compact }: Props) {
  const items = [
    {
      icon: 'call-outline' as const,
      label: 'Телефон',
      value: contacts.supportPhone,
      url: telUrl(contacts.supportPhone),
    },
    {
      icon: 'paper-plane-outline' as const,
      label: 'Telegram',
      value: contacts.supportTelegram,
      url: telegramUrl(contacts.supportTelegram),
    },
    {
      icon: 'mail-outline' as const,
      label: 'Email',
      value: contacts.supportEmail,
      url: mailUrl(contacts.supportEmail),
    },
  ].filter((i) => i.value?.trim());

  if (!items.length) {
    return (
      <Text style={[typography.bodySecondary, styles.empty]}>
        Контакты поддержки пока не заданы
      </Text>
    );
  }

  return (
    <View style={[styles.list, compact && styles.compact]}>
      {items.map((item) => (
        <Pressable
          key={item.label}
          style={styles.row}
          onPress={() => item.url && openExternal(item.url)}
          disabled={!item.url}
        >
          <Ionicons name={item.icon} size={22} color={colors.accent} />
          <View style={styles.text}>
            <Text style={typography.caption}>{item.label}</Text>
            <Text style={typography.body}>{item.value}</Text>
          </View>
          {item.url ? (
            <Ionicons name="chevron-forward" size={20} color={colors.textDisabled} />
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, marginTop: spacing.md },
  compact: { marginTop: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  text: { flex: 1 },
  empty: { textAlign: 'center', marginTop: spacing.lg },
});
