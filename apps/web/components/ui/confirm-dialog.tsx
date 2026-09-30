'use client';

import { useEffect, useRef, type ReactNode } from 'react';

export function ConfirmDialog({ open, title, description, confirmLabel, pending, children, onCancel, onConfirm }: Readonly<{ open: boolean; title: string; description: string; confirmLabel: string; pending?: boolean; children?: ReactNode; onCancel: () => void; onConfirm: () => void }>) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    function onKeyDown(event: KeyboardEvent): void { if (event.key === 'Escape' && !pending) onCancel(); }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel, open, pending]);

  if (!open) return null;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onCancel(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h2 id="confirm-dialog-title" className="text-lg font-semibold text-slate-950">{title}</h2><p id="confirm-dialog-description" className="mt-2 text-sm leading-6 text-slate-600">{description}</p>{children ? <div className="mt-4">{children}</div> : null}<div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button ref={cancelRef} type="button" disabled={pending} onClick={onCancel} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-60">Hủy</button><button type="button" disabled={pending} onClick={onConfirm} className="min-h-11 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-rose-200 disabled:opacity-60">{pending ? 'Đang xử lý…' : confirmLabel}</button></div></section>
  </div>;
}
