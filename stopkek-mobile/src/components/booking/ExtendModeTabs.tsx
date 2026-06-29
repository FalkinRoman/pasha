import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

export type ExtendMode = 'hours' | 'minutes';

type Props = {
  mode: ExtendMode;
  onChange: (mode: ExtendMode) => void;
};

export function ExtendModeTabs({ mode, onChange }: Props) {
  return (
    <View style={styles.segment}>
      <Pressable
        style={[styles.segmentBtn, mode === 'hours' && styles.segmentBtnActive]}
        onPress={() => onChange('hours')}
      >
        <Text style={[styles.segmentText, mode === 'hours' && styles.segmentTextActive]}>
          Часы
        </Text>
      </Pressable>
      <Pressable
        style={[styles.segmentBtn, mode === 'minutes' && styles.segmentBtnActive]}
        onPress={() => onChange('minutes')}
      >
        <Text style={[styles.segmentText, mode === 'minutes' && styles.segmentTextActive]}>
          Минуты
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.bgMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginBottom: spacing.md,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  segmentBtnActive: {
    backgroundColor: colors.accent,
  },
  segmentText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: '#fff',
  },
});
