'use client';

import Link from 'next/link';
import { useAuthenticatedUser } from '../../../components/authenticated-app';
import { NotificationSettings } from '../../../components/notifications/notification-settings';
import { initials } from '../../../lib/event-ui';

export default function ProfilePage() {
  const { user } = useAuthenticatedUser();
  return <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
    <p className="text-sm font-semibold text-indigo-700">CÁ NHÂN</p>
    <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Hồ sơ của tôi</h1>
    <article className="mt-7 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <span aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-indigo-100 text-lg font-bold text-indigo-700">{initials(user.displayName, user.email)}</span>
      <div className="min-w-0"><h2 className="truncate text-lg font-semibold text-slate-950">{user.displayName || 'Chưa đặt tên hiển thị'}</h2><p className="truncate text-sm text-slate-600">{user.email}</p><p className="mt-1 text-xs text-slate-500">Tài khoản {user.status === 'ACTIVE' ? 'đang hoạt động' : user.status.toLowerCase()}</p></div>
    </article>
    <NotificationSettings />
    <Link href="/system-status" className="mt-5 inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100">Trạng thái hệ thống</Link>
  </section>;
}
