import { useEffect, useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
};

const PAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

export function StaffPinPad({ open, onClose }: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setPin('');
      setError(false);
      setShake(false);
    }
  }, [open]);

  if (!open) return null;

  const press = (k: string) => {
    if (loading) return;
    if (k === 'C') { setPin(''); setError(false); return; }
    if (k === '⌫') { setPin((p) => p.slice(0, -1)); setError(false); return; }
    if (pin.length >= 8) return;
    const next = pin + k;
    setPin(next);
    setError(false);
  };

  const submit = async () => {
    if (!pin || loading) return;
    setLoading(true);
    const ok = await window.stopkekKiosk?.verifyStaffPassword(pin);
    setLoading(false);
    if (ok) {
      window.stopkekKiosk?.confirmStaffQuit();
    } else {
      setError(true);
      setShake(true);
      setPin('');
      setTimeout(() => setShake(false), 500);
    }
  };

  const dismiss = () => {
    window.stopkekKiosk?.dismissStaffQuit();
    onClose();
  };

  const dots = 8;

  return (
    <div className="pinpad-backdrop" onClick={dismiss}>
      <div
        className={`pinpad${shake ? ' pinpad-shake' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="pinpad-title">Выход для персонала</div>
        <div className="pinpad-sub">Введите PIN-код</div>

        <div className={`pinpad-dots${error ? ' pinpad-dots-error' : ''}`}>
          {Array.from({ length: dots }).map((_, i) => (
            <span
              key={i}
              className={`pinpad-dot${i < pin.length ? ' pinpad-dot-filled' : ''}`}
            />
          ))}
        </div>

        {error && <p className="pinpad-error-msg">Неверный PIN</p>}

        <div className="pinpad-grid">
          {PAD.map((k) => (
            <button
              key={k}
              type="button"
              className={`pinpad-key${k === 'C' ? ' pinpad-key-clear' : ''}${k === '⌫' ? ' pinpad-key-back' : ''}`}
              onClick={() => press(k)}
              disabled={loading}
            >
              {k}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="pinpad-submit"
          onClick={() => void submit()}
          disabled={pin.length === 0 || loading}
        >
          {loading ? '…' : 'Подтвердить'}
        </button>
        <button type="button" className="pinpad-cancel" onClick={dismiss}>
          Отмена
        </button>
      </div>
    </div>
  );
}
