'use client';

import type { EventDetail, EventMemberSummary, TaskCreationMode, TaskDetail, TaskPriority } from '@eventflow/contracts';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useDataRefresh } from '../../../../../components/data-refresh-provider';
import { ErrorState, LoadingCards } from '../../../../../components/ui/page-state';
import { createTask, getEvent, getEventMembers, getTask, replaceTaskAssignees, updateTask, uploadTaskAttachment } from '../../../../../lib/api-client';
import { dateTimeLocalValue, errorMessage, hasPermission, isoFromDateTimeLocal, priorityLabel, taskPriorities } from '../../../../../lib/event-ui';

interface FormState { title: string; description: string; workflowStageId: string; departmentId: string; assigneeEventMemberIds: string[]; creationMode: TaskCreationMode; priority: TaskPriority; dueAt: string; }
interface LoadState { phase: 'loading' | 'ready' | 'error'; event: EventDetail | null; task: TaskDetail | null; members: EventMemberSummary[]; message: string | null; }
const allowedUploadTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/png', 'image/jpeg', 'application/zip'];

function emptyForm(event: EventDetail, workflowStageId: string, creationMode: TaskCreationMode): FormState {
  const selectedStageId = event.workflowStages.some((stage) => stage.id === workflowStageId) ? workflowStageId : event.workflowStages[0]?.id || '';
  return { title: '', description: '', workflowStageId: selectedStageId, departmentId: '', assigneeEventMemberIds: [], creationMode, priority: 'MEDIUM', dueAt: '' };
}
function formFromTask(task: TaskDetail): FormState { return { title: task.title, description: task.description || '', workflowStageId: task.workflowStage.id, departmentId: task.department?.id || '', assigneeEventMemberIds: task.assignees.map((assignee) => assignee.eventMemberId), creationMode: task.origin === 'USER_CREATED' && task.assignees.length === 1 ? 'PERSONAL' : 'TEAM', priority: task.priority, dueAt: dateTimeLocalValue(task.dueAt) }; }
function parsePriority(value: string): TaskPriority | null { for (const priority of taskPriorities) if (value === priority) return priority; return null; }

