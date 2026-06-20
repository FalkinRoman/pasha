import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import {
  capsuleRoomForSeat,
  MAP_CENTER_X,
  MAP_H,
  MAP_W,
  zoneSubtitle,
} from '../../constants/floorLayout';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { clearSeatSelection, toggleSeat } from '../../store/bookingSlice';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Seat, SeatStatus } from '../../types';
import { BookedSeatPanel } from './BookedSeatPanel';
import { CapsuleConfigPanel } from './CapsuleConfigPanel';

const INNER_PAD = 12;
const MAP_SCREEN_INSET = spacing.sm;
const CARD_MIN_H = 212;
const CAPSULE_ROOM_FILL = 'rgba(46, 125, 50, 0.12)';
const CAPSULE_ROOM_STROKE = '#4caf50';
const CAPSULE_ROOM_FILL_BUSY = 'rgba(196, 30, 36, 0.1)';
const CAPSULE_ROOM_STROKE_BUSY = colors.seatReservedBorder;

function seatColors(status: SeatStatus, selected: boolean) {
  if (selected) {
    return { fill: colors.seatSelected, stroke: colors.seatSelectedBorder, text: '#0A0A0A' };
  }
  switch (status) {
    case 'free':
      return { fill: '#3d9e40', stroke: '#66bb6a', text: '#fff' };
    case 'occupied':
      return { fill: colors.seatOccupied, stroke: colors.seatOccupiedBorder, text: '#888' };
    case 'reserved':
      return { fill: colors.seatReserved, stroke: colors.seatReservedBorder, text: '#fff' };
    case 'repair':
      return { fill: colors.seatRepair, stroke: colors.border, text: '#555' };
  }
}

type Props = {
  onInspectSeat?: (seat: Seat | null) => void;
};

export function FloorMap({ onInspectSeat }: Props) {
  const dispatch = useAppDispatch();
  const { seats, zones, selectedSeatIds } = useAppSelector((s) => s.booking);
  const [inspectedSeatId, setInspectedSeatId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const { width: windowW } = useWindowDimensions();
  const soloZone = zones[0] ?? null;

  const inspectedSeat = seats.find((s) => s.id === inspectedSeatId) ?? null;
  const showBookedPanel =
    inspectedSeat &&
    (inspectedSeat.status === 'reserved' ||
      inspectedSeat.status === 'occupied' ||
      inspectedSeat.status === 'repair');

  const cardW = windowW - MAP_SCREEN_INSET * 2;
  const configW = Math.min(152, Math.max(118, Math.round(cardW * 0.4)));
  const mapColW = cardW - configW;
  const mapSvgW = mapColW - spacing.sm * 2;
  const mapSvgH = CARD_MIN_H - spacing.sm * 2;

  const inspect = (seat: Seat | null) => {
    setInspectedSeatId(seat?.id ?? null);
    onInspectSeat?.(seat);
  };

  const onSeatPress = (seat: Seat) => {
    if (seat.status === 'free') {
      inspect(null);
      dispatch(toggleSeat(seat.id));
      return;
    }
    dispatch(clearSeatSelection());
    inspect(seat);
  };

  return (
    <View style={[styles.wrap, { width: cardW }]}>
      <View style={[styles.card, { height: CARD_MIN_H }]}>
        <View style={[styles.mapCol, { width: mapColW }]}>
          <View style={[styles.svgHost, { height: mapSvgH }]}>
            <View
              style={[
                styles.svgScaler,
                {
                  transform: [{ scale }],
                  width: mapSvgW,
                  height: mapSvgH,
                },
              ]}
            >
              <Svg
                width={mapSvgW}
                height={mapSvgH}
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
                {soloZone ? (
                  <>
                    <SvgText
                      x={MAP_CENTER_X}
                      y={22}
                      fill={colors.warning}
                      fontSize={11}
                      fontWeight="700"
                      textAnchor="middle"
                    >
                      {soloZone.name}
                    </SvgText>
                    <SvgText
                      x={MAP_CENTER_X}
                      y={34}
                      fill="#8a8a8a"
                      fontSize={7}
                      textAnchor="middle"
                    >
                      {zoneSubtitle(soloZone.specs)}
                    </SvgText>
                  </>
                ) : null}
                {seats.map((seat) => {
                  const room = capsuleRoomForSeat(seat);
                  const busy = seat.status === 'reserved' || seat.status === 'occupied';
                  const highlighted = inspectedSeatId === seat.id;
                  return (
                    <Rect
                      key={`room-${seat.id}`}
                      x={room.x}
                      y={room.y}
                      width={room.w}
                      height={room.h}
                      rx={10}
                      fill={busy ? CAPSULE_ROOM_FILL_BUSY : CAPSULE_ROOM_FILL}
                      stroke={
                        highlighted
                          ? colors.accentBright
                          : busy
                            ? CAPSULE_ROOM_STROKE_BUSY
                            : CAPSULE_ROOM_STROKE
                      }
                      strokeWidth={highlighted ? 2 : 1.5}
                      onPress={() => onSeatPress(seat)}
                    />
                  );
                })}
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
                      rx={8}
                      fill={c.fill}
                      stroke={c.stroke}
                      strokeWidth={selected || inspectedSeatId === seat.id ? 2.5 : 1.5}
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
                      fontSize={13}
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
        </View>
        <View style={[styles.configCol, { width: configW }]}>
          {showBookedPanel ? (
            <BookedSeatPanel seat={inspectedSeat} embedded />
          ) : (
            <CapsuleConfigPanel zone={soloZone} embedded />
          )}
        </View>
      </View>

      <View style={styles.controls}>
        <Pressable style={styles.ctrl} onPress={() => setScale((s) => Math.max(0.75, s - 0.1))}>
          <Text style={styles.ctrlText}>−</Text>
        </Pressable>
        <Pressable style={styles.ctrl} onPress={() => setScale(1)}>
          <Text style={styles.ctrlText}>⊙</Text>
        </Pressable>
        <Pressable style={styles.ctrl} onPress={() => setScale((s) => Math.min(1.35, s + 0.1))}>
          <Text style={styles.ctrlText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    gap: spacing.xs,
    paddingHorizontal: MAP_SCREEN_INSET,
  },
  card: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: colors.bgMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  mapCol: {
    flexShrink: 0,
    padding: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  svgHost: {
    width: '100%',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  svgScaler: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  configCol: {
    flexShrink: 0,
    alignSelf: 'stretch',
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    width: '100%',
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
});
