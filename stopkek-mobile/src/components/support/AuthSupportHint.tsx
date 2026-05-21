import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

/** Ссылка на поддержку на экранах входа */
export function AuthSupportHint() {
  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => router.push('/support')}>
        <Text style={styles.link}>Не приходит звонок? Поддержка</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.lg, alignItems: 'center' },
  link: {
    ...typography.body,
    color: colors.accent,
    textAlign: 'center',
  },
});
