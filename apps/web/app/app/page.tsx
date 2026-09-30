'use client';

import Link from 'next/link';
import { useAuthenticatedUser } from '../../components/authenticated-app';

export default function AppHomePage() {
  const { user } = useAuthenticatedUser();
  const name = user.displayName || user.email;
  return <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
    <p className="text-sm font-semibold text-indigo-700">EVENTFLOW</p>
    <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Chào {name}</h1>
    <p className="mt-3 max-w-2xl text-slate-600">Theo dõi các sự kiện bạn tham gia và công việc được giao trong một không gian chung.</p>
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      <Link href="/app/events" className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-indigo-200 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-indigo-100"><span className="text-sm font-semibold text-indigo-700">Sự kiện</span><h2 className="mt-2 text-xl font-semibold text-slate-950">Sự kiện của tôi</h2><p className="mt-2 text-sm leading-6 text-slate-600">Xem tiến độ công việc cá nhân trong từng sự kiện.</p><span className="mt-5 inline-block text-sm font-medium text-indigo-700">Mở danh sách →</span></Link>
      <Link href="/app/tasks" className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-indigo-200 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-indigo-100"><span className="text-sm font-semibold text-indigo-700">Công việc</span><h2 className="mt-2 text-xl font-semibold text-slate-950">Công việc của tôi</h2><p className="mt-2 text-sm leading-6 text-slate-600">Ưu tiên các đầu việc đang đến hạn trên mọi sự kiện.</p><span className="mt-5 inline-block text-sm font-medium text-indigo-700">Mở công việc →</span></Link>
    </div>
  </section>;
}
