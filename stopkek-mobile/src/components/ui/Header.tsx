import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

interface Props {
  title: string;
  subtitle?: string;
  back?: boolean;
  /** Куда уйти, если в стеке некуда делать back (таб «Забронировать» и т.п.) */
  backFallback?: string;
  right?: React.ReactNode;
}

export function Header({ title, subtitle, back, backFallback = '/(tabs)/home', right }: Props) {
  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(backFallback as never);
  };

  return (
    <View style={styles.row}>
      {back ? (
        <Pressable onPress={goBack} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
      ) : (
        <View style={styles.iconPlaceholder} />
      )}
      <View style={styles.center}>
        <Text style={typography.h3} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && <Text style={typography.caption}>{subtitle}</Text>}
      </View>
      <View style={styles.right}>{right ?? <View style={styles.iconPlaceholder} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    minHeight: 44,
  },
  iconBtn: { width: 40, alignItems: 'flex-start' },
  iconPlaceholder: { width: 40 },
  center: { flex: 1, alignItems: 'center' },
  right: { width: 40, alignItems: 'flex-end' },
});
