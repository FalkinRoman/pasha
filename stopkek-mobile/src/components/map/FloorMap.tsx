import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { MAP_H, MAP_W } from '../../mock/data';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { toggleSeat } from '../../store/bookingSlice';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';

const INNER_PAD = 12;
import { typography } from '../../theme/typography';
import { Seat, SeatStatus } from '../../types';

/** Отступы карты от краёв экрана — меньше, чем у Screen, чтобы контейнер был шире */
const MAP_SCREEN_INSET = spacing.sm;

function seatColors(status: SeatStatus, selected: boolean) {
  if (selected) return { fill: colors.seatSelected, stroke: colors.seatSelectedBorder, text: '#0A0A0A' };
  switch (status) {
    case 'free':
      return { fill: colors.seatFree, stroke: '#3d8b40', text: '#fff' };
    case 'occupied':
      return { fill: colors.seatOccupied, stroke: colors.seatOccupiedBorder, text: '#888' };
    case 'reserved':
      return { fill: colors.seatReserved, stroke: colors.seatReservedBorder, text: '#fff' };
    case 'repair':
      return { fill: colors.seatRepair, stroke: colors.border, text: '#555' };
  }
}

export function FloorMap() {
  const dispatch = useAppDispatch();
  const { seats, zones, selectedSeatIds } = useAppSelector((s) => s.booking);
  const [scale, setScale] = useState(1);
  const { width: windowW } = useWindowDimensions();
  const mapW = windowW - MAP_SCREEN_INSET * 2;
  const mapH = mapW * (MAP_H / MAP_W);

  const onSeatPress = (seat: Seat) => {
    if (seat.status !== 'free') return;
    dispatch(toggleSeat(seat.id));
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.mapBox, { width: mapW, height: mapH }]}>
        <View style={[styles.svgScaler, { transform: [{ scale }] }]}>
          <Svg
            width={mapW}
            height={mapH}
            viewBox={`0 0 ${MAP_W} ${MAP_H}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <Rect
              x={INNER_PAD / 2}
              y={INNER_PAD / 2}
              width={MAP_W - INNER_PAD}
              height={MAP_H - INNER_PAD}
              fill="none"
              stroke="#333"
              strokeWidth={1.5}
              rx={8}
            />
            {zones.map((z) => (
              <SvgText
                key={z.id}
                x={z.labelX}
                y={z.labelY - 5}
                fill="#8a8a8a"
                fontSize={8}
                fontWeight="600"
              >
                {z.name}
              </SvgText>
            ))}
            {zones.map((z) => (
              <SvgText key={`${z.id}-spec`} x={z.labelX} y={z.labelY + 5} fill="#5c5c5c" fontSize={7}>
                {z.specs}
              </SvgText>
            ))}
            {seats.map((seat) => {
              const selected = selectedSeatIds.includes(seat.id);
              const c = seatColors(seat.status, selected);
              return (
                <Rect
                  key={seat.id}
                  x={seat.x}
                  y={seat.y}
                  width={seat.w}
                  height={seat.h}
                  rx={6}
                  fill={c.fill}
                  stroke={c.stroke}
                  strokeWidth={selected ? 2.5 : 1}
                  onPress={() => onSeatPress(seat)}
                />
              );
            })}
            {seats.map((seat) => {
              const selected = selectedSeatIds.includes(seat.id);
              const c = seatColors(seat.status, selected);
              return (
                <SvgText
                  key={`t-${seat.id}`}
                  x={seat.x + seat.w / 2}
                  y={seat.y + seat.h / 2 + 5}
                  fill={c.text}
                  fontSize={11}
                  fontWeight="700"
                  textAnchor="middle"
                  onPress={() => onSeatPress(seat)}
                >
                  {seat.number}
                </SvgText>
              );
            })}
          </Svg>
        </View>
      </View>
      <View style={styles.controls}>
        <Pressable style={styles.ctrl} onPress={() => setScale((s) => Math.max(0.85, s - 0.1))}>
          <Text style={styles.ctrlText}>−</Text>
        </Pressable>
        <Pressable style={styles.ctrl} onPress={() => setScale(1)}>
          <Text style={styles.ctrlText}>⊙</Text>
        </Pressable>
        <Pressable style={styles.ctrl} onPress={() => setScale((s) => Math.min(1.25, s + 0.1))}>
          <Text style={styles.ctrlText}>+</Text>
        </Pressable>
      </View>
      <View style={styles.legend}>
        {(['free', 'occupied', 'reserved'] as SeatStatus[]).map((st) => (
          <View key={st} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: seatColors(st, false).fill }]} />
            <Text style={typography.caption}>
              {st === 'free' ? 'Свободно' : st === 'occupied' ? 'Занято' : 'Бронь'}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs, width: '100%', alignItems: 'center', paddingHorizontal: MAP_SCREEN_INSET },
  mapBox: {
    backgroundColor: colors.bgMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  svgScaler: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  ctrl: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlText: { color: colors.text, fontSize: 18, fontWeight: '600' },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
    paddingBottom: spacing.xs,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 3 },
});
