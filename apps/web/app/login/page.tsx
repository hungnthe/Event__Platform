import { Suspense } from 'react';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#e8f0ff,_#f8fafc_45%,_#eef7ff)] px-4 py-8 sm:px-8 lg:flex lg:items-center lg:justify-center">
    <section className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-blue-950/10 sm:p-9">
      <div className="mb-7 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-lg font-bold text-white">E</span><div><h1 className="text-xl font-semibold text-slate-950">Đăng nhập EventFlow</h1><p className="text-sm text-slate-500">Tiếp tục quản lý sự kiện của bạn.</p></div></div>
      <Suspense fallback={<p className="text-sm text-slate-500">Đang tải biểu mẫu…</p>}><LoginForm /></Suspense>
    </section>
  </main>;
}
