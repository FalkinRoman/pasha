import { useCallback, useEffect, useRef, useState } from 'react';
import { endSeatSession, fetchState, KioskConfig, KioskState } from './api';
import { QrPanel } from './QrPanel';
import { SessionHeader } from './SessionHeader';
import { StaffPinPad } from './StaffPinPad';

const WARN_THRESHOLDS = [
  { ms: 10 * 60_000, message: 'Осталось 10 минут',  urgent: false },
  { ms: 5 * 60_000,  message: 'Осталось 5 минут',   urgent: false },
  { ms: 60_000,      message: 'Осталось 1 минута!',  urgent: true  },
] as const;

function formatMs(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function isHeaderMode(state: KioskState | null, remaining: number) {
  return state?.state === 'active' && remaining > 0;
}

export function App() {
  const [cfg, setCfg] = useState<KioskConfig | null>(null);
  const [state, setState] = useState<KioskState | null>(null);
  const [displayMode, setDisplayMode] = useState<'overlay' | 'header'>('overlay');
  const [error, setError] = useState('');
  const [ending, setEnding] = useState(false);
  const [staffQuitOpen, setStaffQuitOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; urgent: boolean } | null>(null);
  const loadedAt = useRef(0);
  const remainBase = useRef(0);
  const [tick, setTick] = useState(0);
  const shownWarnings = useRef(new Set<number>());
  const lastSessionId = useRef<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expiredSentRef = useRef(false);

  useEffect(() => {
    window.stopkekKiosk?.onConfig((c) => setCfg(c));
    window.stopkekKiosk?.onDisplayMode((m) => {
      if (m === 'header' || m === 'overlay') setDisplayMode(m);
    });
    window.stopkekKiosk?.onStaffQuitRequest(() => setStaffQuitOpen(true));
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
    const ms = state?.state === 'locked' ? 3000 : 5000;
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

  useEffect(() => {
    if (staffQuitOpen) return;
    const mode = isHeaderMode(state, remaining) ? 'header' : 'overlay';
    setDisplayMode(mode);
    void window.stopkekKiosk?.setDisplayMode(mode);
  }, [state, remaining, tick, staffQuitOpen]);

  useEffect(() => {
    if (state?.state !== 'active' || !state.session) return;

    if (lastSessionId.current !== state.session.id) {
      lastSessionId.current = state.session.id;
      shownWarnings.current.clear();
      expiredSentRef.current = false;
      setToast(null);
    }

    if (remaining <= 0) {
      if (!expiredSentRef.current) {
        expiredSentRef.current = true;
        window.stopkekKiosk?.sessionExpired();
      }
      return;
    }

    for (const { ms, message, urgent } of WARN_THRESHOLDS) {
      if (remaining <= ms && !shownWarnings.current.has(ms)) {
        shownWarnings.current.add(ms);
        setToast({ message, urgent });
        void window.stopkekKiosk?.showHeader();
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToast(null), 8000);
        break;
      }
    }
  }, [remaining, tick, state]);

  const handleEndSession = async () => {
    if (!cfg || ending) return;
    if (!confirm('Завершить сеанс на этом ПК? Оставшееся время может вернуться на баланс.')) {
      return;
    }
    setEnding(true);
    try {
      const s = await endSeatSession(cfg);
      setState(s);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось завершить сеанс');
    } finally {
      setEnding(false);
    }
  };

  const closeStaffQuit = () => {
    setStaffQuitOpen(false);
  };

  if (staffQuitOpen) {
    return <StaffPinPad open onClose={closeStaffQuit} />;
  }

  if (!cfg) {
    return (
      <div className="app overlay-mode">
        <div className="logo">STOPKEK</div>
        <p className="seat-badge">Нет config.json</p>
      </div>
    );
  }

  const seatNum = cfg.seatNumber;

  if (state?.state === 'expired' || (state?.state === 'active' && remaining <= 0)) {
    return (
      <div className="block-overlay overlay-mode">
        <div className="logo">STOPKEK</div>
        <h2>Время вышло</h2>
        <p style={{ color: 'var(--muted)', maxWidth: 420, textAlign: 'center' }}>
          Продлите сеанс в приложении stopkek или обратитесь к администратору.
        </p>
        <p className="footer-hint">ПК #{seatNum}</p>
      </div>
    );
  }

  if (state?.state === 'active' && state.session && remaining > 0) {
    return (
      <div className="app header-mode">
        <SessionHeader
          cfg={cfg}
          session={state.session}
          remainingMs={remaining}
          notice={state.notice}
          ending={ending}
          onEndSession={() => void handleEndSession()}
          formatMs={formatMs}
          toast={toast}
        />
        {error && <p className="header-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="app overlay-mode">
      <button
        type="button"
        className="overlay-staff-btn"
        onClick={() => setStaffQuitOpen(true)}
        title="Персонал"
      >
        ×
      </button>
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
