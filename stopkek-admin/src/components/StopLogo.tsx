import './StopLogo.css';

type Props = { size?: number };

export function StopLogo({ size = 80 }: Props) {
  return (
    <img
      src="/logo-stopkek.png"
      alt="стопкек"
      className="stop-logo-img"
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
}
