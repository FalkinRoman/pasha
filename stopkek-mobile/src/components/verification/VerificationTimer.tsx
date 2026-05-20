import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const DEFAULT_TOTAL = 5 * 60;

function formatTimer(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

type Props = {
  /** Секунд до автоподтверждения (с сервера) */
  secondsLeft: number | null;
  totalSec?: number;
  size?: 'md' | 'lg';
};

export function VerificationTimer({
  secondsLeft,
  totalSec = DEFAULT_TOTAL,
  size = 'lg',
}: Props) {
  const [localSec, setLocalSec] = useState(secondsLeft ?? totalSec);

  useEffect(() => {
    if (secondsLeft != null) setLocalSec(secondsLeft);
  }, [secondsLeft]);

  useEffect(() => {
    const id = setInterval(() => {
      setLocalSec((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const dim = size === 'lg' ? 132 : 88;
  const stroke = size === 'lg' ? 6 : 4;
  const r = (dim - stroke) / 2;
  const cx = dim / 2;
  const circ = 2 * Math.PI * r;
  const progress = Math.max(0, Math.min(1, localSec / totalSec));
  const offset = circ * (1 - progress);

  return (
    <View style={styles.wrap}>
      <View style={{ width: dim, height: dim }}>
        <Svg width={dim} height={dim}>
          <Circle
            cx={cx}
            cy={cx}
            r={r}
            stroke={colors.border}
            strokeWidth={stroke}
            fill="none"
          />
          <Circle
            cx={cx}
            cy={cx}
            r={r}
            stroke={colors.accent}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${circ} ${circ}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${cx}, ${cx}`}
          />
        </Svg>
        <View style={[styles.center, { width: dim, height: dim }]}>
          <Text style={size === 'lg' ? styles.timeLg : styles.timeMd}>
            {formatTimer(localSec)}
          </Text>
        </View>
      </View>
      <Text style={styles.hint}>
        {localSec > 0
          ? 'Осталось до автоматической проверки'
          : 'Завершаем проверку…'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.sm },
  center: {
    position: 'absolute',
    left: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeLg: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  timeMd: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
