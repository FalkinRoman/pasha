import { ScrollView, StyleSheet, Text } from 'react-native';
import { Header } from '../../src/components/ui/Header';
import { Screen } from '../../src/components/ui/Screen';
import { PRIVACY_POLICY } from '../../src/constants/legal';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';

export default function PrivacyScreen() {
  return (
    <Screen>
      <Header title="Конфиденциальность" back />
      <ScrollView style={styles.scroll}>
        <Text style={styles.body}>{PRIVACY_POLICY}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  body: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
});
