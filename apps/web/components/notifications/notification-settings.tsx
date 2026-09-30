'use client';

import { useState } from 'react';
import { useNotifications } from './notification-provider';

function connectionLabel(state: 'connecting' | 'connected' | 'disconnected' | 'reconnecting'): string {
  switch (state) {
    case 'connecting': return 'Đang kết nối';
    case 'connected': return 'Đã kết nối';
    case 'reconnecting': return 'Đang kết nối lại';
    case 'disconnected': return 'Mất kết nối';
  }
}

function browserPermissionLabel(permission: NotificationPermission | 'unsupported'): string {
  switch (permission) {
    case 'granted': return 'Đã cho phép';
    case 'denied': return 'Đã bị chặn trong trình duyệt';
    case 'default': return 'Chưa được cấp quyền';
    case 'unsupported': return 'Trình duyệt không hỗ trợ';
  }
}

export function NotificationSettings() {
  const { preferences, connectionState, desktopPermission, audioUnlocked, updatePreferences, unlockAudio, requestDesktopNotifications } = useNotifications();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function toggleSound(): Promise<void> {
    if (!preferences || pending) return;
    setPending(true); setError(null); setMessage(null);
    try {
      const nextSoundEnabled = !preferences.soundEnabled;
      if (nextSoundEnabled) await unlockAudio();
      await updatePreferences({ soundEnabled: nextSoundEnabled });
      setMessage(nextSoundEnabled ? 'Đã bật âm thanh thông báo.' : 'Đã tắt âm thanh thông báo.');
    } catch {
      setError('Không thể lưu tùy chọn âm thanh. Vui lòng thử lại.');
    } finally { setPending(false); }
  }

  async function enableDesktop(): Promise<void> {
    if (pending) return;
    setPending(true); setError(null); setMessage(null);
    try {
      const enabled = await requestDesktopNotifications();
      setMessage(enabled ? 'Đã bật thông báo trên máy.' : 'Trình duyệt chưa cho phép thông báo trên máy.');
    } catch {
      setError('Không thể cập nhật thông báo trên máy. Vui lòng thử lại.');
    } finally { setPending(false); }
  }

  async function disableDesktop(): Promise<void> {
    if (pending) return;
    setPending(true); setError(null); setMessage(null);
    try {
      await updatePreferences({ desktopEnabled: false });
      setMessage('Đã tắt thông báo trên máy trong EventFlow.');
    } catch {
      setError('Không thể lưu tùy chọn. Vui lòng thử lại.');
    } finally { setPending(false); }
  }

  return <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="notification-settings-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-indigo-700">THÔNG BÁO</p><h2 id="notification-settings-title" className="mt-1 text-lg font-semibold text-slate-950">Tùy chọn thông báo</h2><p className="mt-1 text-sm leading-6 text-slate-600">Thông báo trong ứng dụng cho công việc được giao luôn được lưu an toàn.</p></div><span className={`inline-flex min-h-8 items-center rounded-full px-3 text-xs font-semibold ${connectionState === 'connected' ? 'bg-emerald-50 text-emerald-700' : connectionState === 'disconnected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{connectionLabel(connectionState)}</span></div>
    <dl className="mt-5 divide-y divide-slate-100 border-y border-slate-100"><div className="flex min-h-16 items-center justify-between gap-4 py-3"><div><dt className="text-sm font-semibold text-slate-900">Thông báo trong ứng dụng</dt><dd className="mt-1 text-sm text-slate-600">Luôn bật cho công việc được giao trong sprint này.</dd></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Luôn bật</span></div>
      <div className="flex min-h-16 items-center justify-between gap-4 py-3"><div><dt className="text-sm font-semibold text-slate-900">Âm thanh thông báo</dt><dd className="mt-1 text-sm text-slate-600">{audioUnlocked ? 'Âm thanh đã sẵn sàng trong phiên này.' : 'Trình duyệt sẽ chỉ phát âm thanh sau thao tác của bạn.'}</dd></div><button type="button" disabled={!preferences || pending} onClick={() => void toggleSound()} role="switch" aria-checked={preferences?.soundEnabled ?? false} className={`relative h-8 w-14 shrink-0 rounded-full transition focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 ${(preferences?.soundEnabled ?? false) ? 'bg-indigo-600' : 'bg-slate-300'}`}><span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${(preferences?.soundEnabled ?? false) ? 'left-7' : 'left-1'}`} /><span className="sr-only">Bật hoặc tắt âm thanh thông báo</span></button></div>
      <div className="flex min-h-16 items-center justify-between gap-4 py-3"><div><dt className="text-sm font-semibold text-slate-900">Thông báo trên máy</dt><dd className="mt-1 text-sm text-slate-600">Trạng thái trình duyệt: {browserPermissionLabel(desktopPermission)}. Chỉ hiện khi EventFlow đang mở hoặc chạy nền và đã kết nối.</dd></div>{preferences?.desktopEnabled && desktopPermission === 'granted' ? <button type="button" disabled={pending} onClick={() => void disableDesktop()} className="min-h-11 shrink-0 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50">Tắt</button> : <button type="button" disabled={pending || desktopPermission === 'denied' || desktopPermission === 'unsupported'} onClick={() => void enableDesktop()} className="min-h-11 shrink-0 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-50">Bật</button>}</div>
    </dl>
    <p className="mt-4 text-xs leading-5 text-slate-500">EventFlow chưa hỗ trợ thông báo khi trình duyệt đã đóng hoàn toàn. Chức năng đó cần Web Push và được để ngoài phạm vi sprint này.</p>
    {message ? <p role="status" className="mt-3 text-sm text-emerald-700">{message}</p> : null}
    {error ? <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p> : null}
  </section>;
}
