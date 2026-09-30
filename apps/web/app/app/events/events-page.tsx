'use client';

import type { MyEventsResponse } from '@eventflow/contracts';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { EventCard } from '../../../components/events/event-card';
import { useDataVersion } from '../../../components/data-refresh-provider';
import { EmptyState, ErrorState, LoadingCards } from '../../../components/ui/page-state';
import { errorMessage } from '../../../lib/event-ui';
import { getMyEvents } from '../../../lib/api-client';

type EventTab = 'ONGOING' | 'UPCOMING' | 'ENDED';

const eventTabs: Array<{ value: EventTab; label: string }> = [
  { value: 'ONGOING', label: 'Đang diễn ra' },
  { value: 'UPCOMING', label: 'Sắp diễn ra' },
  { value: 'ENDED', label: 'Đã kết thúc' },
];

interface PageState {
  phase: 'loading' | 'ready' | 'error';
  result: MyEventsResponse | null;
  message: string | null;
}

export function EventsPage() {
  const refreshVersion = useDataVersion('my-events');
  const [activeTab, setActiveTab] = useState<EventTab>('ONGOING');
  const [inputValue, setInputValue] = useState('');
  const [search, setSearch] = useState('');
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<PageState>({ phase: 'loading', result: null, message: null });

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(inputValue.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [inputValue]);

  const load = useCallback(async () => {
    setState((current) => ({ phase: 'loading', result: current.result, message: null }));
    try {
      const result = await getMyEvents({ status: activeTab, search, page: 1, pageSize: 20, sort: 'startsAt:asc' });
      setState({ phase: 'ready', result, message: null });
    } catch (reason: unknown) {
      setState({ phase: 'error', result: null, message: errorMessage(reason) });
    }
  }, [activeTab, search]);

  useEffect(() => { void load(); }, [load, refreshVersion, retry]);

  const count = state.result?.statusCounts[activeTab] ?? 0;
  return <section className="mx-auto max-w-5xl px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-indigo-700">EVENTFLOW</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Sự kiện của tôi</h1><p className="mt-2 text-sm text-slate-600">Các sự kiện bạn được mời tham gia và công việc được giao</p></div><Link href="/app/events/new" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200">Tạo sự kiện</Link></div>
    <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist" aria-label="Trạng thái sự kiện">{eventTabs.map((tab) => <button key={tab.value} type="button" role="tab" aria-selected={activeTab === tab.value} onClick={() => setActiveTab(tab.value)} className={`min-h-11 shrink-0 rounded-xl px-3 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-100 ${activeTab === tab.value ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`}>{tab.label} <span className={activeTab === tab.value ? 'text-indigo-100' : 'text-slate-400'}>({state.result?.statusCounts[tab.value] ?? 0})</span></button>)}</div><label className="relative block sm:w-72"><span className="sr-only">Tìm sự kiện</span><input value={inputValue} onChange={(event) => setInputValue(event.target.value)} type="search" placeholder="Tìm sự kiện" className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 py-2 pr-10 text-sm outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100" /><span aria-hidden="true" className="pointer-events-none absolute right-3 top-2.5 text-slate-400">⌕</span></label></div>
    <p className="mt-5 text-sm text-slate-500">{count} sự kiện phù hợp</p>
    <div className="mt-3">{state.phase === 'loading' && !state.result ? <LoadingCards /> : null}{state.phase === 'error' ? <ErrorState message={state.message || 'Không thể tải sự kiện.'} onRetry={() => setRetry((value) => value + 1)} /> : null}{state.phase === 'ready' && state.result && state.result.items.length === 0 ? <EmptyState title="Chưa có sự kiện phù hợp" description="Bạn chưa được mời tham gia sự kiện nào khớp với bộ lọc này." action={<Link href="/app/events/new" className="inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-indigo-200">Tạo sự kiện</Link>} /> : null}{state.result && state.result.items.length > 0 ? <div className="space-y-3" aria-live="polite">{state.result.items.map((event) => <EventCard key={event.id} event={event} />)}</div> : null}</div>
  </section>;
}
