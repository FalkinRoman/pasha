import { KioskConfig, SessionView } from './api';

type Toast = { message: string; urgent: boolean };

type Props = {
  cfg: KioskConfig;
  session: SessionView;
  remainingMs: number;
  notice?: string;
  ending: boolean;
  onEndSession: () => void;
  formatMs: (ms: number) => string;
  toast?: Toast | null;
};

export function SessionHeader({
  cfg,
  session,
  remainingMs,
  notice,
  ending,
  onEndSession,
  formatMs,
  toast,
}: Props) {
  const warn = remainingMs < 15 * 60_000;
  const seat = session.seatNumbers[0] ?? cfg.seatNumber;

  return (
    <header className="session-header">
      {toast && (
        <div className={`session-header-toast${toast.urgent ? ' urgent' : ''}`}>
          {toast.message}
        </div>
      )}
      <div className="session-header-brand">
        <span className="session-header-logo">STOPKEK</span>
        <span className="session-header-meta">
          ПК #{seat} · {session.zoneName}
        </span>
      </div>
      <div className="session-header-user">
        {session.userName} · {session.phoneMask}
      </div>
      <div className={`session-header-timer ${warn ? 'warn' : ''}`}>
        <span className="session-header-time">{formatMs(remainingMs)}</span>
        <span className="session-header-label">{session.timerLabel}</span>
      </div>
      <div className="session-header-stat">
        <span className="session-header-stat-label">Баланс</span>
        <strong>{session.balanceRub} ₽</strong>
      </div>
      <div className="session-header-stat">
        <span className="session-header-stat-label">Место</span>
        <strong>#{seat}</strong>
      </div>
      {notice && <div className="session-header-notice">{notice}</div>}
      <p className="session-header-hint">Пополнение — в приложении stopkek</p>
      <button
        type="button"
        className="btn btn-end"
        disabled={ending}
        onClick={onEndSession}
      >
        {ending ? 'Завершение…' : 'Завершить сеанс'}
      </button>
    </header>
  );
}
