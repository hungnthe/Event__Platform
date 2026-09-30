'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { logout } from '../lib/api-client';
import { errorMessage, initials } from '../lib/event-ui';
import { useAuthenticatedUser } from './authenticated-app';
import { NotificationBell } from './notifications/notification-bell';

interface NavigationItem {
  href: string;
  label: string;
  glyph: string;
}

const primaryItems: NavigationItem[] = [
  { href: '/app', label: 'Trang chủ', glyph: '⌂' },
  { href: '/app/events', label: 'Sự kiện của tôi', glyph: '◫' },
  { href: '/app/calendar', label: 'Lịch', glyph: '▦' },
  { href: '/app/tasks', label: 'Công việc của tôi', glyph: '✓' },
];

const mobileItems: NavigationItem[] = [
  { href: '/app', label: 'Trang chủ', glyph: '⌂' },
  { href: '/app/events', label: 'Sự kiện', glyph: '◫' },
  { href: '/app/calendar', label: 'Lịch', glyph: '▦' },
  { href: '/app/tasks', label: 'Công việc', glyph: '✓' },
  { href: '/app/profile', label: 'Cá nhân', glyph: '◉' },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/app') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationLink({ item, compact = false }: Readonly<{ item: NavigationItem; compact?: boolean }>) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  return <Link href={item.href} aria-current={active ? 'page' : undefined} className={compact ? `flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active ? 'text-indigo-700' : 'text-slate-500'}` : `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition focus:outline-none focus:ring-4 focus:ring-indigo-100 ${active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}>
    <span aria-hidden="true" className={compact ? 'text-base leading-none' : 'text-lg leading-none'}>{item.glyph}</span><span>{item.label}</span>
  </Link>;
}

function LogoutButton({ mobile = false }: Readonly<{ mobile?: boolean }>) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      await logout();
      router.replace('/login');
      router.refresh();
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  return <div className={mobile ? 'px-2' : ''}>
    <button type="button" disabled={pending} onClick={() => void signOut()} className={mobile ? 'min-h-11 rounded-lg px-3 text-sm font-medium text-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-60' : 'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-60'}>
      <span aria-hidden="true">↪</span>{pending ? 'Đang đăng xuất…' : 'Đăng xuất'}
    </button>
    {error ? <p role="alert" className="px-3 text-xs text-red-700">{error}</p> : null}
  </div>;
}

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const { user } = useAuthenticatedUser();
  return <div className="min-h-screen bg-slate-50 text-slate-950">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 bg-white px-3 py-5 lg:flex">
      <div className="flex items-center justify-between gap-1"><Link href="/app" className="flex min-h-11 min-w-0 items-center gap-3 rounded-xl px-3 text-base font-bold tracking-tight text-slate-950 focus:outline-none focus:ring-4 focus:ring-indigo-100"><span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-600 text-sm text-white">E</span><span className="truncate">EventFlow</span></Link><NotificationBell /></div>
      <nav aria-label="Điều hướng chính" className="mt-8 space-y-1">{primaryItems.map((item) => <NavigationLink key={item.href} item={item} />)}</nav>
      <div className="mt-auto border-t border-slate-200 pt-3">
        <Link href="/app/profile" className="mb-2 flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-indigo-100"><span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 font-semibold text-slate-700">{initials(user.displayName, user.email)}</span><span className="min-w-0"><span className="block truncate font-medium text-slate-900">{user.displayName || user.email}</span><span className="block truncate text-xs">Hồ sơ</span></span></Link>
        <LogoutButton />
      </div>
    </aside>
    <header className="sticky top-0 z-20 flex min-h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
      <Link href="/app" className="flex items-center gap-2 font-bold text-slate-950 focus:outline-none focus:ring-4 focus:ring-indigo-100"><span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-600 text-xs text-white">E</span>EventFlow</Link>
      <div className="flex items-center gap-1"><NotificationBell /><LogoutButton mobile /></div>
    </header>
    <main className="min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:ml-60 lg:pb-8">{children}</main>
    <nav aria-label="Điều hướng di động" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">{mobileItems.map((item) => <NavigationLink key={item.href} item={item} compact />)}</nav>
  </div>;
}
