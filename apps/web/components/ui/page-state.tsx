import type { ReactNode } from 'react';

export function LoadingCards({ count = 3 }: Readonly<{ count?: number }>) {
  const cards: ReactNode[] = [];
  for (let index = 0; index < count; index += 1) cards.push(<div key={index} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5"><div className="h-5 w-2/5 rounded bg-slate-200" /><div className="mt-4 h-4 w-3/5 rounded bg-slate-100" /><div className="mt-5 h-2 w-full rounded bg-slate-100" /></div>);
  return <div className="space-y-3" aria-busy="true" aria-label="Đang tải">{cards}</div>;
}

export function EmptyState({ title, description, action }: Readonly<{ title: string; description: string; action?: ReactNode }>) {
  return <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><h2 className="text-lg font-semibold text-slate-950">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>{action ? <div className="mt-5">{action}</div> : null}</section>;
}

export function ErrorState({ message, onRetry }: Readonly<{ message: string; onRetry: () => void }>) {
  return <section className="rounded-2xl border border-rose-100 bg-white px-6 py-10 text-center" role="alert"><h2 className="text-lg font-semibold text-slate-950">Không thể tải dữ liệu</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{message}</p><button type="button" onClick={onRetry} className="mt-5 min-h-11 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200">Thử lại</button></section>;
}
