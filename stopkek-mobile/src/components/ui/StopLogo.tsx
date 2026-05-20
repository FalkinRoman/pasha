import { Image, StyleSheet, View } from 'react-native';

const logoSource = require('../../../assets/brand/logo-stopkek.png');

interface Props {
  size?: number;
}

export function StopLogo({ size = 80 }: Props) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Image
        source={logoSource}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityLabel="stopkek"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
