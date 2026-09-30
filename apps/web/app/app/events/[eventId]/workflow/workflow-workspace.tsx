'use client';

import type { EventWorkflowSummary, PaginatedResponse, TaskListItem, TaskPriority, TaskStatus, WorkflowAssignmentStrategy } from '@eventflow/contracts';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useDataRefresh, useDataVersion } from '../../../../../components/data-refresh-provider';
import { TaskList } from '../../../../../components/tasks/task-list';
import { ConfirmDialog } from '../../../../../components/ui/confirm-dialog';
import { EmptyState, ErrorState, LoadingCards } from '../../../../../components/ui/page-state';
import { ProgressBar } from '../../../../../components/ui/progress-bar';
import { getEventWorkflow, getWorkflowStageTasks, initializeEventWorkflow } from '../../../../../lib/api-client';
import { errorMessage, formatDate, hasPermission, priorityLabel, taskStatusLabel, taskPriorities, taskStatuses } from '../../../../../lib/event-ui';

interface WorkflowState {
  phase: 'loading' | 'ready' | 'error';
  workflow: EventWorkflowSummary | null;
  tasks: PaginatedResponse<TaskListItem> | null;
  message: string | null;
}

interface Filters {
  search: string;
  status: TaskStatus | '';
  priority: TaskPriority | '';
  origin: 'WORKFLOW_TEMPLATE' | 'USER_CREATED' | '';
  mineOnly: boolean;
}

const defaultFilters: Filters = { search: '', status: '', priority: '', origin: '', mineOnly: false };

function selectedTaskStatus(value: string): TaskStatus | '' {
  for (const status of taskStatuses) if (status === value) return status;
  return '';
}

function selectedTaskPriority(value: string): TaskPriority | '' {
  for (const priority of taskPriorities) if (priority === value) return priority;
  return '';
}

function selectedOrigin(value: string): Filters['origin'] {
  if (value === 'WORKFLOW_TEMPLATE' || value === 'USER_CREATED') return value;
  return '';
}

function selectedAssignmentStrategy(value: string): WorkflowAssignmentStrategy {
  return value === 'DEPARTMENT_LEADS' ? 'DEPARTMENT_LEADS' : 'CURRENT_USER';
}

function stageIcon(iconKey: EventWorkflowSummary['stages'][number]['iconKey']): string {
  switch (iconKey) {
    case 'sparkles': return '✦';
    case 'clipboard': return '▤';
    case 'play': return '▶';
    case 'chart': return '↗';
  }
}

