import { Image, StyleSheet, View } from 'react-native';
import { colors } from '../../theme/colors';

const logoSource = require('../../../assets/brand/logo-stopkek.png');

interface Props {
  size?: number;
  /** Показывать тёмную подложку вокруг лого (по умолчанию true) */
  darkBg?: boolean;
}

export function StopLogo({ size = 80, darkBg = true }: Props) {
  const padding = Math.round(size * 0.15);
  const containerSize = size + padding * 2;
  const borderRadius = Math.round(containerSize * 0.22);

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
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityLabel="стопкек"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkBg: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
