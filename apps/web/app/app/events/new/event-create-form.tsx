'use client';

import type { CreateEventRequest, EventStatus } from '@eventflow/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useDataRefresh } from '../../../../components/data-refresh-provider';
import { createEvent } from '../../../../lib/api-client';
import { errorMessage, isoFromDateTimeLocal } from '../../../../lib/event-ui';

interface EventFormState {
  name: string;
  description: string;
  locationName: string;
  startsAt: string;
  endsAt: string;
  status: EventStatus;
}

const initialState: EventFormState = { name: '', description: '', locationName: '', startsAt: '', endsAt: '', status: 'UPCOMING' };
function parseEventStatus(value: string): EventStatus | null { if (value === 'DRAFT' || value === 'UPCOMING' || value === 'ONGOING') return value; return null; }

export function EventCreateForm() {
  const router = useRouter();
  const { invalidate } = useDataRefresh();
  const [form, setForm] = useState<EventFormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const dirty = form.name !== '' || form.description !== '' || form.locationName !== '' || form.startsAt !== '' || form.endsAt !== '';

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent): void { if (dirty && !pending) event.preventDefault(); }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty, pending]);

  function setField<Key extends keyof EventFormState>(key: Key, value: EventFormState[Key]): void { setForm((current) => ({ ...current, [key]: value })); }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;
    setError(null);
    const startsAt = isoFromDateTimeLocal(form.startsAt);
    const endsAt = isoFromDateTimeLocal(form.endsAt);
    if (!form.name.trim() || !startsAt || !endsAt) { setError('Vui lòng nhập tên sự kiện, thời gian bắt đầu và kết thúc.'); return; }
    if (new Date(startsAt) >= new Date(endsAt)) { setError('Thời gian bắt đầu phải trước thời gian kết thúc.'); return; }
    const payload: CreateEventRequest = { name: form.name.trim(), startsAt, endsAt, status: form.status };
    if (form.description.trim()) payload.description = form.description.trim();
    if (form.locationName.trim()) payload.locationName = form.locationName.trim();
    setPending(true);
    try {
      const created = await createEvent(payload);
      invalidate(['my-events', `event:${created.id}`, `event-membership:${created.id}`, `event-tasks:${created.id}`, 'calendar']);
      router.replace(`/app/events/${encodeURIComponent(created.id)}`);
    } catch (reason: unknown) {
      setError(errorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  function leave(): void { if (!dirty || window.confirm('Bạn có thay đổi chưa lưu. Rời trang này?')) router.push('/app/events'); }

  return <section className="mx-auto max-w-3xl px-4 py-7 sm:px-6 lg:px-10 lg:py-10"><Link href="/app/events" className="inline-flex min-h-11 items-center text-sm font-medium text-slate-600 hover:text-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100">← Sự kiện của tôi</Link><h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Tạo sự kiện</h1><p className="mt-2 text-sm text-slate-600">Bạn sẽ trở thành chủ sự kiện và các giai đoạn công việc mặc định sẽ được tạo tự động.</p><form onSubmit={(event) => void submit(event)} className="mt-7 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><label className="block text-sm font-medium text-slate-700" htmlFor="event-name">Tên sự kiện<input id="event-name" required value={form.name} onChange={(event) => setField('name', event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100" /></label><label className="block text-sm font-medium text-slate-700" htmlFor="event-description">Mô tả<textarea id="event-description" rows={4} value={form.description} onChange={(event) => setField('description', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100" /></label><label className="block text-sm font-medium text-slate-700" htmlFor="event-location">Địa điểm<input id="event-location" value={form.locationName} onChange={(event) => setField('locationName', event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100" /></label><div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-medium text-slate-700" htmlFor="event-start">Bắt đầu<input id="event-start" type="datetime-local" required value={form.startsAt} onChange={(event) => setField('startsAt', event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100" /></label><label className="block text-sm font-medium text-slate-700" htmlFor="event-end">Kết thúc<input id="event-end" type="datetime-local" required value={form.endsAt} onChange={(event) => setField('endsAt', event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100" /></label></div><label className="block text-sm font-medium text-slate-700" htmlFor="event-status">Trạng thái<select id="event-status" value={form.status} onChange={(event) => { const status = parseEventStatus(event.target.value); if (status) setField('status', status); }} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"><option value="DRAFT">Bản nháp</option><option value="UPCOMING">Sắp diễn ra</option><option value="ONGOING">Đang diễn ra</option></select></label>{error ? <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" disabled={pending} onClick={leave} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-100">Hủy</button><button type="submit" disabled={pending} className="min-h-11 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:opacity-60">{pending ? 'Đang tạo…' : 'Tạo sự kiện'}</button></div></form></section>;
}
