'use client';

import type { EventDetail, EventMemberRole, EventMemberSummary, PaginatedResponse } from '@eventflow/contracts';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useDataRefresh, useDataVersion } from '../../../../../components/data-refresh-provider';
import { ConfirmDialog } from '../../../../../components/ui/confirm-dialog';
import { RoleBadge } from '../../../../../components/ui/badges';
import { EmptyState, ErrorState, LoadingCards } from '../../../../../components/ui/page-state';
import { PermissionDelegationDialog } from '../../../../../components/events/permission-delegation-dialog';
import { addEventMember, getEvent, getEventMembers, removeEventMember, updateEventMember } from '../../../../../lib/api-client';
import { errorMessage, eventMemberRoles, hasPermission, initials, roleLabel } from '../../../../../lib/event-ui';

interface State { phase: 'loading' | 'ready' | 'error'; event: EventDetail | null; members: PaginatedResponse<EventMemberSummary> | null; message: string | null; }
function parseRole(value: string): EventMemberRole | null { for (const role of eventMemberRoles) if (value === role) return role; return null; }

export function MembersPage({ eventId }: Readonly<{ eventId: string }>) {
  const { invalidate } = useDataRefresh();
  const version = useDataVersion(`event-members:${eventId}`);
  const [state, setState] = useState<State>({ phase: 'loading', event: null, members: null, message: null });
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<EventMemberRole | ''>('');
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState<EventMemberRole>('MEMBER');
  const [departmentId, setDepartmentId] = useState('');
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<EventMemberSummary | null>(null);
  const [delegationTarget, setDelegationTarget] = useState<EventMemberSummary | null>(null);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, phase: 'loading', message: null }));
    try {
      const memberQuery = { page, pageSize: 20, ...(query ? { search: query } : {}), ...(role ? { role } : {}) };
      const [event, members] = await Promise.all([getEvent(eventId), getEventMembers(eventId, memberQuery)]);
      setState({ phase: 'ready', event, members, message: null });
    } catch (reason: unknown) { setState({ phase: 'error', event: null, members: null, message: errorMessage(reason) }); }
  }, [eventId, page, query, role]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 250); return () => window.clearTimeout(timer); }, [load, retry, version]);
  function refreshAfterMutation(): void { invalidate([`event-members:${eventId}`, `event-membership:${eventId}`, `event:${eventId}`, 'my-events', 'calendar']); }

  async function addMember(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!email.trim() || pending) return;
    setPending(true); setFormError(null);
    try { await addEventMember(eventId, { email: email.trim(), role: newRole, departmentId: departmentId || null }); setEmail(''); setDepartmentId(''); setShowAdd(false); refreshAfterMutation(); }
    catch (reason: unknown) { setFormError(errorMessage(reason)); }
    finally { setPending(false); }
  }

  async function changeRole(member: EventMemberSummary, value: string): Promise<void> {
    const nextRole = parseRole(value);
    if (!nextRole || nextRole === member.role) return;
    try { await updateEventMember(eventId, member.id, { role: nextRole }); refreshAfterMutation(); }
    catch (reason: unknown) { setState((current) => ({ ...current, message: errorMessage(reason) })); }
  }

  async function confirmRemove(): Promise<void> {
    if (!removeTarget) return;
    setPending(true);
    try { await removeEventMember(eventId, removeTarget.id); setRemoveTarget(null); refreshAfterMutation(); }
    catch (reason: unknown) { setFormError(errorMessage(reason)); setRemoveTarget(null); }
    finally { setPending(false); }
  }

  if (state.phase === 'loading' && !state.event) return <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-10"><LoadingCards count={3} /></section>;
  if (state.phase === 'error' || !state.event || !state.members) return <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-10"><ErrorState message={state.message || 'Không thể tải thành viên.'} onRetry={() => setRetry((value) => value + 1)} /></section>;
  const event = state.event;
  const canAdd = hasPermission(event.membership.permissions, 'member:add');
  const canUpdateRole = hasPermission(event.membership.permissions, 'member:update-role');
  const canRemove = hasPermission(event.membership.permissions, 'member:remove');
  // Delegation is deliberately owner-only in Sprint 3. The API enforces this
  // independently; this only controls whether the action is discoverable.
  const canDelegateTaskPermissions = event.membership.role === 'OWNER';

  return <section className="mx-auto max-w-5xl px-4 py-7 sm:px-6 lg:px-10 lg:py-10"><Link href={`/app/events/${encodeURIComponent(eventId)}`} className="inline-flex min-h-11 items-center text-sm font-medium text-slate-600 hover:text-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100">← {event.name}</Link><div className="mt-3 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-indigo-700">THÀNH VIÊN</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Thành viên sự kiện</h1><p className="mt-2 text-sm text-slate-600">Chỉ quản lý thành viên trong phạm vi sự kiện này.</p></div>{canAdd ? <button type="button" onClick={() => setShowAdd((open) => !open)} className="min-h-11 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-indigo-200">Thêm thành viên</button> : null}</div>{showAdd && canAdd ? <form onSubmit={(event) => void addMember(event)} className="mt-5 grid gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 sm:grid-cols-4"><label className="sm:col-span-2"><span className="sr-only">Email thành viên</span><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@domain.com" className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100" /></label><select value={newRole} onChange={(event) => { const parsed = parseRole(event.target.value); if (parsed) setNewRole(parsed); }} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100">{eventMemberRoles.filter((value) => value !== 'OWNER').map((value) => <option key={value} value={value}>{roleLabel(value)}</option>)}</select><select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"><option value="">Không phân bộ phận</option>{event.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select>{formError ? <p role="alert" className="sm:col-span-4 text-sm text-rose-700">{formError}</p> : null}<div className="sm:col-span-4 flex justify-end gap-3"><button type="button" onClick={() => setShowAdd(false)} className="min-h-11 rounded-xl px-4 text-sm font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-100">Hủy</button><button type="submit" disabled={pending} className="min-h-11 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:opacity-60">{pending ? 'Đang thêm…' : 'Thêm'}</button></div></form> : null}<div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]"><label><span className="sr-only">Tìm thành viên</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} type="search" placeholder="Tìm theo tên hoặc email" className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100" /></label><select value={role} onChange={(event) => { const value = event.target.value; setRole(value === '' ? '' : parseRole(value) || ''); setPage(1); }} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"><option value="">Tất cả vai trò</option>{eventMemberRoles.map((value) => <option key={value} value={value}>{roleLabel(value)}</option>)}</select></div>{formError && !showAdd ? <p role="alert" className="mt-3 text-sm text-rose-700">{formError}</p> : null}<div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{state.members.items.length === 0 ? <EmptyState title="Không có thành viên phù hợp" description="Thử thay đổi từ khóa hoặc bộ lọc vai trò." /> : <ul className="divide-y divide-slate-100">{state.members.items.map((member) => <li key={member.id} className="flex min-w-0 flex-wrap items-center gap-3 p-4"><span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">{initials(member.displayName, member.email)}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-950">{member.displayName || member.email}</p><p className="truncate text-xs text-slate-500">{member.email} · {member.department?.name || 'Chưa phân bộ phận'}</p></div>{canUpdateRole ? <select value={member.role} aria-label={`Vai trò của ${member.displayName || member.email}`} onChange={(event) => void changeRole(member, event.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100">{eventMemberRoles.map((value) => <option key={value} value={value}>{roleLabel(value)}</option>)}</select> : <RoleBadge role={member.role} />}{canDelegateTaskPermissions && member.status === 'ACTIVE' && member.id !== event.membership.id ? <button type="button" onClick={() => setDelegationTarget(member)} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 focus:outline-none focus:ring-4 focus:ring-indigo-100">Giao quyền quản lý công việc</button> : null}{canRemove ? <button type="button" onClick={() => setRemoveTarget(member)} className="min-h-11 rounded-xl px-3 text-sm font-medium text-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-100">Xóa</button> : null}</li>)}</ul>}</div>{state.members.totalPages > 1 ? <nav aria-label="Phân trang thành viên" className="mt-5 flex items-center justify-between"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-medium disabled:opacity-50">Trước</button><span className="text-sm text-slate-600">Trang {state.members.page}/{state.members.totalPages}</span><button type="button" disabled={page >= state.members.totalPages} onClick={() => setPage((value) => value + 1)} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-medium disabled:opacity-50">Sau</button></nav> : null}<ConfirmDialog open={removeTarget !== null} title="Xóa thành viên khỏi sự kiện" description={removeTarget ? `Thành viên ${removeTarget.displayName || removeTarget.email} sẽ mất quyền truy cập ngay lập tức. Các công việc chưa hoàn tất có thể cần được phân công lại.` : ''} confirmLabel="Xóa thành viên" pending={pending} onCancel={() => setRemoveTarget(null)} onConfirm={() => void confirmRemove()} /><PermissionDelegationDialog eventId={eventId} member={delegationTarget} onClose={() => setDelegationTarget(null)} onSaved={refreshAfterMutation} /></section>;
}
