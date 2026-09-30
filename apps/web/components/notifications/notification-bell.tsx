'use client';

import { useEffect, useState } from 'react';
import { formatDate } from '../../lib/event-ui';
import { isSafeInternalActionPath, unreadBadgeLabel } from '../../lib/notifications/notification-state';
import { useNotifications } from './notification-provider';

function notificationTypeLabel(type: string): string {
  switch (type) {
    case 'TASK_ASSIGNED': return 'Công việc mới';
    case 'TASK_REASSIGNED': return 'Giao lại công việc';
    case 'TASK_UNASSIGNED': return 'Thay đổi phân công';
    case 'EVENT_PERMISSION_GRANTED': return 'Được cấp quyền';
    case 'EVENT_PERMISSION_REVOKED': return 'Thu hồi quyền';
    default: return 'Thông báo';
  }
}

export function NotificationBell() {
  const { notifications, unreadCount, refreshNotificationCenter, markAllAsRead, openNotification } = useNotifications();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const badge = unreadBadgeLabel(unreadCount);

  useEffect(() => {
    if (!open) return;
    setError(null);
    void refreshNotificationCenter().catch(() => setError('Không thể tải danh sách thông báo.'));
  }, [open, refreshNotificationCenter]);

  async function readAll(): Promise<void> {
    if (pending || unreadCount === 0) return;
    setPending(true);
    setError(null);
    try {
      await markAllAsRead();
    } catch {
      setError('Không thể đánh dấu đã đọc. Vui lòng thử lại.');
    } finally {
      setPending(false);
    }
  }

  return <div className="relative">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="dialog" aria-label={badge ? `Thông báo, ${badge} chưa đọc` : 'Thông báo'} className="relative grid h-11 w-11 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-4 focus:ring-indigo-100">
      <span aria-hidden="true" className="text-lg leading-none">🔔</span>
      {badge ? <span aria-label={`${unreadCount} thông báo chưa đọc`} className="absolute right-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-5 text-white">{badge}</span> : null}
    </button>
    {open ? <section role="dialog" aria-label="Trung tâm thông báo" className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
      <header className="flex min-h-14 items-center justify-between border-b border-slate-100 px-4"><div><h2 className="text-sm font-semibold text-slate-950">Thông báo</h2><p className="text-xs text-slate-500">{unreadCount > 0 ? `${unreadCount} chưa đọc` : 'Đã đọc hết'}</p></div><button type="button" disabled={pending || unreadCount === 0} onClick={() => void readAll()} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-50">Đọc tất cả</button></header>
      {error ? <p role="alert" className="border-b border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      {notifications.length === 0 ? <div className="px-4 py-10 text-center"><p className="text-sm font-medium text-slate-700">Chưa có thông báo</p><p className="mt-1 text-sm text-slate-500">Các cập nhật công việc sẽ xuất hiện ở đây.</p></div> : <ul className="max-h-[min(60vh,34rem)] divide-y divide-slate-100 overflow-y-auto">{notifications.map((notification) => {
        const canOpen = isSafeInternalActionPath(notification.actionPath);
        return <li key={notification.id}><button type="button" disabled={!canOpen} onClick={() => { void openNotification(notification); setOpen(false); }} className={`w-full px-4 py-3 text-left transition focus:outline-none focus:ring-inset focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed ${notification.readAt ? 'bg-white hover:bg-slate-50' : 'bg-indigo-50/60 hover:bg-indigo-50'}`}>
          <div className="flex items-start gap-3"><span aria-hidden="true" className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${notification.readAt ? 'bg-transparent' : 'bg-indigo-600'}`} /><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-3"><span className="truncate text-xs font-semibold uppercase tracking-wide text-indigo-700">{notificationTypeLabel(notification.type)}</span><time className="shrink-0 text-xs text-slate-500">{formatDate(notification.createdAt, true)}</time></span><span className="mt-1 block text-sm font-semibold text-slate-950">{notification.title}</span><span className="mt-1 block line-clamp-2 text-sm leading-5 text-slate-600">{notification.body}</span>{canOpen ? <span className="mt-2 inline-block text-sm font-semibold text-indigo-700">{notification.taskId ? 'Xem công việc' : 'Xem chi tiết'} →</span> : <span className="mt-2 inline-block text-xs text-slate-500">Không có đường dẫn hợp lệ</span>}</span></div>
        </button></li>;
      })}</ul>}
    </section> : null}
  </div>;
}