export function TaskFormPage({ eventId, taskId }: Readonly<{ eventId: string; taskId?: string }>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { invalidate } = useDataRefresh();
  const [state, setState] = useState<LoadState>({ phase: 'loading', event: null, task: null, members: [], message: null });
  const [form, setForm] = useState<FormState | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, phase: 'loading', message: null }));
    try {
      const [event, memberPage, task] = await Promise.all([getEvent(eventId), getEventMembers(eventId, { page: 1, pageSize: 100 }), taskId ? getTask(taskId) : Promise.resolve(null)]);
      if (task && task.eventId !== eventId) throw new Error('Bạn không có quyền truy cập nội dung này.');
      const canCreatePersonal = hasPermission(event.membership.permissions, 'task:create:self');
      const canCreateTeam = hasPermission(event.membership.permissions, 'task:create') && hasPermission(event.membership.permissions, 'task:assign');
      if (!taskId && !canCreatePersonal && !canCreateTeam) throw new Error('Bạn không có quyền tạo công việc trong sự kiện này.');
      if (task && !task.capabilities.canUpdate) throw new Error('Bạn không có quyền chỉnh sửa công việc này.');
      setState({ phase: 'ready', event, task, members: memberPage.items.filter((member) => member.status === 'ACTIVE'), message: null });
      const requestedMode = searchParams.get('mode') === 'TEAM' ? 'TEAM' : 'PERSONAL';
      const creationMode = requestedMode === 'TEAM' && canCreateTeam ? 'TEAM' : canCreatePersonal ? 'PERSONAL' : 'TEAM';
      setForm(task ? formFromTask(task) : emptyForm(event, searchParams.get('stageId') || '', creationMode));
    } catch (reason: unknown) { setState({ phase: 'error', event: null, task: null, members: [], message: errorMessage(reason) }); }
  }, [eventId, searchParams, taskId]);

  useEffect(() => { void load(); }, [load, retry]);
  const dirty = form !== null && (form.title !== '' || form.description !== '' || form.dueAt !== '' || files.length > 0);
  useEffect(() => { function beforeUnload(event: BeforeUnloadEvent): void { if (dirty && !pending) event.preventDefault(); } window.addEventListener('beforeunload', beforeUnload); return () => window.removeEventListener('beforeunload', beforeUnload); }, [dirty, pending]);

  function setField<Key extends keyof FormState>(key: Key, value: FormState[Key]): void { setForm((current) => current ? { ...current, [key]: value } : current); }
  function toggleAssignee(memberId: string): void { setForm((current) => { if (!current) return current; const selected = current.assigneeEventMemberIds.includes(memberId); return { ...current, assigneeEventMemberIds: selected ? current.assigneeEventMemberIds.filter((id) => id !== memberId) : [...current.assigneeEventMemberIds, memberId] }; }); }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const eventDetail = state.event;
    if (!form || !eventDetail) return;
    setFormError(null);
    const dueAt = isoFromDateTimeLocal(form.dueAt);
    const requiresAssignee = taskId ? state.task?.capabilities.canAssign === true : form.creationMode === 'TEAM';
    if (!form.title.trim() || !form.workflowStageId || !dueAt || (requiresAssignee && form.assigneeEventMemberIds.length === 0)) { setFormError('Vui lòng nhập tiêu đề, giai đoạn, deadline và người thực hiện khi giao việc cho đội ngũ.'); return; }
    for (const file of files) if (file.size > 10 * 1024 * 1024 || !allowedUploadTypes.includes(file.type)) { setFormError('Chỉ nhận PDF, Office, PNG/JPEG hoặc ZIP tối đa 10 MB.'); return; }
    setPending(true);
    try {
      const common = { title: form.title.trim(), description: form.description.trim() || null, workflowStageId: form.workflowStageId, departmentId: form.departmentId || null, priority: form.priority, dueAt };
      let task: TaskDetail;
      if (taskId) {
        task = await updateTask(taskId, common);
        if (state.task?.capabilities.canAssign) task = await replaceTaskAssignees(task.id, { eventMemberIds: form.assigneeEventMemberIds });
      } else task = await createTask(eventId, {
        ...common,
        creationMode: form.creationMode,
        ...(form.creationMode === 'TEAM' ? { assigneeEventMemberIds: form.assigneeEventMemberIds } : {}),
      });
      for (const file of files) await uploadTaskAttachment(task.id, file);
      invalidate(['my-events', `event:${eventId}`, `event-tasks:${eventId}`, `workflow:${eventId}`, 'my-tasks', `task:${task.id}`, 'calendar']);
      router.replace(`/app/events/${encodeURIComponent(eventId)}/tasks/${encodeURIComponent(task.id)}`);
    } catch (reason: unknown) { setFormError(errorMessage(reason)); }
    finally { setPending(false); }
  }

  function leave(): void { if (!dirty || window.confirm('Bạn có thay đổi chưa lưu. Rời trang này?')) router.push(`/app/events/${encodeURIComponent(eventId)}`); }
  if (state.phase === 'loading' || !form) return <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-10"><LoadingCards count={3} /></section>;
  if (state.phase === 'error' || !state.event) return <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-10"><ErrorState message={state.message || 'Không thể mở biểu mẫu.'} onRetry={() => setRetry((value) => value + 1)} /></section>;
  const visibleMembers = state.members.filter((member) => `${member.displayName || ''} ${member.email} ${member.department?.name || ''}`.toLocaleLowerCase('vi-VN').includes(memberSearch.toLocaleLowerCase('vi-VN')));
  const canCreatePersonal = hasPermission(state.event.membership.permissions, 'task:create:self');
  const canCreateTeam = hasPermission(state.event.membership.permissions, 'task:create') && hasPermission(state.event.membership.permissions, 'task:assign');
  const showAssignees = taskId ? state.task?.capabilities.canAssign === true : form.creationMode === 'TEAM';

  return <section className="mx-auto max-w-4xl px-4 py-7 sm:px-6 lg:px-10 lg:py-10"><Link href={`/app/events/${encodeURIComponent(eventId)}`} className="inline-flex min-h-11 items-center text-sm font-medium text-slate-600 hover:text-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100">← Quay lại sự kiện</Link><h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{taskId ? 'Chỉnh sửa công việc' : 'Tạo công việc'}</h1><p className="mt-2 text-sm text-slate-600">Công việc cá nhân luôn được giao cho chính bạn. Chỉ người có quyền giao việc mới có thể chọn đội ngũ.</p><form onSubmit={(event) => void submit(event)} className="mt-7 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">{!taskId && (canCreatePersonal || canCreateTeam) ? <fieldset><legend className="text-sm font-medium text-slate-700">Chế độ tạo công việc</legend><div className="mt-2 grid gap-3 sm:grid-cols-2">{canCreatePersonal ? <label className={`cursor-pointer rounded-xl border p-4 ${form.creationMode === 'PERSONAL' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200'}`}><input className="sr-only" type="radio" name="creation-mode" checked={form.creationMode === 'PERSONAL'} onChange={() => setField('creationMode', 'PERSONAL')} /><span className="block text-sm font-semibold text-slate-950">Công việc của tôi</span><span className="mt-1 block text-xs leading-5 text-slate-600">Tự tạo và tự nhận công việc.</span></label> : null}{canCreateTeam ? <label className={`cursor-pointer rounded-xl border p-4 ${form.creationMode === 'TEAM' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200'}`}><input className="sr-only" type="radio" name="creation-mode" checked={form.creationMode === 'TEAM'} onChange={() => setField('creationMode', 'TEAM')} /><span className="block text-sm font-semibold text-slate-950">Giao việc cho đội ngũ</span><span className="mt-1 block text-xs leading-5 text-slate-600">Chọn thành viên đang hoạt động trong sự kiện.</span></label> : null}</div></fieldset> : null}<label className="block text-sm font-medium text-slate-700" htmlFor="task-title">Tiêu đề<input id="task-title" required value={form.title} onChange={(event) => setField('title', event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100" /></label><label className="block text-sm font-medium text-slate-700" htmlFor="task-description">Mô tả<textarea id="task-description" rows={5} value={form.description} onChange={(event) => setField('description', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100" /></label><div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-medium text-slate-700" htmlFor="task-stage">Giai đoạn<select id="task-stage" required value={form.workflowStageId} onChange={(event) => setField('workflowStageId', event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"><option value="">Chọn giai đoạn</option>{state.event.workflowStages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select></label><label className="block text-sm font-medium text-slate-700" htmlFor="task-department">Bộ phận<select id="task-department" value={form.departmentId} onChange={(event) => setField('departmentId', event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"><option value="">Không phân bộ phận</option>{state.event.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><label className="block text-sm font-medium text-slate-700" htmlFor="task-priority">Ưu tiên<select id="task-priority" value={form.priority} onChange={(event) => { const priority = parsePriority(event.target.value); if (priority) setField('priority', priority); }} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100">{taskPriorities.map((priority) => <option key={priority} value={priority}>{priorityLabel(priority)}</option>)}</select></label><label className="block text-sm font-medium text-slate-700" htmlFor="task-due">Deadline<input id="task-due" type="datetime-local" required value={form.dueAt} onChange={(event) => setField('dueAt', event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100" /></label></div>{showAssignees ? <fieldset><legend className="text-sm font-medium text-slate-700">Người thực hiện</legend><input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} type="search" placeholder="Tìm thành viên trong sự kiện" className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100" /><div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-2">{visibleMembers.length === 0 ? <p className="p-3 text-sm text-slate-600">Không tìm thấy thành viên đang hoạt động.</p> : visibleMembers.map((member) => <label key={member.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50"><input type="checkbox" checked={form.assigneeEventMemberIds.includes(member.id)} onChange={() => toggleAssignee(member.id)} /><span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-900">{member.displayName || member.email}</span><span className="block truncate text-xs text-slate-500">{member.role} · {member.department?.name || 'Chưa phân bộ phận'}</span></span></label>)}</div></fieldset> : <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600">Công việc này được giao cho chính bạn; backend sẽ xác nhận người thực hiện theo membership hiện tại.</p>}<label className="block text-sm font-medium text-slate-700" htmlFor="task-files">Tệp đính kèm<input id="task-files" type="file" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} className="mt-2 block w-full text-sm text-slate-600" /><span className="mt-2 block text-xs font-normal text-slate-500">PDF, Office, PNG/JPEG hoặc ZIP; tối đa 10 MB/tệp. Tệp được tải sau khi lưu công việc.</span></label>{files.length > 0 ? <p className="text-sm text-slate-600">Đã chọn: {files.map((file) => file.name).join(', ')}</p> : null}{formError ? <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p> : null}<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" disabled={pending} onClick={leave} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-100">Hủy</button><button type="submit" disabled={pending} className="min-h-11 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:opacity-60">{pending ? 'Đang lưu…' : 'Lưu công việc'}</button></div></form></section>;
}