export function WorkflowWorkspace({ eventId }: Readonly<{ eventId: string }>) {
  const { invalidate } = useDataRefresh();
  const version = useDataVersion(`workflow:${eventId}`);
  const [state, setState] = useState<WorkflowState>({ phase: 'loading', workflow: null, tasks: null, message: null });
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [retry, setRetry] = useState(0);
  const [initializeOpen, setInitializeOpen] = useState(false);
  const [initializePending, setInitializePending] = useState(false);
  const [initializeError, setInitializeError] = useState<string | null>(null);
  const [assignmentStrategy, setAssignmentStrategy] = useState<WorkflowAssignmentStrategy>('CURRENT_USER');

  const load = useCallback(async () => {
    setState((current) => ({ ...current, phase: 'loading', message: null }));
    try {
      const workflow = await getEventWorkflow(eventId);
      const resolvedStageId = workflow.stages.some((stage) => stage.id === selectedStageId)
        ? selectedStageId
        : workflow.stages.find((stage) => stage.id !== '')?.id ?? null;
      if (resolvedStageId !== selectedStageId) setSelectedStageId(resolvedStageId);
      const tasks = resolvedStageId
        ? await getWorkflowStageTasks(eventId, resolvedStageId, {
          ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.priority ? { priority: filters.priority } : {}),
          ...(filters.origin ? { origin: filters.origin } : {}),
          ...(filters.mineOnly ? { mineOnly: true } : {}),
          page: 1,
          pageSize: 50,
          sort: 'dueAt:asc',
        })
        : { items: [], page: 1, pageSize: 50, total: 0, totalPages: 1 };
      setState({ phase: 'ready', workflow, tasks, message: null });
    } catch (reason: unknown) {
      setState({ phase: 'error', workflow: null, tasks: null, message: errorMessage(reason) });
    }
  }, [eventId, filters, selectedStageId]);

  useEffect(() => { void load(); }, [load, retry, version]);

  async function initialize(): Promise<void> {
    setInitializePending(true);
    setInitializeError(null);
    try {
      await initializeEventWorkflow(eventId, { templateVersion: 'BASIC_EVENT_WORKFLOW_V1', assignmentStrategy });
      setInitializeOpen(false);
      invalidate([`workflow:${eventId}`, `event:${eventId}`, `event-tasks:${eventId}`, 'calendar', 'my-tasks', 'my-events']);
    } catch (reason: unknown) {
      setInitializeError(errorMessage(reason));
    } finally {
      setInitializePending(false);
    }
  }

  function replaceTask(updated: TaskListItem): void {
    setState((current) => current.tasks ? {
      ...current,
      tasks: { ...current.tasks, items: current.tasks.items.map((task) => task.id === updated.id ? updated : task) },
    } : current);
  }

  if (state.phase === 'loading' && !state.workflow) return <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10"><LoadingCards count={4} /></section>;
  if (state.phase === 'error' || !state.workflow || !state.tasks) return <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10"><ErrorState message={state.message || 'Không thể mở quy trình sự kiện.'} onRetry={() => setRetry((value) => value + 1)} /></section>;

  const workflow = state.workflow;
  const selectedStage = workflow.stages.find((stage) => stage.id === selectedStageId) ?? workflow.stages[0];
  const canInitialize = hasPermission(workflow.permissions, 'workflow:initialize');
  const canCreate = hasPermission(workflow.permissions, 'task:create:self') || hasPermission(workflow.permissions, 'task:create');

  return <section className="mx-auto max-w-7xl overflow-x-hidden px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
    <Link href={`/app/events/${encodeURIComponent(eventId)}`} className="inline-flex min-h-11 items-center text-sm font-medium text-slate-600 hover:text-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100">← Quay lại sự kiện</Link>
    <header className="mt-3 rounded-3xl bg-slate-950 px-5 py-7 text-white shadow-sm sm:px-8">
      <p className="text-sm font-semibold text-indigo-200">SỰ KIỆN · WORKSPACE</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{workflow.event.name}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Một không gian làm việc cho toàn bộ đội ngũ sự kiện</p>
      <div className="mt-6 flex flex-wrap items-center gap-2 text-sm font-semibold text-indigo-100"><span>Design</span><span aria-hidden="true">→</span><span>Prepare</span><span aria-hidden="true">→</span><span>Execute</span><span aria-hidden="true">→</span><span>Review</span></div>
    </header>

    {!workflow.initialization.initialized ? <section className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-5 sm:flex sm:items-center sm:justify-between sm:gap-5"><div><h2 className="text-lg font-semibold text-slate-950">Chưa có quy trình mẫu</h2><p className="mt-1 text-sm leading-6 text-slate-600">EventFlow sẽ tạo 4 giai đoạn và 24 công việc cơ bản, dữ liệu được lưu trong PostgreSQL.</p>{initializeError ? <p role="alert" className="mt-2 text-sm font-medium text-rose-700">{initializeError}</p> : null}</div>{canInitialize ? <button type="button" onClick={() => setInitializeOpen(true)} className="mt-4 inline-flex min-h-11 shrink-0 items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-indigo-200 sm:mt-0">Khởi tạo quy trình mẫu</button> : <p className="mt-4 text-sm font-medium text-slate-600 sm:mt-0">Chỉ Chủ sự kiện hoặc Điều phối viên có thể khởi tạo.</p>}</section> : null}

    <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{workflow.stages.map((stage) => <button key={stage.code} type="button" disabled={!stage.id} onClick={() => setSelectedStageId(stage.id)} className={`min-w-0 rounded-2xl border p-4 text-left shadow-sm transition focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:cursor-default ${stage.id !== '' && stage.id === selectedStage?.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-300 disabled:hover:border-slate-200'}`}><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-lg text-indigo-700 shadow-sm" aria-hidden="true">{stageIcon(stage.iconKey)}</span><div className="mt-4 flex items-center justify-between gap-3"><h2 className="font-semibold text-slate-950">{stage.label}</h2><span className="text-sm font-semibold text-slate-700">{stage.completedTaskCount}/{stage.activeTaskCount}</span></div><p className="mt-2 min-h-10 text-sm leading-5 text-slate-600">{stage.summary}</p><div className="mt-4"><ProgressBar value={stage.percentage} label={`Tiến độ ${stage.label}`} /></div></button>)}</div>

    <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0"><section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-bold tracking-tight text-slate-950">{selectedStage?.label}</h2><p className="mt-1 text-sm text-slate-600">{selectedStage?.summary}</p></div>{canCreate && selectedStage?.id ? <Link href={`/app/events/${encodeURIComponent(eventId)}/tasks/new?stageId=${encodeURIComponent(selectedStage.id)}`} className="inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-indigo-200">+ Tạo công việc</Link> : null}</div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><input type="search" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Tìm kiếm" className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 lg:col-span-2" /><select aria-label="Lọc trạng thái" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: selectedTaskStatus(event.target.value) }))} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"><option value="">Trạng thái</option>{taskStatuses.map((status) => <option key={status} value={status}>{taskStatusLabel(status)}</option>)}</select><select aria-label="Lọc ưu tiên" value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: selectedTaskPriority(event.target.value) }))} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"><option value="">Ưu tiên</option>{taskPriorities.map((priority) => <option key={priority} value={priority}>{priorityLabel(priority)}</option>)}</select><select aria-label="Lọc nguồn công việc" value={filters.origin} onChange={(event) => setFilters((current) => ({ ...current, origin: selectedOrigin(event.target.value) }))} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"><option value="">Mẫu/Tự tạo</option><option value="WORKFLOW_TEMPLATE">Mẫu quy trình</option><option value="USER_CREATED">Tự tạo</option></select></div><label className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={filters.mineOnly} onChange={(event) => setFilters((current) => ({ ...current, mineOnly: event.target.checked }))} /> Công việc của tôi</label></section><div className="mt-4">{state.tasks.items.length === 0 ? <EmptyState title="Chưa có công việc phù hợp" description="Thử đổi bộ lọc hoặc tạo công việc đầu tiên cho giai đoạn này." /> : <TaskList tasks={state.tasks.items} onTaskUpdated={replaceTask} />}</div></div>
      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-semibold text-slate-950">Tiến độ tổng thể</h2><p className="mt-3 text-3xl font-bold text-slate-950">{workflow.progress.percentage}%</p><p className="mt-1 text-sm text-slate-600">{workflow.progress.completedTaskCount}/{workflow.progress.activeTaskCount} công việc hoàn thành</p><div className="mt-4"><ProgressBar value={workflow.progress.percentage} label="Tiến độ sự kiện" /></div><dl className="mt-6 space-y-3 border-t border-slate-100 pt-5 text-sm"><div className="flex justify-between gap-3"><dt className="text-slate-600">Quá hạn</dt><dd className="font-semibold text-rose-700">{workflow.progress.overdueTaskCount}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-600">Đang bị chặn</dt><dd className="font-semibold text-amber-700">{workflow.progress.blockedTaskCount}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-600">Khởi tạo</dt><dd className="font-medium text-slate-900">{workflow.initialization.initializedAt ? formatDate(workflow.initialization.initializedAt) : 'Chưa'}</dd></div></dl></aside>
    </div>
    <ConfirmDialog open={initializeOpen} title="Khởi tạo quy trình mẫu" description={`Hệ thống sẽ thêm 24 công việc mẫu vào 4 giai đoạn. Nếu khởi tạo lại, các công việc có sẵn không bị tạo trùng.${new Date(workflow.event.endsAt).getTime() < Date.now() ? ' Đây là sự kiện đã kết thúc nên hạn mẫu sẽ giữ theo mốc lịch sử của sự kiện.' : ''}`} confirmLabel="Khởi tạo" pending={initializePending} onCancel={() => setInitializeOpen(false)} onConfirm={() => void initialize()}>
      <label className="block text-sm font-medium text-slate-700" htmlFor="workflow-assignment-strategy">Giao công việc mẫu cho</label>
      <select id="workflow-assignment-strategy" value={assignmentStrategy} disabled={initializePending} onChange={(event) => setAssignmentStrategy(selectedAssignmentStrategy(event.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 disabled:opacity-60"><option value="CURRENT_USER">Tôi phụ trách</option><option value="DEPARTMENT_LEADS">Trưởng các bộ phận phù hợp</option></select>
    </ConfirmDialog>
  </section>;
}
