'use client';

import type { TaskListItem, TaskStatus } from '@eventflow/contracts';
import Link from 'next/link';
import { useState } from 'react';
import { useDataRefresh } from '../data-refresh-provider';
import { updateTaskStatus } from '../../lib/api-client';
import { errorMessage, formatDate } from '../../lib/event-ui';
import { PriorityBadge, TaskOriginBadge, TaskStatusBadge } from '../ui/badges';

function quickStatus(task: TaskListItem): TaskStatus | null {
  if (task.status === 'DONE') return task.capabilities.allowedStatusTransitions.includes('IN_PROGRESS') ? 'IN_PROGRESS' : null;
  return task.capabilities.allowedStatusTransitions.includes('DONE') ? 'DONE' : null;
}

export function TaskRow({ task, showEvent = false, onTaskUpdated }: Readonly<{ task: TaskListItem; showEvent?: boolean; onTaskUpdated: (task: TaskListItem) => void }>) {
  const { invalidate } = useDataRefresh();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextStatus = quickStatus(task);

  async function toggleCompletion(): Promise<void> {
    if (!nextStatus || pending) return;
    setPending(true);
    setError(null);
    const optimistic: TaskListItem = { ...task, status: nextStatus, completedAt: nextStatus === 'DONE' ? new Date().toISOString() : null };
    onTaskUpdated(optimistic);
    try {
      const updated = await updateTaskStatus(task.id, { status: nextStatus });
      onTaskUpdated(updated.task);
      invalidate(['my-events', `event:${task.eventId}`, `event-tasks:${task.eventId}`, `workflow:${task.eventId}`, 'my-tasks', `task:${task.id}`, 'calendar']);
    } catch (reason: unknown) {
      onTaskUpdated(task);
      setError(errorMessage(reason));
    } finally {
      setPending(false);
    }
  }

  const taskHref = `/app/events/${encodeURIComponent(task.eventId)}/tasks/${encodeURIComponent(task.id)}`;
  return <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex min-w-0 gap-3"><div className="pt-0.5">{nextStatus ? <button type="button" disabled={pending} onClick={() => void toggleCompletion()} aria-label={task.status === 'DONE' ? `Đánh dấu ${task.title} chưa hoàn thành` : `Đánh dấu ${task.title} đã hoàn thành`} className={`grid h-6 w-6 place-items-center rounded border transition focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-60 ${task.status === 'DONE' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white text-transparent hover:border-indigo-500'}`}>{pending ? '…' : '✓'}</button> : <span aria-hidden="true" className={`block h-6 w-6 rounded border ${task.status === 'DONE' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-200 bg-slate-50'}`} />}</div><div className="min-w-0 flex-1"><div className="flex min-w-0 flex-wrap items-center gap-2"><Link href={taskHref} className="min-w-0 truncate text-base font-semibold text-slate-950 hover:text-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100">{task.title}</Link><TaskOriginBadge origin={task.origin} /><PriorityBadge priority={task.priority} /><TaskStatusBadge status={task.status} /></div>{showEvent ? <Link href={`/app/events/${encodeURIComponent(task.eventId)}`} className="mt-1 inline-block text-sm text-indigo-700 hover:underline focus:outline-none focus:ring-4 focus:ring-indigo-100">{task.eventName}</Link> : null}<div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600"><span>Hạn: {formatDate(task.dueAt)}</span><span>Giai đoạn: {task.workflowStage.name}</span>{task.department ? <span>Bộ phận: {task.department.name}</span> : null}{task.isOverdue ? <span className="font-medium text-rose-700">Quá hạn</span> : null}</div>{error ? <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p> : null}</div></div></article>;
}
