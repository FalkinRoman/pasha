import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { AdminUser, fetchMe, login as apiLogin } from '../api/admin';
import { getToken, setToken } from '../api/client';

type AuthCtx = {
  admin: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrate = useCallback(async () => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    try {
      setAdmin(await fetchMe());
    } catch {
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const login = async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    setToken(res.accessToken);
    setAdmin(res.admin);
  };

  const logout = () => {
    setToken(null);
    setAdmin(null);
  };

  return (
    <Ctx.Provider value={{ admin, loading, login, logout }}>{children}</Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}
