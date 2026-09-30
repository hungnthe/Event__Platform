'use client';

import type { EventDelegatedPermission, EventMemberEffectivePermissions, EventMemberSummary, EventPermission } from '@eventflow/contracts';
import { useCallback, useEffect, useState } from 'react';
import { getEventMemberPermissions, updateEventMemberDelegatedTaskPermissions } from '../../lib/api-client';
import { errorMessage, formatDate, roleLabel } from '../../lib/event-ui';
import { ConfirmDialog } from '../ui/confirm-dialog';

interface PermissionOption {
  permission: EventDelegatedPermission;
  effectivePermission: EventPermission;
  label: string;
  description: string;
}

const permissionOptions: PermissionOption[] = [
  { permission: 'TASK_VIEW_ALL', effectivePermission: 'task:view:all', label: 'Xem tất cả công việc', description: 'Xem các công việc trong sự kiện theo quyền được cấp.' },
  { permission: 'TASK_CREATE', effectivePermission: 'task:create', label: 'Tạo công việc', description: 'Tạo công việc mới trong sự kiện.' },
  { permission: 'TASK_UPDATE_ANY', effectivePermission: 'task:update:any', label: 'Chỉnh sửa mọi công việc', description: 'Cập nhật thông tin công việc trong phạm vi sự kiện.' },
  { permission: 'TASK_ASSIGN', effectivePermission: 'task:assign', label: 'Giao công việc', description: 'Phân công công việc cho thành viên đang hoạt động.' },
  { permission: 'TASK_UPDATE_STATUS_ANY', effectivePermission: 'task:update-status:any', label: 'Cập nhật trạng thái mọi công việc', description: 'Cập nhật trạng thái công việc theo luồng hợp lệ.' },
  { permission: 'TASK_ARCHIVE', effectivePermission: 'task:archive', label: 'Lưu trữ công việc', description: 'Lưu trữ công việc thay vì xóa cứng.' },
];

