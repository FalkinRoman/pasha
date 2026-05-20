import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { IdentityStatus } from '../../types';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const VERIFIED: IdentityStatus[] = ['approved', 'auto_approved'];

type Props = {
  status?: IdentityStatus;
  verified?: boolean;
};

export function IdentityBadge({ status = 'none', verified }: Props) {
  const isVerified = verified ?? VERIFIED.includes(status);

  if (isVerified) {
    return (
      <View style={[styles.row, styles.ok]}>
        <Ionicons name="checkmark-circle" size={18} color={colors.success} />
        <Text style={[styles.text, styles.textOk]}>Верификация пройдена</Text>
      </View>
    );
  }

  if (status === 'pending') {
    return (
      <Pressable
        style={[styles.row, styles.pending]}
        onPress={() => router.push('/verification/pending')}
      >
        <Ionicons name="time-outline" size={18} color={colors.warning} />
        <Text style={[styles.text, styles.textPending]}>На проверке</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      </Pressable>
    );
  }

  if (status === 'rejected') {
    return (
      <Pressable
        style={[styles.row, styles.fail]}
        onPress={() => router.push('/verification')}
      >
        <Ionicons name="close-circle-outline" size={18} color={colors.danger} />
        <Text style={[styles.text, styles.textFail]}>Верификация не пройдена</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[styles.row, styles.fail]}
      onPress={() => router.push('/verification')}
    >
      <Ionicons name="shield-outline" size={18} color={colors.textSecondary} />
      <Text style={[styles.text, styles.textMuted]}>Пройти верификацию</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  ok: { backgroundColor: 'rgba(46,125,50,0.18)' },
  pending: { backgroundColor: 'rgba(249,168,37,0.12)' },
  fail: { backgroundColor: 'rgba(196,30,36,0.1)' },
  text: { ...typography.caption, fontWeight: '600' },
  textOk: { color: '#81c784' },
  textPending: { color: colors.warning, flex: 1 },
  textFail: { color: colors.accent, flex: 1 },
  textMuted: { color: colors.textSecondary, flex: 1 },
});
