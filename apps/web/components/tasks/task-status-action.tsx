'use client';

import type { TaskDetail, TaskStatus } from '@eventflow/contracts';
import { useState } from 'react';
import { updateTaskStatus } from '../../lib/api-client';
import { errorMessage, taskStatusLabel } from '../../lib/event-ui';

export function TaskStatusAction({ task, className = '', onUpdated }: Readonly<{ task: TaskDetail; className?: string; onUpdated: (task: TaskDetail) => void }>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const transitions = task.capabilities.allowedStatusTransitions;
  if (transitions.length === 0) return null;

  async function submit(status: TaskStatus): Promise<void> {
    if (pending || status === task.status) return;
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      onUpdated((await updateTaskStatus(task.id, { status })).task);
      setSuccess(status === 'DONE' ? 'Công việc đã hoàn thành.' : 'Trạng thái đã được cập nhật.');
    }
    catch (reason: unknown) { setError(errorMessage(reason)); }
    finally { setPending(false); }
  }

  const primaryStatus = task.status === 'NOT_STARTED' && transitions.includes('IN_PROGRESS')
    ? 'IN_PROGRESS'
    : task.status === 'IN_PROGRESS' && transitions.includes('DONE') ? 'DONE' : null;
  const primaryLabel = primaryStatus === 'IN_PROGRESS' ? 'Bắt đầu công việc' : 'Đánh dấu hoàn thành';
  return <div className={className}>{primaryStatus ? <button type="button" disabled={pending} onClick={() => void submit(primaryStatus)} className="min-h-11 w-full rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white outline-none focus:ring-4 focus:ring-indigo-200 disabled:opacity-60">{pending ? 'Đang cập nhật…' : primaryLabel}</button> : <><label className="sr-only" htmlFor={`task-status-${task.id}`}>Cập nhật trạng thái</label><select id={`task-status-${task.id}`} disabled={pending} value={task.status} onChange={(event) => { const status = event.target.value; if (status === 'NOT_STARTED' || status === 'IN_PROGRESS' || status === 'BLOCKED' || status === 'IN_REVIEW' || status === 'DONE' || status === 'CANCELLED') void submit(status); }} className="min-h-11 w-full rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white outline-none focus:ring-4 focus:ring-indigo-200 disabled:opacity-60"><option value={task.status}>{pending ? 'Đang cập nhật…' : `Cập nhật: ${taskStatusLabel(task.status)}`}</option>{transitions.map((status) => <option key={status} value={status}>{taskStatusLabel(status)}</option>)}</select></>}{error ? <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p> : null}{success ? <p role="status" className="mt-2 text-xs text-emerald-700">{success}</p> : null}</div>;
}
