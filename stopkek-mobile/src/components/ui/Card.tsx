import { ReactNode } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';

interface Props {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  accent?: boolean;
}

export function Card({ children, onPress, style, accent }: Props) {
  const content = (
    <View style={[styles.card, accent && styles.accent, style]}>{children}</View>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.pressable, pressed && { opacity: 0.92 }]}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  pressable: { width: '100%', maxWidth: '100%' },
  card: {
    width: '100%',
    maxWidth: '100%',
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    overflow: 'hidden',
  },
  accent: {
    borderColor: colors.accentMuted,
    backgroundColor: '#1a1010',
  },
});