function dateInputValue(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function nextExpiration(dateValue: string): string | null {
  if (!dateValue) return null;
  const date = new Date(`${dateValue}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

interface PermissionDelegationDialogProps {
  eventId: string;
  member: EventMemberSummary | null;
  onClose: () => void;
  onSaved: () => void;
}

export function PermissionDelegationDialog({ eventId, member, onClose, onSaved }: Readonly<PermissionDelegationDialogProps>) {
  const [details, setDetails] = useState<EventMemberEffectivePermissions | null>(null);
  const [selected, setSelected] = useState<EventDelegatedPermission[]>([]);
  const [expiryDate, setExpiryDate] = useState('');
  const [phase, setPhase] = useState<'idle' | 'loading' | 'saving' | 'error' | 'success'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [confirmTaskAssignRevocation, setConfirmTaskAssignRevocation] = useState(false);

  const load = useCallback(async () => {
    if (!member) return;
    setPhase('loading'); setMessage(null);
    try {
      const next = await getEventMemberPermissions(eventId, member.id);
      setDetails(next);
      setSelected(next.delegatedPermissions);
      const activeExpiringGrant = next.grants.find((grant) => grant.revokedAt === null && grant.expiresAt !== null);
      setExpiryDate(dateInputValue(activeExpiringGrant?.expiresAt ?? null));
      setPhase('idle');
    } catch (reason: unknown) {
      setPhase('error'); setMessage(errorMessage(reason));
    }
  }, [eventId, member]);

  useEffect(() => { if (member) void load(); }, [load, member]);

  if (!member) return null;
  const initialTaskAssign = details?.delegatedPermissions.includes('TASK_ASSIGN') ?? false;

  function toggle(permission: EventDelegatedPermission): void {
    if (phase === 'loading' || phase === 'saving') return;
    setSelected((current) => current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission]);
    setPhase('idle'); setMessage(null);
  }

  async function save(): Promise<void> {
    if (!member) return;
    const expiresAt = nextExpiration(expiryDate);
    if (expiryDate && (!expiresAt || new Date(expiresAt).getTime() <= Date.now())) {
      setPhase('error'); setMessage('Ngày hết hạn phải nằm trong tương lai.');
      return;
    }
    setPhase('saving'); setMessage(null);
    try {
      const next = await updateEventMemberDelegatedTaskPermissions(eventId, member.id, { permissions: selected, expiresAt });
      setDetails(next); setSelected(next.delegatedPermissions); setPhase('success'); setMessage('Đã cập nhật quyền quản lý công việc.');
      onSaved();
    } catch (reason: unknown) {
      setPhase('error'); setMessage(errorMessage(reason));
    }
  }

  function requestSave(): void {
    if (initialTaskAssign && !selected.includes('TASK_ASSIGN')) {
      setConfirmTaskAssignRevocation(true);
      return;
    }
    void save();
  }

  return <div className="fixed inset-0 z-40 flex items-end bg-slate-950/40 sm:items-center sm:justify-center sm:px-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && phase !== 'saving') onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="permission-delegation-title" className="max-h-[min(92vh,48rem)] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:max-w-2xl sm:rounded-3xl sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-indigo-700">THÀNH VIÊN SỰ KIỆN</p><h2 id="permission-delegation-title" className="mt-1 text-xl font-bold tracking-tight text-slate-950">Giao quyền quản lý công việc</h2><p className="mt-2 text-sm leading-6 text-slate-600">Quyền này chỉ có hiệu lực trong sự kiện hiện tại và được backend kiểm tra cho mọi thao tác.</p></div><button type="button" disabled={phase === 'saving'} onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-indigo-100" aria-label="Đóng">×</button></div>
      <article className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-950">{member.displayName || member.email}</p><p className="mt-1 text-sm text-slate-600">{member.email}</p><p className="mt-2 text-xs text-slate-500">{roleLabel(member.role)} · {member.department?.name || 'Chưa phân bộ phận'}</p></article>
      {phase === 'loading' ? <p role="status" className="py-10 text-center text-sm text-slate-600">Đang tải quyền hiện tại…</p> : <>
        <fieldset className="mt-6"><legend className="text-sm font-semibold text-slate-950">Quyền được giao thêm</legend><p className="mt-1 text-sm text-slate-600">Quyền theo vai trò được hiển thị riêng và không thể bị bỏ chọn tại đây.</p><div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">{permissionOptions.map((option) => {
          const inherited = details?.baseRolePermissions.includes(option.effectivePermission) ?? false;
          const delegated = selected.includes(option.permission);
          const grant = details?.grants.find((item) => item.permission === option.permission && item.revokedAt === null) ?? null;
          return <div key={option.permission} className="border-b border-slate-100 p-4 last:border-0"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-slate-900">{option.label}</span>{inherited ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Theo vai trò</span> : null}{delegated ? <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">Được giao thêm</span> : null}</div><p className="mt-1 text-sm leading-5 text-slate-600">{option.description}</p>{inherited ? <p className="mt-2 text-xs font-medium text-slate-500">✓ Có sẵn theo vai trò; không thể thay đổi tại đây.</p> : null}{grant?.expiresAt ? <p className="mt-1 text-xs text-amber-700">Hết hạn: {formatDate(grant.expiresAt, true)}</p> : null}<label className="mt-3 flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-indigo-700"><input type="checkbox" aria-label={`Giao thêm quyền ${option.label}`} checked={delegated} disabled={phase === 'saving'} onChange={() => toggle(option.permission)} className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-60" />{delegated ? 'Thu hồi quyền được giao thêm' : 'Giao thêm quyền này'}</label></div>;
        })}</div></fieldset>
        <fieldset className="mt-6"><legend className="text-sm font-semibold text-slate-950">Thời hạn quyền được giao</legend><div className="mt-3 flex flex-wrap items-center gap-3"><label className="flex min-h-11 items-center gap-2 text-sm text-slate-700"><input type="radio" name="expiration" checked={!expiryDate} disabled={phase === 'saving'} onChange={() => setExpiryDate('')} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500" />Không hết hạn</label><label className="flex min-h-11 items-center gap-2 text-sm text-slate-700"><input type="radio" name="expiration" checked={Boolean(expiryDate)} disabled={phase === 'saving'} onChange={() => setExpiryDate(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10))} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500" />Hết hạn vào ngày</label>{expiryDate ? <input type="date" aria-label="Ngày hết hạn" value={expiryDate} min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)} disabled={phase === 'saving'} onChange={(event) => setExpiryDate(event.target.value)} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100" /> : null}</div></fieldset>
      </>}
      {message ? <p role={phase === 'error' ? 'alert' : 'status'} className={`mt-4 text-sm ${phase === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{message}</p> : null}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" disabled={phase === 'saving'} onClick={onClose} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-60">Đóng</button><button type="button" disabled={phase === 'loading' || phase === 'saving'} onClick={requestSave} className="min-h-11 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:opacity-60">{phase === 'saving' ? 'Đang lưu…' : 'Lưu quyền'}</button></div>
    </section>
    <ConfirmDialog open={confirmTaskAssignRevocation} title="Thu hồi quyền giao công việc?" description="Thành viên này có thể đang quản lý công việc chưa hoàn tất. Việc thu hồi sẽ có hiệu lực ngay lập tức; các công việc hiện có không bị xóa." confirmLabel="Thu hồi và lưu" pending={phase === 'saving'} onCancel={() => setConfirmTaskAssignRevocation(false)} onConfirm={() => { setConfirmTaskAssignRevocation(false); void save(); }} />
  </div>;
}
