export type KioskConfig = {
  apiUrl: string;
  seatNumber: number;
  kioskKey: string;
  staffPassword?: string;
};

export type KioskState =
  | {
      state: 'locked';
      seatNumber: number;
      seatStatus?: string;
      qrPayload?: string;
      qrRefreshSec?: number;
    }
  | {
      state: 'active';
      seatNumber: number;
      session: SessionView;
      notice?: string;
    }
  | { state: 'expired'; seatNumber: number; session: SessionView };

export type SessionView = {
  id: string;
  userName: string;
  phoneMask: string;
  balanceRub: number;
  displayRemainingMs: number;
  timerLabel: string;
  zoneName: string;
  seatNumbers: number[];
  gameRunning: boolean;
};

async function kioskFetch<T>(
  cfg: KioskConfig,
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${cfg.apiUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Kiosk-Key': cfg.kioskKey,
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.message === 'string'
        ? data.message
        : Array.isArray(data.message)
          ? data.message[0]
          : 'Ошибка сервера'
    );
  }
  return data as T;
}

export function fetchState(cfg: KioskConfig) {
  return kioskFetch<KioskState>(
    cfg,
    `/kiosk/state?seatNumber=${cfg.seatNumber}`
  );
}

export function unlockPc(cfg: KioskConfig, code: string) {
  return kioskFetch<KioskState>(cfg, '/kiosk/unlock', {
    method: 'POST',
    body: JSON.stringify({ seatNumber: cfg.seatNumber, code }),
  });
}

export function endSeatSession(cfg: KioskConfig) {
  return kioskFetch<KioskState>(cfg, '/kiosk/end-session', {
    method: 'POST',
    body: JSON.stringify({ seatNumber: cfg.seatNumber }),
  });
}
