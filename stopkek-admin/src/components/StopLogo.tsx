import './StopLogo.css';

type Props = { size?: number };

export function StopLogo({ size = 80 }: Props) {
  const half = size / 2;
  const compact = size < 56;
  const points = Array.from({ length: 8 }, (_, i) => {
    const angle = (Math.PI / 4) * i - Math.PI / 8;
    const r = half - 4;
    return `${half + r * Math.cos(angle)},${half + r * Math.sin(angle)}`;
  }).join(' ');

  const stopSize = compact ? size * 0.2 : size * 0.22;
  const kekSize = compact ? size * 0.16 : size * 0.18;

  return (
    <div className="stop-logo" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden>
        <polygon points={points} fill="#c41e24" stroke="#fff" strokeWidth={2} />
      </svg>
      <div className="stop-logo-label" style={{ width: size, height: size }}>
        <span
          className="stop-logo-stop"
          style={{ fontSize: stopSize, lineHeight: `${stopSize}px` }}
        >
          STOP
        </span>
        <span
          className="stop-logo-kek"
          style={{
            fontSize: kekSize,
            lineHeight: `${kekSize}px`,
            marginTop: compact ? -2 : -4,
          }}
        >
          KEK
        </span>
      </div>
    </div>
  );
}
