import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const BOX_W = 56;
const BOX_H = 64;

type Props = {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  autoFocus?: boolean;
};

export function CodeInput({
  length = 4,
  value,
  onChange,
  error = false,
  autoFocus = true,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const cursorOpacity = useRef(new Animated.Value(1)).current;
  const [focused, setFocused] = useState(false);
  const activeIndex = Math.min(value.length, length - 1);

  useEffect(() => {
    const showCursor = focused && value.length < length;
    if (!showCursor) {
      cursorOpacity.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, {
          toValue: 0,
          duration: 530,
          useNativeDriver: true,
        }),
        Animated.timing(cursorOpacity, {
          toValue: 1,
          duration: 530,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [focused, value, length, cursorOpacity]);

  const focus = () => inputRef.current?.focus();

  return (
    <Pressable style={styles.row} onPress={focus}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus={autoFocus}
        caretHidden
        selectionColor={colors.accentBright}
        style={styles.hiddenInput}
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
      />
      {Array.from({ length }).map((_, i) => {
        const filled = Boolean(value[i]);
        const active = focused && !error && i === activeIndex && value.length < length;
        return (
          <View
            key={i}
            style={[
              styles.box,
              filled && styles.boxFilled,
              active && styles.boxActive,
              error && styles.boxError,
            ]}
          >
            {filled ? (
              <Text style={styles.digit}>{value[i]}</Text>
            ) : active ? (
              <Animated.View style={[styles.cursor, { opacity: cursorOpacity }]} />
            ) : null}
          </View>
        );
      })}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    position: 'relative',
    minHeight: BOX_H,
  },
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.02,
    color: 'transparent',
  },
  box: {
    width: BOX_W,
    height: BOX_H,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: {
    borderColor: colors.accent,
    backgroundColor: '#1f1010',
  },
  boxActive: {
    borderColor: colors.accentBright,
    borderWidth: 2,
    backgroundColor: '#241010',
  },
  boxError: {
    borderColor: colors.danger,
  },
  digit: {
    ...typography.h1,
    fontSize: 28,
    lineHeight: 32,
    textAlign: 'center',
    includeFontPadding: false,
  },
  cursor: {
    width: 2,
    height: 28,
    borderRadius: 1,
    backgroundColor: colors.accentBright,
  },
});
