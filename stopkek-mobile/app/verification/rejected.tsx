import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Header } from '../../src/components/ui/Header';
import { Screen } from '../../src/components/ui/Screen';
import { StopButton } from '../../src/components/ui/StopButton';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

export default function VerificationRejectedScreen() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();

  return (
    <Screen>
      <Header title="Отклонено" back />
      <View style={styles.box}>
        <Text style={typography.h3}>Верификация не пройдена</Text>
        <Text style={styles.reason}>
          {reason?.trim() || 'Исправьте замечания и отправьте фото снова.'}
        </Text>
      </View>
      <StopButton title="Повторить" onPress={() => router.replace('/verification')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  reason: {
    ...typography.body,
    color: colors.accent,
    backgroundColor: 'rgba(196,30,36,0.15)',
    padding: spacing.md,
    borderRadius: 12,
  },
});
