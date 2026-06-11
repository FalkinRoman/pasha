import { API_URL } from '../config/api';
import {
  loadStoredRefreshToken,
  saveTokens,
} from '../storage/authStorage';

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
  }
}

async function rawFetch(path: string, init: RequestInit, auth: boolean) {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
}

let refreshPromise: Promise<boolean> | null = null;

/** Обновление access по refresh-токену; параллельные 401 ждут один refresh */
async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const refreshToken = await loadStoredRefreshToken();
      if (!refreshToken) return false;
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as {
        accessToken?: string;
        refreshToken?: string;
      };
      if (!data.accessToken) return false;
      accessToken = data.accessToken;
      await saveTokens(data.accessToken, data.refreshToken ?? refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const { auth = false, headers, ...rest } = options;
  let res = await rawFetch(path, { ...rest, headers }, auth);

  if (res.status === 401 && auth && !path.startsWith('/auth/')) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await rawFetch(path, { ...rest, headers }, auth);
    }
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const msg =
      typeof data === 'object' && data && 'message' in data
        ? String((data as { message: string | string[] }).message)
        : res.statusText;
    throw new ApiError(Array.isArray(msg) ? msg[0] : msg, res.status, data);
  }

  return data as T;
}
