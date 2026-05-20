import { SEAT_STATUS } from '../lib/statusLabels';
import './FloorMapPreview.css';

const MAP_W = 234;
const MAP_H = 170;
const INNER_PAD = 12;

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

const SEAT_COLORS: Record<
  string,
  { fill: string; stroke: string; text: string }
> = {
  free: { fill: '#2e7d32', stroke: '#3d8b40', text: '#fff' },
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
      <div className="floor-map-box">
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
          {zones.map((z) => (
            <g key={z.id}>
              <text
                x={z.labelX}
                y={z.labelY - 5}
                fill="#8a8a8a"
                fontSize={8}
                fontWeight={600}
              >
                {z.name}
              </text>
              {z.specs ? (
                <text x={z.labelX} y={z.labelY + 5} fill="#5c5c5c" fontSize={7}>
                  {z.specs}
                </text>
              ) : null}
            </g>
          ))}
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
                  rx={6}
                  fill={c.fill}
                  stroke={c.stroke}
                  strokeWidth={1}
                >
                  <title>{title}</title>
                </rect>
                <text
                  x={seat.x + seat.w / 2}
                  y={seat.y + seat.h / 2 + 4}
                  fill={c.text}
                  fontSize={11}
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
    </div>
  );
}
