import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { StopButton } from '../../src/components/ui/StopButton';
import { StopLogo } from '../../src/components/ui/StopLogo';
import { Screen } from '../../src/components/ui/Screen';
import { useAppDispatch } from '../../src/store/hooks';
import { setWelcomeSeen } from '../../src/store/authSlice';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { typography } from '../../src/theme/typography';

const SLIDES = [
  { title: 'Бронируй место', desc: 'Карта зала в реальном времени — выбирай зону и железо' },
  { title: 'Заходи без ключа', desc: 'Открывай дверь и ячейку прямо из приложения' },
  { title: 'Играй по таймеру', desc: 'Следи за сеансом и продлевай в один тап' },
];

export default function WelcomeScreen() {
  const dispatch = useAppDispatch();

  const start = () => {
    dispatch(setWelcomeSeen());
    router.replace('/(auth)/phone');
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <StopLogo size={100} />
        <Text style={styles.brand}>stopkek</Text>
        <Text style={typography.bodySecondary}>компьютерный клуб</Text>
      </View>
      <View style={styles.slides}>
        {SLIDES.map((s) => (
          <View key={s.title} style={styles.slide}>
            <View style={styles.bullet} />
            <View style={{ flex: 1 }}>
              <Text style={typography.h3}>{s.title}</Text>
              <Text style={[typography.bodySecondary, { marginTop: 4 }]}>{s.desc}</Text>
            </View>
          </View>
        ))}
      </View>
      <StopButton title="Начать" onPress={start} style={styles.cta} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.xl },
  brand: {
    ...typography.brand,
    fontSize: 42,
    marginTop: spacing.md,
    color: colors.accent,
  },
  slides: { gap: spacing.lg, flex: 1 },
  slide: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginTop: 8,
  },
  cta: { marginTop: 'auto' },
});
