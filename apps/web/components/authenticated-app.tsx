'use client';

import type { AuthUser } from '@eventflow/contracts';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ApiRequestError, getCurrentUser } from '../lib/api-client';

interface AuthContextValue {
  user: AuthUser;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthenticatedApp({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const refreshUser = useCallback(async () => {
    const nextUser = await getCurrentUser();
    setUser(nextUser);
  }, []);

  useEffect(() => {
    let active = true;
    void getCurrentUser().then((nextUser) => {
      if (active) setUser(nextUser);
    }).catch((reason: unknown) => {
      if (!active) return;
      if (reason instanceof ApiRequestError && reason.status === 401) {
        const returnTo = encodeURIComponent(pathname || '/app/events');
        router.replace(`/login?returnTo=${returnTo}`);
        return;
      }
      setError(reason instanceof Error ? reason.message : 'Không thể kiểm tra phiên đăng nhập.');
    });
    return () => { active = false; };
  }, [attempt, pathname, router]);

  if (error) {
    return <main className="grid min-h-screen place-items-center bg-slate-50 px-5">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm" aria-live="polite">
        <h1 className="text-lg font-semibold text-slate-950">Không thể mở không gian làm việc</h1>
        <p className="mt-2 text-sm text-slate-600">{error}</p>
        <button type="button" className="mt-5 min-h-11 rounded-xl bg-indigo-600 px-4 py-2 font-medium text-white focus:outline-none focus:ring-4 focus:ring-indigo-200" onClick={() => { setError(null); setAttempt((value) => value + 1); }}>Thử lại</button>
      </section>
    </main>;
  }

  if (!user) return <main className="grid min-h-screen place-items-center bg-slate-50"><p role="status" className="text-sm text-slate-600">Đang kiểm tra phiên đăng nhập…</p></main>;

  return <AuthContext.Provider value={{ user, refreshUser }}>{children}</AuthContext.Provider>;
}

export function useAuthenticatedUser(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthenticatedApp is required.');
  return context;
}
