import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { PAYMENT_POLICY_OFFER_URL, PAYMENT_POLICY_SHORT } from '../../constants/paymentPolicy';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type Props = {
  compact?: boolean;
};

export function PaymentPolicyNotice({ compact }: Props) {
  return (
    <View style={[styles.box, compact && styles.boxCompact]}>
      <Ionicons name="information-circle-outline" size={20} color={colors.warning} />
      <View style={styles.textWrap}>
        <Text style={styles.text}>{PAYMENT_POLICY_SHORT}</Text>
        <Pressable onPress={() => Linking.openURL(PAYMENT_POLICY_OFFER_URL)}>
          <Text style={styles.link}>Подробнее в оферте</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#5c4a1a',
    backgroundColor: '#1a1608',
    marginTop: spacing.md,
  },
  boxCompact: {
    marginTop: spacing.sm,
    padding: spacing.sm,
  },
  textWrap: { flex: 1, gap: spacing.xs },
  text: { ...typography.caption, color: '#e8dcc0', lineHeight: 18 },
  link: { ...typography.caption, color: colors.accentBright, textDecorationLine: 'underline' },
});
