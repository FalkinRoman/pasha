import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { StopLogo } from './StopLogo';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type Size = 'sm' | 'md' | 'lg';

type Props = {
  /** Полный экран по центру */
  fullScreen?: boolean;
  /** Занимает доступную область (карта, список) */
  flex?: boolean;
  message?: string;
  size?: Size;
  style?: ViewStyle;
};

const LOGO: Record<Size, number> = { sm: 48, md: 72, lg: 96 };
const RING: Record<Size, number> = { sm: 72, md: 108, lg: 140 };

export function StopkekLoader({
  fullScreen = false,
  flex = false,
  message,
  size = 'md',
  style,
}: Props) {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.3)).current;
  const dots = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 2400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 0.85,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.25,
          duration: 1100,
          useNativeDriver: true,
        }),
      ])
    );
    const dotsLoop = Animated.loop(
      Animated.timing(dots, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spinLoop.start();
    pulseLoop.start();
    glowLoop.start();
    dotsLoop.start();
    return () => {
      spinLoop.stop();
      pulseLoop.stop();
      glowLoop.stop();
      dotsLoop.stop();
    };
  }, [spin, pulse, glow, dots]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });
  const dot1 = dots.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: [0.3, 1, 0.3, 0.3] });
  const dot2 = dots.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: [0.3, 0.3, 1, 0.3] });
  const dot3 = dots.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: [0.3, 0.3, 0.3, 1] });

  const ringSize = RING[size];
  const logoSize = LOGO[size];

  return (
    <View
      style={[
        styles.wrap,
        fullScreen && styles.fullScreen,
        flex && styles.flex,
        style,
      ]}
    >
      <View style={[styles.core, { width: ringSize, height: ringSize }]}>
        <Animated.View
          style={[
            styles.glow,
            {
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              opacity: glow,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.ring,
            {
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              transform: [{ rotate }],
            },
          ]}
        />
        <Animated.View style={{ transform: [{ scale }] }}>
          <StopLogo size={logoSize} />
        </Animated.View>
      </View>

      {message ? (
        <View style={styles.msgRow}>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.dots}>
            <Animated.Text style={[styles.dot, { opacity: dot1 }]}>.</Animated.Text>
            <Animated.Text style={[styles.dot, { opacity: dot2 }]}>.</Animated.Text>
            <Animated.Text style={[styles.dot, { opacity: dot3 }]}>.</Animated.Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
    minHeight: 200,
  },
  core: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    backgroundColor: colors.accentGlow,
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: colors.accent,
    borderRightColor: colors.accentMuted,
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: spacing.lg,
  },
  message: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  dots: {
    flexDirection: 'row',
    width: 16,
    marginBottom: 1,
  },
  dot: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '700',
  },
});
