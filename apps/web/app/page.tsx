import Link from 'next/link';

export const dynamic = 'force-dynamic';

const features = [
  ['01', 'Workflow 10 bước', 'Brief, concept, team, task, tiến độ, ngân sách, tài liệu, sẵn sàng, ngày diễn ra và tổng kết.'],
  ['02', 'Readiness Check', 'Điểm sẵn sàng theo trọng số, cùng cảnh báo rủi ro ngay tại một nơi.'],
  ['03', 'Phân quyền rõ ràng', 'Vai trò từ quản lý đến nhân sự được tổ chức minh bạch và chặt chẽ.'],
];

export default function HomePage() {
  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#e8f0ff,_#f8fafc_45%,_#eef7ff)] px-4 py-8 sm:px-8 lg:flex lg:items-center lg:justify-center">
    <div className="grid w-full max-w-6xl items-center gap-10 py-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
      <section className="hidden lg:block">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm"><span className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-600 text-xs font-bold text-white">E</span>EventFlow — Nền tảng quản lý sự kiện</div>
        <h1 className="mt-7 text-5xl font-semibold tracking-tight text-slate-950">Quản lý sự kiện,<br /><span className="text-blue-700">từ ý tưởng đến ngày diễn ra.</span></h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">10 giai đoạn chuẩn bị, kiểm soát độ sẵn sàng và phân quyền rõ ràng — tất cả trong một không gian làm việc chuyên nghiệp.</p>
        <div className="mt-9 space-y-3">{features.map(([number, title, description]) => <article key={number} className="flex gap-4 rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-sm font-bold text-blue-700">{number}</span><div><h2 className="font-semibold text-slate-900">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{description}</p></div></article>)}</div>
      </section>
      <section className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-blue-950/10 sm:p-9">
        <div className="mb-7 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-lg font-bold text-white">E</span><div><h1 className="text-xl font-semibold text-slate-950">Chào mừng đến EventFlow</h1><p className="text-sm text-slate-500">Tiếp tục quản lý sự kiện của bạn.</p></div></div>
        <Link href="/login" className="block w-full rounded-xl bg-blue-700 px-4 py-3 text-center font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-200">Đăng nhập</Link>
        <p className="mt-6 text-center text-sm text-slate-500">Đăng nhập bằng tài khoản EventFlow đã được cấp.</p>
        <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><span className="font-semibold">Hệ thống: </span><Link className="underline underline-offset-2" href="/system-status">Kiểm tra trạng thái nền tảng</Link></div>
      </section>
    </div>
  </main>;
}
