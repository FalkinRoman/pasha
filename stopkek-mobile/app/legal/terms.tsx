import { ScrollView, StyleSheet, Text } from 'react-native';
import { Header } from '../../src/components/ui/Header';
import { Screen } from '../../src/components/ui/Screen';
import { TERMS_OF_USE } from '../../src/constants/legal';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';

export default function TermsScreen() {
  return (
    <Screen>
      <Header title="Соглашение" back />
      <ScrollView style={styles.scroll}>
        <Text style={styles.body}>{TERMS_OF_USE}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  body: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
});
