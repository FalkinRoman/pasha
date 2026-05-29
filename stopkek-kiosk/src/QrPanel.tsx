import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

type Props = {
  payload: string;
  seatNumber: number;
};

export function QrPanel({ payload, seatNumber }: Props) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(payload, {
      width: 280,
      margin: 2,
      color: { dark: '#ffffff', light: '#141414' },
    }).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  return (
    <div className="qr-wrap">
      {src ? (
        <img src={src} alt="QR для входа" className="qr-img" />
      ) : (
        <div className="qr-placeholder">QR…</div>
      )}
      <p className="qr-hint">
        Откройте stopkek на телефоне → сеанс → «Сканировать QR на мониторе»
      </p>
      <p className="qr-seat">ПК #{seatNumber}</p>
    </div>
  );
}
