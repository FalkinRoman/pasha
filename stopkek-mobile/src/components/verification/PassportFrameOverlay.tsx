import { StyleSheet, View } from 'react-native';
import Svg, { Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import { colors } from '../../theme/colors';

const GUIDE = 'rgba(255,255,255,0.88)';
const GUIDE_SOFT = 'rgba(255,255,255,0.35)';

const W = 200;
const H = 300;
const INSET = 16;
const CORNER_LEN = 20;
const CORNER_R = 10;

/** Селфи с паспортом: овал лица чуть ниже от верха, паспорт на груди */
const FACE = { cx: 100, cy: 82, rx: 44, ry: 58 };
const PASS = { w: 94, h: 66, r: 10, gap: 22 };

function CornerBrackets() {
  const bracket = `M 0 ${CORNER_LEN} L 0 ${CORNER_R} Q 0 0 ${CORNER_R} 0 L ${CORNER_LEN} 0`;
  const s = colors.accent;
  const m = INSET;

  return (
    <G stroke={s} strokeWidth={2} strokeLinecap="round" fill="none">
      <G transform={`translate(${m}, ${m})`}>
        <Path d={bracket} />
      </G>
      <G transform={`translate(${W - m}, ${m}) scale(-1, 1)`}>
        <Path d={bracket} />
      </G>
      <G transform={`translate(${W - m}, ${H - m}) scale(-1, -1)`}>
        <Path d={bracket} />
      </G>
      <G transform={`translate(${m}, ${H - m}) scale(1, -1)`}>
        <Path d={bracket} />
      </G>
    </G>
  );
}

export function PassportFrameOverlay() {
  const faceBottom = FACE.cy + FACE.ry;
  const passX = (W - PASS.w) / 2;
  const passY = faceBottom + PASS.gap;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <CornerBrackets />

        <Ellipse
          cx={FACE.cx}
          cy={FACE.cy}
          rx={FACE.rx}
          ry={FACE.ry}
          fill="none"
          stroke={GUIDE}
          strokeWidth={1.25}
        />

        <Path
          d={`M ${FACE.cx - FACE.rx + 8} ${faceBottom - 6} Q ${FACE.cx} ${faceBottom + 8} ${FACE.cx + FACE.rx - 8} ${faceBottom - 6}`}
          fill="none"
          stroke={GUIDE_SOFT}
          strokeWidth={1}
          strokeLinecap="round"
        />

        <Rect
          x={passX}
          y={passY}
          width={PASS.w}
          height={PASS.h}
          rx={PASS.r}
          fill="none"
          stroke={GUIDE}
          strokeWidth={1.25}
        />
        <Rect
          x={passX + 10}
          y={passY + 12}
          width={26}
          height={34}
          rx={4}
          fill="none"
          stroke={GUIDE_SOFT}
          strokeWidth={1}
        />
        <Line
          x1={passX + 44}
          y1={passY + 18}
          x2={passX + PASS.w - 10}
          y2={passY + 18}
          stroke={GUIDE_SOFT}
          strokeWidth={1}
          strokeLinecap="round"
        />
        <Line
          x1={passX + 44}
          y1={passY + 32}
          x2={passX + PASS.w - 18}
          y2={passY + 32}
          stroke={GUIDE_SOFT}
          strokeWidth={1}
          strokeLinecap="round"
        />
        <Line
          x1={passX + 44}
          y1={passY + 46}
          x2={passX + PASS.w - 24}
          y2={passY + 46}
          stroke={GUIDE_SOFT}
          strokeWidth={1}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
});
