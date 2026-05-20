import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { VerificationTimer } from './VerificationTimer';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type Props = {
  secondsLeft: number | null;
};

export function VerificationStatusBanner({ secondsLeft }: Props) {
  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push('/verification/pending')}
    >
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.accent} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title}>Верификация на проверке</Text>
          <Text style={styles.sub}>
            Нажмите, чтобы открыть статус и таймер
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </View>
      <View style={styles.timerRow}>
        <VerificationTimer secondsLeft={secondsLeft} size="md" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(196,30,36,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1 },
  title: { ...typography.body, fontWeight: '600' },
  sub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  timerRow: { alignItems: 'center', paddingTop: spacing.xs },
});
