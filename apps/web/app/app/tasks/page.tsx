'use client';

import type { MyEventsResponse, PaginatedResponse, TaskListItem, TaskPriority, TaskStatus } from '@eventflow/contracts';
import { useCallback, useEffect, useState } from 'react';
import { useDataVersion } from '../../../components/data-refresh-provider';
import { TaskList } from '../../../components/tasks/task-list';
import { EmptyState, ErrorState, LoadingCards } from '../../../components/ui/page-state';
import { getMyEvents, getMyTasks } from '../../../lib/api-client';
import { errorMessage, priorityLabel, taskPriorities, taskStatusLabel, taskStatuses } from '../../../lib/event-ui';

interface State { phase: 'loading' | 'ready' | 'error'; tasks: PaginatedResponse<TaskListItem> | null; events: MyEventsResponse | null; message: string | null; }
function parseStatus(value: string): TaskStatus | null { for (const status of taskStatuses) if (value === status) return status; return null; }
function parsePriority(value: string): TaskPriority | null { for (const priority of taskPriorities) if (value === priority) return priority; return null; }

export default function MyTasksPage() {
  const refreshVersion = useDataVersion('my-tasks');
  const [eventId, setEventId] = useState('');
  const [status, setStatus] = useState<TaskStatus | ''>('');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [overdue, setOverdue] = useState(false);
  const [dueSoon, setDueSoon] = useState(false);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<State>({ phase: 'loading', tasks: null, events: null, message: null });

  const load = useCallback(async () => {
    setState((current) => ({ phase: 'loading', tasks: current.tasks, events: current.events, message: null }));
    try {
      const taskQuery = { page: 1, pageSize: 50, sort: 'priority,dueAt:asc', ...(eventId ? { eventId } : {}), ...(status ? { status } : {}), ...(priority ? { priority } : {}), ...(overdue ? { overdue: true } : {}), ...(dueSoon ? { dueSoon: true } : {}) };
      const [tasks, events] = await Promise.all([
        getMyTasks(taskQuery),
        getMyEvents({ page: 1, pageSize: 100, sort: 'startsAt:asc' }),
      ]);
      setState({ phase: 'ready', tasks, events, message: null });
    } catch (reason: unknown) { setState({ phase: 'error', tasks: null, events: null, message: errorMessage(reason) }); }
  }, [dueSoon, eventId, overdue, priority, status]);

  useEffect(() => { void load(); }, [load, refreshVersion, retry]);
  function replaceTask(updated: TaskListItem): void { setState((current) => current.tasks ? { ...current, tasks: { ...current.tasks, items: current.tasks.items.map((task) => task.id === updated.id ? updated : task) } } : current); }

  return <section className="mx-auto max-w-5xl px-4 py-7 sm:px-6 lg:px-10 lg:py-10"><p className="text-sm font-semibold text-indigo-700">CÔNG VIỆC</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Công việc của tôi</h1><p className="mt-2 text-sm text-slate-600">Các đầu việc được giao trên mọi sự kiện.</p><fieldset className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"><legend className="sr-only">Lọc công việc</legend><label className="text-sm text-slate-700">Sự kiện<select value={eventId} onChange={(event) => setEventId(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"><option value="">Tất cả sự kiện</option>{state.events?.items.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></label><label className="text-sm text-slate-700">Trạng thái<select value={status} onChange={(event) => { const value = event.target.value; if (value === '') setStatus(''); else { const parsed = parseStatus(value); if (parsed) setStatus(parsed); } }} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"><option value="">Tất cả</option>{taskStatuses.map((value) => <option key={value} value={value}>{taskStatusLabel(value)}</option>)}</select></label><label className="text-sm text-slate-700">Ưu tiên<select value={priority} onChange={(event) => { const value = event.target.value; if (value === '') setPriority(''); else { const parsed = parsePriority(value); if (parsed) setPriority(parsed); } }} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"><option value="">Tất cả</option>{taskPriorities.map((value) => <option key={value} value={value}>{priorityLabel(value)}</option>)}</select></label><label className="flex min-h-11 items-center gap-2 self-end rounded-xl border border-slate-200 px-3 text-sm text-slate-700"><input checked={overdue} onChange={(event) => setOverdue(event.target.checked)} type="checkbox" /> Quá hạn</label><label className="flex min-h-11 items-center gap-2 self-end rounded-xl border border-slate-200 px-3 text-sm text-slate-700"><input checked={dueSoon} onChange={(event) => setDueSoon(event.target.checked)} type="checkbox" /> Sắp đến hạn</label></fieldset><div className="mt-6">{state.phase === 'loading' && !state.tasks ? <LoadingCards /> : null}{state.phase === 'error' ? <ErrorState message={state.message || 'Không thể tải công việc.'} onRetry={() => setRetry((value) => value + 1)} /> : null}{state.phase === 'ready' && state.tasks && state.tasks.items.length === 0 ? <EmptyState title="Không có công việc phù hợp" description="Không có công việc nào khớp với các bộ lọc hiện tại." /> : null}{state.tasks && state.tasks.items.length > 0 ? <TaskList tasks={state.tasks.items} showEvent onTaskUpdated={replaceTask} /> : null}</div></section>;
}
