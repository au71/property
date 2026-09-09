import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { apiFetch, ApiError } from '../api/client';
import type { AuthResult, CurrentUser } from '../api/types';
import { clearSession, getAccessToken, saveSession } from './store';

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await apiFetch<CurrentUser>('/auth/me', { authenticated: true }));
    } catch (err) {
      // Only a rejected session clears state; a network blip must not sign the
      // user out on a train.
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        await clearSession();
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const signIn = useCallback(
    async (identifier: string, password: string) => {
      const result = await apiFetch<AuthResult>('/auth/login', {
        method: 'POST',
        body: { identifier, password },
      });
      if (!result.accessToken) throw new Error('The server did not return a session');
      await saveSession(result.accessToken, result.refreshToken);
      await load();
    },
    [load],
  );

  const signOut = useCallback(async () => {
    await apiFetch('/auth/logout', { method: 'POST', authenticated: true }).catch(() => undefined);
    await clearSession();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signOut, refresh: load }),
    [user, loading, signIn, signOut, load],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
