'use client';

import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import type { DatesSetArg, EventClickArg, EventContentArg } from '@fullcalendar/core';
import type { DateClickArg } from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import type { CalendarCategory, CalendarItem, CalendarItemDetail, CalendarSourceType } from '@eventflow/contracts';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiRequestError, getCalendarItemDetail, getCalendarItems } from '../../lib/api-client';
import { useDataVersion } from '../data-refresh-provider';
import {
  calendarCategories,
  calendarDateFromQuery,
  calendarDateQuery,
  calendarViewFromQuery,
  formatCalendarDateRange,
  formatCalendarDateTime,
  formatCalendarHeading,
  fullCalendarView,
  moveCalendarDate,
  type CalendarView,
} from '../../lib/calendar-ui';
import { priorityLabel, roleLabel, taskStatusLabel } from '../../lib/event-ui';
import { ErrorState } from '../ui/page-state';

interface VisibleRange {
  from: string;
  to: string;
}

interface SelectedItem {
  sourceType: CalendarSourceType;
  sourceId: string;
}

const calendarViewOptions: ReadonlyArray<readonly [CalendarView, string]> = [
  ['month', 'Tháng'],
  ['week', 'Tuần'],
  ['day', 'Ngày'],
];

const calendarCategoryOptions: ReadonlyArray<readonly [CalendarCategory, string]> = [
  ['EVENT', 'Sự kiện'],
  ['TASK', 'Công việc'],
  ['MEETING_INTERNAL', 'Họp / nội bộ'],
  ['VOLUNTEER', 'Tình nguyện'],
  ['OTHER', 'Khác'],
];

const calendarSourceOptions: ReadonlyArray<readonly [CalendarSourceType, string]> = [
  ['EVENT', 'Sự kiện'],
  ['TASK', 'Công việc'],
];

