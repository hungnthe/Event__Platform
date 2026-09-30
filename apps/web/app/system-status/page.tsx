import { StatusPanel } from './status-panel';
export const dynamic = 'force-dynamic';
export default function SystemStatusPage() { return <main className="mx-auto max-w-3xl px-6 py-20"><p className="text-sm font-semibold text-blue-700">SYSTEM STATUS</p><h1 className="mt-3 text-4xl font-bold">Tình trạng nền tảng</h1><p className="mt-3 text-slate-600">Kết quả được lấy theo thời gian thực từ readiness endpoint của EventFlow API.</p><StatusPanel /></main>; }
