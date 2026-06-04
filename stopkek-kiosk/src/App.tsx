import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchState, KioskConfig, KioskState } from './api';
import { QrPanel } from './QrPanel';

function formatMs(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function App() {
  const [cfg, setCfg] = useState<KioskConfig | null>(null);
  const [state, setState] = useState<KioskState | null>(null);
  const [error, setError] = useState('');
  const loadedAt = useRef(0);
  const remainBase = useRef(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    window.stopkekKiosk?.onConfig((c) => setCfg(c));
    if (!window.stopkekKiosk) {
      setCfg({
        apiUrl: 'https://stopkek.site/api',
        seatNumber: 1,
        kioskKey: 'stopkek-kiosk-prod-2026',
      });
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!cfg) return;
    try {
      const s = await fetchState(cfg);
      setState(s);
      if (s.state === 'active' && s.session) {
        loadedAt.current = Date.now();
        remainBase.current = s.session.displayRemainingMs;
      }
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Нет связи с сервером');
    }
  }, [cfg]);

  useEffect(() => {
    if (!cfg) return;
    refresh();
    const ms = state?.state === 'locked' ? 3000 : 8000;
    const id = setInterval(refresh, ms);
    return () => clearInterval(id);
  }, [cfg, refresh, state?.state]);

  useEffect(() => {
    if (state?.state !== 'active') return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [state?.state]);

  const remaining =
    state?.state === 'active'
      ? Math.max(0, remainBase.current - (Date.now() - loadedAt.current))
      : 0;

  if (!cfg) {
    return (
      <div className="app">
        <div className="logo">STOPKEK</div>
        <p className="seat-badge">Нет config.json</p>
      </div>
    );
  }

  const seatNum = cfg.seatNumber;

  if (state?.state === 'expired' || (state?.state === 'active' && remaining <= 0)) {
    return (
      <div className="block-overlay">
        <div className="logo">STOPKEK</div>
        <h2>Время вышло</h2>
        <p style={{ color: 'var(--muted)', maxWidth: 420, textAlign: 'center' }}>
          Продлите сеанс в приложении stopkek или обратитесь к администратору.
        </p>
        <p className="footer-hint">ПК #{seatNum}</p>
      </div>
    );
  }

  if (state?.state === 'active' && state.session) {
    const s = state.session;
    const warn = remaining < 15 * 60_000;
    return (
      <div className="app">
        <div className="logo">STOPKEK</div>
        <p className="seat-badge">ПК #{seatNum} · {s.zoneName}</p>
        <div className="card" style={{ width: 'min(640px, 100%)' }}>
          <p style={{ color: 'var(--muted)' }}>{s.userName} · {s.phoneMask}</p>
          <div className={`timer ${warn ? 'warn' : ''}`}>{formatMs(remaining)}</div>
          <p style={{ color: 'var(--muted)' }}>{s.timerLabel}</p>
          <div className="stats">
            <div className="stat">
              <label>Баланс</label>
              <strong>{s.balanceRub} ₽</strong>
            </div>
            <div className="stat">
              <label>Место</label>
              <strong>#{s.seatNumbers[0] ?? seatNum}</strong>
            </div>
          </div>
          {state.notice && <div className="notice">{state.notice}</div>}
          <p style={{ marginTop: 24, color: 'var(--muted)', fontSize: 14 }}>
            Продление и пополнение — в мобильном приложении stopkek
          </p>
        </div>
        <p className="footer-hint">Экран блокируется после окончания оплаченного времени</p>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="logo">STOPKEK</div>
      <p className="seat-badge">ПК #{seatNum}</p>
      <div className="card card-wide">
        <h1>Оплатите в приложении</h1>
        <p>Забронируйте место #{seatNum}, оплатите сеанс — затем отсканируйте QR ниже.</p>
        {state?.qrPayload ? (
          <QrPanel payload={state.qrPayload} seatNumber={seatNum} />
        ) : (
          <p className="error">Ожидание QR…</p>
        )}
        {error && <p className="error">{error}</p>}
      </div>
      <p className="footer-hint">QR обновляется каждые 2 мин · вход только через приложение</p>
    </div>
  );
}
