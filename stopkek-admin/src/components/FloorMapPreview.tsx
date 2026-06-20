import { SEAT_STATUS } from '../lib/statusLabels';
import {
  capsuleRoomForSeat,
  MAP_CENTER_X,
  MAP_H,
  MAP_W,
  SOLO_CONFIG_LINES,
  zoneSubtitle,
} from '../constants/floorLayout';
import './FloorMapPreview.css';

const INNER_PAD = 12;
const CAPSULE_ROOM_FILL = 'rgba(76, 175, 80, 0.14)';
const CAPSULE_ROOM_STROKE = '#4caf50';

export type FloorMapSeat = {
  id: string;
  number: number;
  zoneId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  status: string;
};

export type FloorMapZone = {
  id: string;
  name: string;
  specs: string;
  labelX: number;
  labelY: number;
};

const SEAT_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  free: { fill: '#3d9e40', stroke: '#66bb6a', text: '#fff' },
  occupied: { fill: '#5c2020', stroke: '#c62828', text: '#888' },
  reserved: { fill: '#5c4a00', stroke: '#f9a825', text: '#fff' },
  repair: { fill: '#2a2a2a', stroke: '#424242', text: '#555' },
};

const LEGEND: { status: string; label: string }[] = [
  { status: 'free', label: 'Свободно' },
  { status: 'occupied', label: 'Занято' },
  { status: 'reserved', label: 'Бронь' },
  { status: 'repair', label: 'Ремонт' },
];

type Props = {
  seats: FloorMapSeat[];
  zones: FloorMapZone[];
};

export function FloorMapPreview({ seats, zones }: Props) {
  const soloZone = zones[0];

  return (
    <div className="floor-map-preview">
      <div className="floor-map-legend">
        {LEGEND.map(({ status, label }) => (
          <span key={status} className="floor-map-legend-item">
            <span
              className="floor-map-dot"
              style={{ background: SEAT_COLORS[status]?.fill ?? '#333' }}
            />
            {label}
          </span>
        ))}
      </div>
      <div className="floor-map-card">
        <div className="floor-map-map-col">
          <svg
            viewBox={`0 0 ${MAP_W} ${MAP_H}`}
            className="floor-map-svg"
            role="img"
            aria-label="Схема зала"
          >
            <rect
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
              <g>
                <text
                  x={MAP_CENTER_X}
                  y={22}
                  fill="#f9a825"
                  fontSize={11}
                  fontWeight={700}
                  textAnchor="middle"
                >
                  {soloZone.name}
                </text>
                <text
                  x={MAP_CENTER_X}
                  y={34}
                  fill="#8a8a8a"
                  fontSize={7}
                  textAnchor="middle"
                >
                  {zoneSubtitle(soloZone.specs)}
                </text>
              </g>
            ) : null}
            {seats.map((seat) => {
              const room = capsuleRoomForSeat(seat);
              return (
                <rect
                  key={`room-${seat.id}`}
                  x={room.x}
                  y={room.y}
                  width={room.w}
                  height={room.h}
                  rx={10}
                  fill={CAPSULE_ROOM_FILL}
                  stroke={CAPSULE_ROOM_STROKE}
                  strokeWidth={1.5}
                />
              );
            })}
            {seats.map((seat) => {
              const c = SEAT_COLORS[seat.status] ?? SEAT_COLORS.repair;
              const title = `#${seat.number} — ${SEAT_STATUS[seat.status] ?? seat.status}`;
              return (
                <g key={seat.id}>
                  <rect
                    x={seat.x}
                    y={seat.y}
                    width={seat.w}
                    height={seat.h}
                    rx={8}
                    fill={c.fill}
                    stroke={c.stroke}
                    strokeWidth={1.5}
                  >
                    <title>{title}</title>
                  </rect>
                  <text
                    x={seat.x + seat.w / 2}
                    y={seat.y + seat.h / 2 + 4}
                    fill={c.text}
                    fontSize={13}
                    fontWeight={700}
                    textAnchor="middle"
                  >
                    <title>{title}</title>
                    {seat.number}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <aside className="floor-map-config-col">
          <ul className="floor-map-config-list">
            {SOLO_CONFIG_LINES.map((line) => (
              <li key={line.label}>
                <span className="floor-map-config-label">{line.label}</span>
                <span className="floor-map-config-value">{line.value}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