function isUuid(value: string | null): value is string {
  return value !== null && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function selectedFromQuery(sourceType: string | null, sourceId: string | null): SelectedItem | null {
  if (!isUuid(sourceId)) return null;
  if (sourceType === 'EVENT' || sourceType === 'TASK') return { sourceType, sourceId };
  return null;
}

function categoryFiltersFromQuery(value: string | null): CalendarCategory[] | null {
  const selected = new Set((value ?? '').split(','));
  const filters = calendarCategoryOptions.map(([category]) => category).filter((category) => selected.has(category));
  return filters.length === 0 || filters.length === calendarCategoryOptions.length ? null : filters;
}

function sourceFiltersFromQuery(value: string | null): CalendarSourceType[] | null {
  const selected = new Set((value ?? '').split(','));
  const filters = calendarSourceOptions.map(([sourceType]) => sourceType).filter((sourceType) => selected.has(sourceType));
  return filters.length === 0 || filters.length === calendarSourceOptions.length ? null : filters;
}

function toggleFilter<T extends string>(current: readonly T[] | null, value: T, options: ReadonlyArray<readonly [T, string]>): T[] | null {
  const all = options.map(([option]) => option);
  if (current === null) return [value];
  const selected = current;
  const next = selected.includes(value) ? selected.filter((option) => option !== value) : [...selected, value];
  return next.length === 0 || next.length === all.length ? null : next;
}

function categoryFromUnknown(value: unknown) {
  if (value === 'EVENT' || value === 'TASK' || value === 'MEETING_INTERNAL' || value === 'VOLUNTEER' || value === 'OTHER') return value;
  return 'OTHER';
}

function CalendarEventContent(arg: EventContentArg) {
  const category = categoryFromUnknown(arg.event.extendedProps.category);
  const metadata = calendarCategories[category];
  return <span className={`eventflow-calendar-pill block min-w-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-4 ring-1 ${metadata.pillClass}`} title={`${metadata.label}: ${arg.event.title}`}>
    <span aria-hidden="true" className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${metadata.dotClass}`} />
    <span className="sr-only">{metadata.label}: </span><span className="truncate align-bottom">{arg.event.title}</span>
  </span>;
}

function toRange(arg: DatesSetArg): VisibleRange {
  return { from: arg.start.toISOString(), to: arg.end.toISOString() };
}

function sameRange(left: VisibleRange | null, right: VisibleRange): boolean {
  return left?.from === right.from && left.to === right.to;
}

export function CalendarPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const calendarVersion = useDataVersion('calendar');
  const [view, setView] = useState<CalendarView>(() => calendarViewFromQuery(searchParams.get('view')));
  const [cursor, setCursor] = useState<Date>(() => calendarDateFromQuery(searchParams.get('date')));
  const [selected, setSelected] = useState<SelectedItem | null>(() => selectedFromQuery(searchParams.get('selectedType'), searchParams.get('selectedId')));
  const [searchDraft, setSearchDraft] = useState(() => searchParams.get('q') ?? '');
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [categoryFilters, setCategoryFilters] = useState<CalendarCategory[] | null>(() => categoryFiltersFromQuery(searchParams.get('categories')));
  const [sourceFilters, setSourceFilters] = useState<CalendarSourceType[] | null>(() => sourceFiltersFromQuery(searchParams.get('sourceTypes')));
  const [visibleRange, setVisibleRange] = useState<VisibleRange | null>(null);
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [rangeState, setRangeState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [detail, setDetail] = useState<CalendarItemDetail | null>(null);
  const [detailState, setDetailState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [detailMessage, setDetailMessage] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const replaceQuery = useCallback((changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    if (next.toString() === searchParams.toString()) return;
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    const nextView = calendarViewFromQuery(searchParams.get('view'));
    const nextCursor = calendarDateFromQuery(searchParams.get('date'));
    const nextSelected = selectedFromQuery(searchParams.get('selectedType'), searchParams.get('selectedId'));
    const nextSearch = searchParams.get('q') ?? '';
    setView(nextView);
    setCursor((current) => calendarDateQuery(current) === calendarDateQuery(nextCursor) ? current : nextCursor);
    setSelected(nextSelected);
    setSearchDraft(nextSearch);
    setSearch(nextSearch);
    setCategoryFilters(categoryFiltersFromQuery(searchParams.get('categories')));
    setSourceFilters(sourceFiltersFromQuery(searchParams.get('sourceTypes')));
  }, [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextSearch = searchDraft.trim();
      setSearch(nextSearch);
      replaceQuery({ q: nextSearch || null });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [replaceQuery, searchDraft]);

  useEffect(() => {
    if (!visibleRange) return;
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setRangeState('loading');
    setRangeError(null);
    const query = {
      from: visibleRange.from,
      to: visibleRange.to,
      ...(search ? { search } : {}),
      ...(categoryFilters ? { categories: categoryFilters } : {}),
      ...(sourceFilters ? { sourceTypes: sourceFilters } : {}),
    };
    void getCalendarItems(query).then((response) => {
      if (requestVersion.current !== version) return;
      setItems(response.items);
      setRangeState('ready');
    }).catch((reason: unknown) => {
      if (requestVersion.current !== version) return;
      setRangeState('error');
      setRangeError(reason instanceof Error ? reason.message : 'Không thể tải lịch.');
    });
  }, [calendarVersion, categoryFilters, retry, search, sourceFilters, visibleRange]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      setDetailState('idle');
      setDetailMessage(null);
      return;
    }
    let active = true;
    setDetailState('loading');
    setDetail(null);
    setDetailMessage(null);
    void getCalendarItemDetail(selected.sourceType, selected.sourceId).then((response) => {
      if (!active) return;
      setDetail(response);
      setDetailState('ready');
    }).catch((reason: unknown) => {
      if (!active) return;
      if (reason instanceof ApiRequestError && (reason.status === 403 || reason.status === 404)) {
        setSelected(null);
        replaceQuery({ selectedType: null, selectedId: null });
        setDetailMessage('Bạn không còn quyền truy cập nội dung này.');
        setDetailState('error');
        return;
      }
      setDetailMessage(reason instanceof Error ? reason.message : 'Không thể tải chi tiết lịch.');
      setDetailState('error');
    });
    return () => { active = false; };
  }, [replaceQuery, selected]);

  const calendarEvents = useMemo(() => items.map((item) => item.endsAt
    ? { id: item.id, title: item.title, start: item.startsAt, end: item.endsAt, allDay: item.allDay, extendedProps: { category: item.category } }
    : { id: item.id, title: item.title, start: item.startsAt, allDay: item.allDay, extendedProps: { category: item.category } }), [items]);

  const selectItem = useCallback((item: CalendarItem) => {
    const itemDate = new Date(item.startsAt);
    if (!Number.isNaN(itemDate.getTime())) setCursor(itemDate);
    const nextSelected = { sourceType: item.sourceType, sourceId: item.sourceId };
    setSelected(nextSelected);
    replaceQuery({
      date: Number.isNaN(itemDate.getTime()) ? calendarDateQuery(cursor) : calendarDateQuery(itemDate),
      selectedType: item.sourceType,
      selectedId: item.sourceId,
    });
  }, [cursor, replaceQuery]);

  const onDatesSet = useCallback((arg: DatesSetArg) => {
    const next = toRange(arg);
    setVisibleRange((current) => sameRange(current, next) ? current : next);
  }, []);

  const onEventClick = useCallback((arg: EventClickArg) => {
    arg.jsEvent.preventDefault();
    const item = items.find((candidate) => candidate.id === arg.event.id);
    if (item) selectItem(item);
  }, [items, selectItem]);

  const onDateClick = useCallback((arg: DateClickArg) => {
    const nextDate = calendarDateQuery(arg.date);
    setCursor(arg.date);
    setSelected(null);
    replaceQuery({ date: nextDate, selectedType: null, selectedId: null });
  }, [replaceQuery]);

  const closeDetail = useCallback(() => {
    setSelected(null);
    replaceQuery({ selectedType: null, selectedId: null });
  }, [replaceQuery]);

  function chooseView(nextView: CalendarView): void {
    setView(nextView);
    replaceQuery({ view: nextView, date: calendarDateQuery(cursor) });
  }

  function move(direction: -1 | 1): void {
    const next = moveCalendarDate(cursor, view, direction);
    setCursor(next);
    replaceQuery({ date: calendarDateQuery(next), view });
  }

  function goToday(): void {
    const today = new Date();
    setCursor(today);
    replaceQuery({ date: calendarDateQuery(today), view });
  }

  function updateCategoryFilter(category: CalendarCategory): void {
    const next = toggleFilter(categoryFilters, category, calendarCategoryOptions);
    setCategoryFilters(next);
    replaceQuery({ categories: next?.join(',') ?? null });
  }

  function updateSourceFilter(sourceType: CalendarSourceType): void {
    const next = toggleFilter(sourceFilters, sourceType, calendarSourceOptions);
    setSourceFilters(next);
    replaceQuery({ sourceTypes: next?.join(',') ?? null });
  }

  const selectedDayItems = useMemo(() => items.filter((item) => calendarDateQuery(new Date(item.startsAt)) === calendarDateQuery(cursor)), [cursor, items]);

  return <section className="mx-auto max-w-[1600px] overflow-x-hidden px-3 py-5 sm:px-6 lg:px-8 lg:py-8" aria-labelledby="calendar-heading">
    <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
      <div><p className="text-sm font-semibold text-indigo-700">EventFlow</p><h1 id="calendar-heading" className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Lịch sự kiện</h1><p className="mt-2 text-sm text-slate-600">Theo dõi và quản lý lịch trình các sự kiện bạn tham gia.</p></div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative block min-w-0 sm:w-80"><span className="sr-only">Tìm sự kiện, công việc, địa điểm</span><input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Tìm sự kiện, công việc, địa điểm..." className="min-h-11 w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-10 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" /><span aria-hidden="true" className="absolute left-3 top-3 text-slate-400">⌕</span>{searchDraft ? <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setSearchDraft('')} className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-indigo-100">×</button> : null}</label>
        <Link href="/app/events/new" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200">+ Tạo sự kiện mới</Link>
      </div>
    </header>

    <div className="mt-6 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5" aria-label="Lịch cá nhân">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2"><button type="button" aria-label="Khoảng thời gian trước" onClick={() => move(-1)} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-300 text-lg text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-indigo-100">‹<span className="sr-only">Trước</span></button><button type="button" aria-label="Khoảng thời gian sau" onClick={() => move(1)} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-300 text-lg text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-indigo-100">›<span className="sr-only">Sau</span></button><button type="button" onClick={goToday} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-indigo-100">Hôm nay</button><h2 className="ml-1 text-base font-semibold capitalize text-slate-950 sm:text-lg">{formatCalendarHeading(cursor, view)}</h2></div>
          <div className="inline-flex w-full rounded-xl bg-slate-100 p-1 sm:w-auto" role="group" aria-label="Chế độ xem lịch">{calendarViewOptions.map(([option, label]) => <button key={option} type="button" aria-pressed={view === option} onClick={() => chooseView(option)} className={`min-h-9 flex-1 rounded-lg px-3 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-indigo-100 sm:flex-none ${view === option ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-950'}`}>{label}</button>)}</div>
        </div>
        <div className="mt-4 flex flex-col gap-3 border-b border-slate-100 pb-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <fieldset className="flex flex-wrap items-center gap-2"><legend className="sr-only">Lọc nguồn lịch</legend><span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Nguồn</span>{calendarSourceOptions.map(([sourceType, label]) => <button key={sourceType} type="button" aria-pressed={(sourceFilters ?? calendarSourceOptions.map(([option]) => option)).includes(sourceType)} onClick={() => updateSourceFilter(sourceType)} className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition focus:outline-none focus:ring-4 focus:ring-indigo-100 ${(sourceFilters ?? calendarSourceOptions.map(([option]) => option)).includes(sourceType) ? 'border-indigo-200 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}>{label}</button>)}</fieldset>
          <fieldset className="flex flex-wrap items-center gap-2"><legend className="sr-only">Lọc loại lịch</legend><span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Loại</span>{calendarCategoryOptions.map(([category, label]) => <button key={category} type="button" aria-pressed={(categoryFilters ?? calendarCategoryOptions.map(([option]) => option)).includes(category)} onClick={() => updateCategoryFilter(category)} className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition focus:outline-none focus:ring-4 focus:ring-indigo-100 ${(categoryFilters ?? calendarCategoryOptions.map(([option]) => option)).includes(category) ? 'border-slate-200 bg-slate-50 text-slate-800' : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'}`}>{label}</button>)}</fieldset>
        </div>
        {rangeState === 'error' && items.length === 0 ? <div className="py-8"><ErrorState message={rangeError || 'Không thể tải lịch.'} onRetry={() => setRetry((value) => value + 1)} /></div> : <>
          {rangeState === 'loading' && items.length > 0 ? <p role="status" className="mt-3 text-xs font-medium text-indigo-700">Đang cập nhật lịch…</p> : null}
          <div className="eventflow-calendar mt-4 min-w-0" aria-busy={rangeState === 'loading'}>
            <FullCalendar key={`${view}:${calendarDateQuery(cursor)}`} plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]} initialView={fullCalendarView(view)} initialDate={cursor} headerToolbar={false} locale="vi" firstDay={1} height="auto" events={calendarEvents} editable={false} eventStartEditable={false} eventDurationEditable={false} selectable={false} dayMaxEvents={2} moreLinkContent={(arg) => `+ ${arg.num} sự kiện khác`} moreLinkClick="popover" eventDisplay="block" eventContent={CalendarEventContent} eventClick={onEventClick} dateClick={onDateClick} datesSet={onDatesSet} dayCellClassNames={(arg) => calendarDateQuery(arg.date) === calendarDateQuery(cursor) ? ['eventflow-selected-day'] : []} eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }} slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }} allDayText="Cả ngày" />
          </div>
        </>}
        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-4" aria-label="Chú thích lịch">{Object.entries(calendarCategories).map(([category, metadata]) => <span key={category} className="inline-flex items-center gap-2 text-xs text-slate-600"><span aria-hidden="true" className={`h-2 w-2 rounded-full ${metadata.dotClass}`} />{metadata.label}</span>)}</div>
      </section>

      <aside className="hidden h-fit min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-5 xl:block" aria-live="polite"><CalendarSideContent detail={detail} detailState={detailState} message={detailMessage} selectedDayItems={selectedDayItems} selectedDate={cursor} onSelect={selectItem} onClose={closeDetail} onShareMessage={setShareMessage} /><ShareMessage message={shareMessage} /></aside>
    </div>
    {selected ? <div className="fixed inset-0 z-40 bg-slate-950/35 p-3 pt-12 xl:hidden" role="dialog" aria-modal="true" aria-label="Chi tiết lịch" onKeyDown={(event) => { if (event.key === 'Escape') closeDetail(); }}><section className="ml-auto flex max-h-[calc(100vh-4rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="overflow-y-auto p-5"><CalendarSideContent detail={detail} detailState={detailState} message={detailMessage} selectedDayItems={selectedDayItems} selectedDate={cursor} onSelect={selectItem} onClose={closeDetail} onShareMessage={setShareMessage} /></div></section></div> : null}
    {shareMessage ? <p role="status" className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-lg xl:bottom-6">{shareMessage}</p> : null}
  </section>;
}

function CalendarSideContent({ detail, detailState, message, selectedDayItems, selectedDate, onSelect, onClose, onShareMessage }: Readonly<{ detail: CalendarItemDetail | null; detailState: 'idle' | 'loading' | 'ready' | 'error'; message: string | null; selectedDayItems: CalendarItem[]; selectedDate: Date; onSelect: (item: CalendarItem) => void; onClose: () => void; onShareMessage: (message: string | null) => void; }>) {
  if (detailState === 'loading') return <div className="animate-pulse space-y-4"><div className="h-28 rounded-xl bg-slate-100" /><div className="h-5 w-1/3 rounded bg-slate-100" /><div className="h-8 w-4/5 rounded bg-slate-100" /><div className="h-16 rounded bg-slate-100" /></div>;
  if (detailState === 'error' && message) return <div><button type="button" aria-label="Đóng chi tiết lịch" onClick={onClose} className="float-right grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-indigo-100">×</button><h2 className="text-lg font-semibold text-slate-950">Không thể mở chi tiết</h2><p className="mt-3 text-sm leading-6 text-slate-600">{message}</p></div>;
  if (detail?.sourceType === 'EVENT') return <EventDetailContent detail={detail} onClose={onClose} onShareMessage={onShareMessage} />;
  if (detail?.sourceType === 'TASK') return <TaskDetailContent detail={detail} onClose={onClose} />;
  return <SelectedDayAgenda items={selectedDayItems} date={selectedDate} onSelect={onSelect} />;
}

function SelectedDayAgenda({ items, date, onSelect }: Readonly<{ items: CalendarItem[]; date: Date; onSelect: (item: CalendarItem) => void; }>) {
  return <section><h2 className="text-lg font-semibold text-slate-950">Lịch ngày {new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'long' }).format(date)}</h2><p className="mt-1 text-sm text-slate-600">Chọn một lịch trình để xem chi tiết.</p>{items.length === 0 ? <p className="mt-8 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">Không có lịch trình nào trong ngày này.</p> : <ul className="mt-5 space-y-2">{items.map((item) => { const category = calendarCategories[item.category]; return <li key={item.id}><button type="button" onClick={() => onSelect(item)} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left hover:border-indigo-200 hover:bg-indigo-50/40 focus:outline-none focus:ring-4 focus:ring-indigo-100"><span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${category.dotClass}`} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{item.title}</span><span className="block truncate text-xs text-slate-500">{formatCalendarDateTime(item.startsAt)}</span></span></button></li>; })}</ul>}</section>;
}

function EventDetailContent({ detail, onClose, onShareMessage }: Readonly<{ detail: Extract<CalendarItemDetail, { sourceType: 'EVENT' }>; onClose: () => void; onShareMessage: (message: string | null) => void; }>) {
  return <section><div className="flex items-start justify-between gap-4"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800">Sự kiện</span><button type="button" autoFocus aria-label="Đóng chi tiết lịch" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-indigo-100">×</button></div><DetailCover url={detail.coverUrl} fallback="Sự kiện" /><h2 className="mt-5 text-xl font-bold tracking-tight text-slate-950">{detail.title}</h2>{detail.shortDescription ? <p className="mt-2 text-sm leading-6 text-slate-600">{detail.shortDescription}</p> : null}<dl className="mt-5 space-y-3 border-y border-slate-100 py-4 text-sm"><InfoLine label="Ngày tổ chức" value={formatCalendarDateRange(detail.startsAt, detail.endsAt)} /><InfoLine label="Địa điểm" value={detail.locationName || 'Chưa cập nhật'} /><InfoLine label="Vai trò của bạn" value={roleLabel(detail.userEventRole)} /><InfoLine label="Ban tổ chức" value={detail.organizerName} /></dl>{detail.description ? <section className="mt-5"><h3 className="text-sm font-semibold text-slate-950">Mô tả sự kiện</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{detail.description}</p></section> : null}<p className="mt-5 text-sm text-slate-600">{detail.relatedCompletedTaskCount}/{detail.relatedAssignedTaskCount} công việc được giao đã hoàn thành.</p><div className="mt-5 grid gap-2"><Link href={`/app/events/${encodeURIComponent(detail.eventId)}`} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200">Xem chi tiết sự kiện</Link><Link href={`/app/events/${encodeURIComponent(detail.eventId)}?tab=tasks`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-indigo-100">Xem công việc liên quan</Link><button type="button" onClick={() => void shareEvent(detail.eventId, detail.title, onShareMessage)} className="min-h-11 rounded-xl px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 focus:outline-none focus:ring-4 focus:ring-indigo-100">Chia sẻ</button></div></section>;
}

function TaskDetailContent({ detail, onClose }: Readonly<{ detail: Extract<CalendarItemDetail, { sourceType: 'TASK' }>; onClose: () => void; }>) {
  return <section><div className="flex items-start justify-between gap-4"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">Công việc</span><button type="button" autoFocus aria-label="Đóng chi tiết lịch" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-indigo-100">×</button></div><DetailCover url={detail.eventCoverUrl} fallback="Công việc" /><h2 className="mt-5 text-xl font-bold tracking-tight text-slate-950">{detail.title}</h2><p className="mt-2 text-sm font-medium text-indigo-700">{detail.eventName}</p><dl className="mt-5 space-y-3 border-y border-slate-100 py-4 text-sm"><InfoLine label="Hạn hoàn thành" value={formatCalendarDateTime(detail.dueAt)} /><InfoLine label="Trạng thái" value={taskStatusLabel(detail.status)} /><InfoLine label="Ưu tiên" value={priorityLabel(detail.priority)} /><InfoLine label="Giai đoạn" value={detail.workflowStage.name} /><InfoLine label="Bộ phận" value={detail.department?.name || 'Chưa phân công'} /></dl>{detail.description ? <section className="mt-5"><h3 className="text-sm font-semibold text-slate-950">Mô tả công việc</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{detail.description}</p></section> : null}<section className="mt-5"><h3 className="text-sm font-semibold text-slate-950">Người thực hiện</h3><ul className="mt-2 space-y-1 text-sm text-slate-600">{detail.assignees.map((assignee) => <li key={assignee.eventMemberId}>{assignee.displayName || assignee.email}</li>)}</ul></section><div className="mt-5 grid gap-2"><Link href={`/app/events/${encodeURIComponent(detail.eventId)}/tasks/${encodeURIComponent(detail.taskId)}`} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200">Xem chi tiết công việc</Link><Link href={`/app/events/${encodeURIComponent(detail.eventId)}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-indigo-100">Xem sự kiện</Link></div></section>;
}

function DetailCover({ url, fallback }: Readonly<{ url: string | null; fallback: string }>) {
  return url ? <img src={url} alt="" className="mt-4 h-32 w-full rounded-xl object-cover" /> : <div aria-hidden="true" className="mt-4 grid h-32 place-items-center rounded-xl bg-gradient-to-br from-indigo-100 to-slate-100 text-sm font-semibold text-indigo-700">{fallback}</div>;
}

function InfoLine({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3"><dt className="text-slate-500">{label}</dt><dd className="min-w-0 font-medium text-slate-800">{value}</dd></div>;
}

async function shareEvent(eventId: string, title: string, setMessage: (message: string | null) => void): Promise<void> {
  const url = new URL(`/app/events/${encodeURIComponent(eventId)}`, window.location.origin).toString();
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ title, url });
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      throw new Error('CLIPBOARD_UNAVAILABLE');
    }
    setMessage('Đã sao chép liên kết sự kiện.');
  } catch {
    setMessage('Không thể chia sẻ liên kết sự kiện. Vui lòng thử lại.');
  }
  window.setTimeout(() => setMessage(null), 3_000);
}

function ShareMessage({ message }: Readonly<{ message: string | null }>) {
  return message ? <p role="status" className="sr-only">{message}</p> : null;
}
