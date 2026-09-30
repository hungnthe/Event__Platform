'use client';

import type { TaskAttachment, TaskDetail } from '@eventflow/contracts';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthenticatedUser } from '../../../../../../components/authenticated-app';
import { useDataRefresh, useDataVersion } from '../../../../../../components/data-refresh-provider';
import { TaskStatusAction } from '../../../../../../components/tasks/task-status-action';
import { ConfirmDialog } from '../../../../../../components/ui/confirm-dialog';
import { PriorityBadge, RoleBadge, TaskStatusBadge } from '../../../../../../components/ui/badges';
import { ErrorState, LoadingCards } from '../../../../../../components/ui/page-state';
import { archiveTask, attachmentDownloadHref, deleteTaskAttachment, getTask, uploadTaskAttachment } from '../../../../../../lib/api-client';
import { errorMessage, fileSizeLabel, formatDate, formatDateRange, initials } from '../../../../../../lib/event-ui';

interface DetailState { phase: 'loading' | 'ready' | 'error'; task: TaskDetail | null; message: string | null; }
const allowedUploadTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/png', 'image/jpeg', 'application/zip'];

export function TaskDetailPage({ eventId, taskId }: Readonly<{ eventId: string; taskId: string }>) {
  const { user } = useAuthenticatedUser();
  const { invalidate } = useDataRefresh();
  const version = useDataVersion(`task:${taskId}`);
  const [state, setState] = useState<DetailState>({ phase: 'loading', task: null, message: null });
  const [retry, setRetry] = useState(0);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archivePending, setArchivePending] = useState(false);
  const [uploadPending, setUploadPending] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setState((current) => ({ phase: 'loading', task: current.task, message: null }));
    try {
      const task = await getTask(taskId);
      if (task.eventId !== eventId) throw new Error('Bạn không có quyền truy cập nội dung này.');
      setState({ phase: 'ready', task, message: null });
    } catch (reason: unknown) { setState({ phase: 'error', task: null, message: errorMessage(reason) }); }
  }, [eventId, taskId]);

  useEffect(() => { void load(); }, [load, retry, version]);
  function onUpdated(task: TaskDetail): void { setState({ phase: 'ready', task, message: null }); invalidate(['my-events', `event:${eventId}`, `event-tasks:${eventId}`, 'my-tasks', `task:${taskId}`, 'calendar']); }

  async function uploadFiles(files: FileList | null): Promise<void> {
    const task = state.task;
    if (!files || !task || !task.capabilities.canUploadAttachment || uploadPending) return;
    const candidates = Array.from(files);
    for (const file of candidates) if (file.size > 10 * 1024 * 1024 || !allowedUploadTypes.includes(file.type)) { setUploadError('Chỉ nhận PDF, Office, PNG/JPEG hoặc ZIP tối đa 10 MB.'); return; }
    setUploadPending(true); setUploadError(null);
    try {
      let nextTask = task;
      for (const file of candidates) {
        const attachment = await uploadTaskAttachment(task.id, file);
        nextTask = { ...nextTask, attachments: [...nextTask.attachments, attachment] };
      }
      onUpdated(nextTask);
    } catch (reason: unknown) { setUploadError(errorMessage(reason)); }
    finally { setUploadPending(false); if (fileInput.current) fileInput.current.value = ''; }
  }

  async function removeAttachment(attachment: TaskAttachment): Promise<void> {
    const task = state.task;
    if (!task || attachment.uploadedBy.userId !== user.id || !window.confirm(`Xóa tệp “${attachment.originalFileName}”?`)) return;
    try { await deleteTaskAttachment(task.id, attachment.id); onUpdated({ ...task, attachments: task.attachments.filter((item) => item.id !== attachment.id) }); }
    catch (reason: unknown) { setUploadError(errorMessage(reason)); }
  }

  async function confirmArchive(): Promise<void> {
    const task = state.task;
    if (!task) return;
    setArchivePending(true);
    try { await archiveTask(task.id); invalidate(['my-events', `event:${eventId}`, `event-tasks:${eventId}`, 'my-tasks', `task:${taskId}`, 'calendar']); setArchiveOpen(false); window.location.assign(`/app/events/${encodeURIComponent(eventId)}`); }
    catch (reason: unknown) { setState((current) => ({ ...current, message: errorMessage(reason) })); }
    finally { setArchivePending(false); }
  }

  if (state.phase === 'loading' && !state.task) return <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-10"><LoadingCards count={3} /></section>;
  if (state.phase === 'error' || !state.task) return <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-10"><ErrorState message={state.message || 'Không thể tải công việc.'} onRetry={() => setRetry((value) => value + 1)} /></section>;
  const task = state.task;

  return <section className="task-detail-mobile-space mx-auto max-w-5xl px-4 py-7 sm:px-6 lg:px-10 lg:py-10"><Link href={`/app/events/${encodeURIComponent(eventId)}`} className="inline-flex min-h-11 items-center text-sm font-medium text-slate-600 hover:text-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100">← Quay lại sự kiện</Link><div className="mt-3 flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="text-sm font-semibold text-indigo-700">CHI TIẾT CÔNG VIỆC</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{task.title}</h1><div className="mt-3 flex flex-wrap gap-2"><PriorityBadge priority={task.priority} /><TaskStatusBadge status={task.status} /></div></div><div className="hidden items-center gap-2 lg:flex"><TaskStatusAction task={task} onUpdated={onUpdated} className="w-56" />{task.capabilities.canUpdate ? <Link href={`/app/events/${encodeURIComponent(eventId)}/tasks/${encodeURIComponent(task.id)}/edit`} className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-100">Chỉnh sửa</Link> : null}{task.capabilities.canArchive ? <button type="button" onClick={() => setArchiveOpen(true)} className="min-h-11 rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-100">Lưu trữ</button> : null}</div></div><div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]"><article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><dl className="grid gap-5 sm:grid-cols-2"><div><dt className="text-sm text-slate-500">Hạn hoàn thành</dt><dd className="mt-1 font-medium text-slate-900">{formatDate(task.dueAt, true)}</dd></div><div><dt className="text-sm text-slate-500">Giai đoạn</dt><dd className="mt-1 font-medium text-slate-900">{task.workflowStage.name}</dd></div>{task.department ? <div><dt className="text-sm text-slate-500">Bộ phận</dt><dd className="mt-1 font-medium text-slate-900">{task.department.name}</dd></div> : null}<div><dt className="text-sm text-slate-500">Sự kiện</dt><dd className="mt-1 font-medium text-slate-900">{task.eventName}</dd></div></dl><section className="mt-7 border-t border-slate-100 pt-6"><h2 className="text-base font-semibold text-slate-950">Mô tả</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{task.description || 'Chưa có mô tả cho công việc này.'}</p></section><section className="mt-7 border-t border-slate-100 pt-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold text-slate-950">Tệp đính kèm ({task.attachments.length})</h2>{task.capabilities.canUploadAttachment ? <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 focus-within:ring-4 focus-within:ring-indigo-100"><input ref={fileInput} type="file" multiple className="sr-only" onChange={(event) => void uploadFiles(event.target.files)} />{uploadPending ? 'Đang tải lên…' : 'Tải tệp lên'}</label> : null}</div>{uploadError ? <p role="alert" className="mt-3 text-sm text-rose-700">{uploadError}</p> : null}{task.attachments.length === 0 ? <p className="mt-3 text-sm text-slate-600">Chưa có tệp đính kèm.</p> : <ul className="mt-4 divide-y divide-slate-100">{task.attachments.map((attachment) => <li key={attachment.id} className="flex min-w-0 flex-wrap items-center gap-3 py-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600" aria-hidden="true">↧</span><div className="min-w-0 flex-1"><a href={attachmentDownloadHref(task.id, attachment)} className="block truncate text-sm font-medium text-indigo-700 hover:underline focus:outline-none focus:ring-4 focus:ring-indigo-100">{attachment.originalFileName}</a><p className="mt-1 text-xs text-slate-500">{fileSizeLabel(attachment.sizeBytes)} · {attachment.uploadedBy.displayName || attachment.uploadedBy.email}</p></div>{attachment.uploadedBy.userId === user.id ? <button type="button" onClick={() => void removeAttachment(attachment)} className="min-h-11 rounded-xl px-3 text-sm font-medium text-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-100">Xóa</button> : null}</li>)}</ul>}</section></article><aside className="h-fit space-y-5"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-semibold text-slate-950">Người giao</h2><div className="mt-3 flex items-center gap-3"><span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">{initials(task.assignedBy.displayName, task.assignedBy.email)}</span><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{task.assignedBy.displayName || task.assignedBy.email}</p><RoleBadge role={task.assignedBy.role} /></div></div></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-semibold text-slate-950">Người thực hiện</h2><ul className="mt-3 space-y-3">{task.assignees.map((assignee) => <li key={assignee.eventMemberId} className="flex items-center gap-3"><span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">{initials(assignee.displayName, assignee.email)}</span><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{assignee.displayName || assignee.email}</p><p className="truncate text-xs text-slate-500">{assignee.department?.name || 'Chưa phân bộ phận'}</p></div></li>)}</ul></section><p className="text-xs leading-5 text-slate-500">Tạo: {formatDateRange(task.createdAt, task.updatedAt)}</p></aside></div><div className="safe-sticky-action fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white p-3 shadow-lg lg:hidden"><TaskStatusAction task={task} onUpdated={onUpdated} /></div><ConfirmDialog open={archiveOpen} title="Lưu trữ công việc" description="Công việc sẽ không còn trong danh sách mặc định nhưng lịch sử vẫn được lưu." confirmLabel="Lưu trữ" pending={archivePending} onCancel={() => setArchiveOpen(false)} onConfirm={() => void confirmArchive()} /></section>;
}
