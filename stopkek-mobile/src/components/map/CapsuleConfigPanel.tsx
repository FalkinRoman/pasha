import { StyleSheet, Text, View } from 'react-native';
import { SOLO_CONFIG_LINES } from '../../constants/floorLayout';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

type Props = {
  /** @deprecated оставлен для совместимости */
  zone?: unknown;
  embedded?: boolean;
};

export function CapsuleConfigPanel({ embedded = true }: Props) {
  return (
    <View style={[styles.root, embedded && styles.rootEmbedded]}>
      {SOLO_CONFIG_LINES.map((line) => (
        <View key={line.label} style={styles.line}>
          <Text style={[styles.lineLabel, embedded && styles.lineLabelEmbedded]}>
            {line.label}
          </Text>
          <Text
            style={[styles.lineValue, embedded && styles.lineValueEmbedded]}
            numberOfLines={2}
          >
            {line.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    gap: 10,
    padding: 14,
  },
  rootEmbedded: {
    justifyContent: 'space-evenly',
    gap: 0,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  line: {
    gap: 1,
  },
  lineLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
  },
  lineLabelEmbedded: {
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0.2,
  },
  lineValue: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 15,
  },
  lineValueEmbedded: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
  },
});
