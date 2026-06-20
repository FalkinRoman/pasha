import { StyleSheet, Text } from 'react-native';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

/** Пустой список — как в истории броней и транзакций */
export function EmptyHint() {
  return <Text style={styles.empty}>Пока пусто</Text>;
}

const styles = StyleSheet.create({
  empty: {
    ...typography.bodySecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
