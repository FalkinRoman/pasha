import { Image, StyleSheet, View } from 'react-native';

/** Тот же знак, что и иконка на рабочем столе (assets/icon.png). */
const logoSource = require('../../../assets/icon.png');

interface Props {
  size?: number;
  /** Рамка вокруг лого (по умолчанию выкл — у знака свой фон). */
  darkBg?: boolean;
}

export function StopLogo({ size = 80, darkBg = false }: Props) {
  const padding = darkBg ? Math.round(size * 0.15) : 0;
  const containerSize = size + padding * 2;
  const borderRadius = darkBg ? Math.round(containerSize * 0.22) : 0;

  return (
    <View
      style={[
        styles.wrap,
        { width: containerSize, height: containerSize, borderRadius },
        darkBg && styles.darkBg,
      ]}
    >
      <Image
        source={logoSource}
        style={{ width: size, height: size, borderRadius: Math.round(size * 0.12) }}
        resizeMode="contain"
        accessibilityLabel="стопКЕК"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  darkBg: {
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
});
