'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCsrfToken, login } from '../../lib/api-client';

function validReturnTo(value: string | null): value is string {
  return value !== null && value.startsWith('/') && !value.startsWith('//');
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const csrfToken = await getCsrfToken();
      await login({ email, password, rememberMe }, csrfToken);
      const fallback = '/app/events';
      const returnTo = searchParams.get('returnTo');
      router.replace(validReturnTo(returnTo) ? returnTo : fallback);
      router.refresh();
    } catch {
      setError('Email hoặc mật khẩu không đúng.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return <form className="space-y-5" onSubmit={submit} noValidate>
    <label className="block text-sm font-medium text-slate-700" htmlFor="email">Email
      <input id="email" type="email" autoComplete="email" required suppressHydrationWarning value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
    </label>
    <label className="block text-sm font-medium text-slate-700" htmlFor="password">Mật khẩu
      <input id="password" type="password" autoComplete="current-password" required suppressHydrationWarning value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
    </label>
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600" htmlFor="remember-me"><input id="remember-me" type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /> Ghi nhớ đăng nhập</label>
    {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p> : null}
    <button type="submit" disabled={isSubmitting} className="w-full rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-70">{isSubmitting ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
  </form>;
}
