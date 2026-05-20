import { ImageBackground, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { SCREEN_PADDING } from '../../theme/layout';
import { spacing } from '../../theme/spacing';

const bgSource = require('../../../assets/brand/bg-mobile.png');

interface Props {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: ViewStyle;
  noGradient?: boolean;
}

export function Screen({ children, scroll, padded = true, style, noGradient }: Props) {
  const insets = useSafeAreaInsets();
  const hPad = padded ? SCREEN_PADDING : 0;
  const padding = {
    paddingTop: insets.top + spacing.sm,
    paddingBottom: insets.bottom + spacing.md,
    paddingHorizontal: hPad,
  };

  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scroll, padding, style]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.inner}>{children}</View>
    </ScrollView>
  ) : (
    <View style={[styles.fill, padding, style]}>
      <View style={styles.inner}>{children}</View>
    </View>
  );

  return (
    <View style={styles.root}>
      <ImageBackground
        source={bgSource}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        imageStyle={noGradient ? undefined : styles.bgImage}
      />
      <View style={styles.overlay} />
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, width: '100%', overflow: 'hidden' },
  bgImage: {
    opacity: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  fill: { flex: 1, width: '100%' },
  scroll: { flexGrow: 1, width: '100%' },
  inner: { width: '100%', maxWidth: '100%', flexGrow: 1 },
});
