'use client';

import type { EventDetail, PaginatedResponse, TaskListItem } from '@eventflow/contracts';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useDataVersion } from '../../../../components/data-refresh-provider';
import { TaskList } from '../../../../components/tasks/task-list';
import { EventStatusBadge, RoleBadge } from '../../../../components/ui/badges';
import { EmptyState, ErrorState, LoadingCards } from '../../../../components/ui/page-state';
import { ProgressBar } from '../../../../components/ui/progress-bar';
import { getEvent, getEventTasks } from '../../../../lib/api-client';
import { errorMessage, formatDateRange, hasPermission, roleDescription } from '../../../../lib/event-ui';

type WorkspaceTab = 'overview' | 'tasks';
interface WorkspaceState { phase: 'loading' | 'ready' | 'error'; event: EventDetail | null; tasks: PaginatedResponse<TaskListItem> | null; message: string | null; }

export function EventWorkspace({ eventId }: Readonly<{ eventId: string }>) {
  const eventVersion = useDataVersion(`event:${eventId}`);
  const taskVersion = useDataVersion(`event-tasks:${eventId}`);
  const searchParams = useSearchParams();
  const requestedTab: WorkspaceTab = searchParams.get('tab') === 'tasks' ? 'tasks' : 'overview';
  const [tab, setTab] = useState<WorkspaceTab>(requestedTab);
  const [state, setState] = useState<WorkspaceState>({ phase: 'loading', event: null, tasks: null, message: null });
  const [retry, setRetry] = useState(0);

  const load = useCallback(async () => {
    setState((current) => ({ phase: 'loading', event: current.event, tasks: current.tasks, message: null }));
    try {
      const event = await getEvent(eventId);
      const scope = hasPermission(event.membership.permissions, 'task:view:all') ? 'all' : 'mine';
      const tasks = await getEventTasks(eventId, { scope, page: 1, pageSize: 30, sort: 'dueAt:asc' });
      setState({ phase: 'ready', event, tasks, message: null });
    } catch (reason: unknown) { setState({ phase: 'error', event: null, tasks: null, message: errorMessage(reason) }); }
  }, [eventId]);

  useEffect(() => { void load(); }, [eventVersion, load, retry, taskVersion]);
  useEffect(() => { setTab(requestedTab); }, [requestedTab]);
  if (state.phase === 'loading' && !state.event) return <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10"><LoadingCards count={4} /></section>;
  if (state.phase === 'error' || !state.event || !state.tasks) return <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10"><ErrorState message={state.message || 'Không thể mở sự kiện.'} onRetry={() => setRetry((value) => value + 1)} /></section>;
  const event = state.event;
  const canCreateTask = hasPermission(event.membership.permissions, 'task:create:self') || hasPermission(event.membership.permissions, 'task:create');

  function replaceTask(updated: TaskListItem): void { setState((current) => current.tasks ? { ...current, tasks: { ...current.tasks, items: current.tasks.items.map((task) => task.id === updated.id ? updated : task) } } : current); }

  return <section className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-10 lg:py-10"><Link href="/app/events" className="inline-flex min-h-11 items-center text-sm font-medium text-slate-600 hover:text-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100">← Sự kiện của tôi</Link><div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex min-w-0 flex-col lg:flex-row"><img src={event.coverUrl || '/demo/events/event-placeholder.svg'} alt="" className="h-44 w-full object-cover lg:h-auto lg:w-64" /><div className="min-w-0 flex-1 p-5 sm:p-7"><div className="flex flex-wrap items-center gap-2"><EventStatusBadge status={event.status} /><RoleBadge role={event.membership.role} /></div><h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{event.name}</h1><p className="mt-2 text-sm text-slate-600">{formatDateRange(event.startsAt, event.endsAt)}{event.locationName ? ` · ${event.locationName}` : ''}</p>{event.description ? <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">{event.description}</p> : null}</div></div></div><div className="mt-6 flex gap-2 overflow-x-auto border-b border-slate-200" role="tablist" aria-label="Nội dung sự kiện"><button type="button" role="tab" aria-selected={tab === 'overview'} onClick={() => setTab('overview')} className={`min-h-11 shrink-0 border-b-2 px-3 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-100 ${tab === 'overview' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600'}`}>Tổng quan</button><button type="button" role="tab" aria-selected={tab === 'tasks'} onClick={() => setTab('tasks')} className={`min-h-11 shrink-0 border-b-2 px-3 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-100 ${tab === 'tasks' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600'}`}>Công việc ({state.tasks.total})</button><Link href={`/app/events/${encodeURIComponent(event.id)}/workflow`} className="inline-flex min-h-11 shrink-0 items-center border-b-2 border-transparent px-3 text-sm font-semibold text-indigo-700 hover:text-indigo-800 focus:outline-none focus:ring-4 focus:ring-indigo-100">Quy trình</Link><Link href={`/app/events/${encodeURIComponent(event.id)}/members`} className="inline-flex min-h-11 shrink-0 items-center border-b-2 border-transparent px-3 text-sm font-medium text-slate-600 hover:text-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100">Thành viên</Link><span aria-disabled="true" className="inline-flex min-h-11 shrink-0 items-center border-b-2 border-transparent px-3 text-sm text-slate-400">Thảo luận · Sắp có</span></div>{tab === 'overview' ? <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-slate-950">Tổng quan công việc</h2><p className="mt-2 text-sm leading-6 text-slate-600">Xem các đầu việc được giao và theo dõi tiến độ cá nhân trong sự kiện này.</p><button type="button" onClick={() => setTab('tasks')} className="mt-5 min-h-11 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-indigo-200">Xem công việc</button></section><RoleProgressCard event={event} /></div> : <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]"><section className="min-w-0"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-slate-950">Công việc của tôi</h2><p className="mt-1 text-sm text-slate-600">{state.tasks.total} công việc hiển thị theo quyền của bạn</p></div>{canCreateTask ? <Link href={`/app/events/${encodeURIComponent(event.id)}/tasks/new`} className="inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-indigo-200">Tạo công việc</Link> : null}</div><div className="mt-4">{state.tasks.items.length === 0 ? <EmptyState title="Chưa có công việc" description="Không có công việc nào phù hợp với quyền truy cập hiện tại của bạn." /> : <TaskList tasks={state.tasks.items} onTaskUpdated={replaceTask} />}</div></section><RoleProgressCard event={event} /></div>}</section>;
}

function RoleProgressCard({ event }: Readonly<{ event: EventDetail }>) {
  const membership = event.membership;
  const progress = event.progress;
  return <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-sm font-semibold text-slate-950">Vai trò của bạn</h2>
    <div className="mt-3"><RoleBadge role={membership.role} /></div>
    <p className="mt-3 text-sm leading-6 text-slate-600">{roleDescription(membership.role)}</p>
    <Link href={`/app/events/${encodeURIComponent(event.id)}/role-permissions`} className="mt-3 inline-block text-sm font-semibold text-indigo-700 hover:underline focus:outline-none focus:ring-4 focus:ring-indigo-100">Vai trò & quyền hạn</Link>
    <div className="mt-6 border-t border-slate-100 pt-5">
      <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-slate-950">Tiến độ sự kiện</h2><span className="text-sm font-medium text-slate-600">{progress.overall.percentage}%</span></div>
      <p className="mt-2 text-sm text-slate-600">{progress.overall.completed}/{progress.overall.total} công việc hoàn thành</p>
      <div className="mt-3"><ProgressBar value={progress.overall.percentage} label="Tiến độ sự kiện" /></div>
    </div>
    <div className="mt-6 border-t border-slate-100 pt-5">
      <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-slate-950">Tiến độ công việc của tôi</h2><span className="text-sm font-medium text-slate-600">{progress.currentUser.percentage}%</span></div>
      <p className="mt-2 text-sm text-slate-600">{progress.currentUser.completed}/{progress.currentUser.total} công việc hoàn thành</p>
      <div className="mt-3"><ProgressBar value={progress.currentUser.percentage} label="Tiến độ công việc cá nhân" /></div>
    </div>
  </aside>;
}
