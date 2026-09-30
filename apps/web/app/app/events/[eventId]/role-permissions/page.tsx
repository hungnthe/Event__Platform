'use client';

import type { EventMembership, EventPermission } from '@eventflow/contracts';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useDataVersion } from '../../../../../components/data-refresh-provider';
import { RoleBadge } from '../../../../../components/ui/badges';
import { ErrorState, LoadingCards } from '../../../../../components/ui/page-state';
import { getEventMembership } from '../../../../../lib/api-client';
import { errorMessage, roleDescription } from '../../../../../lib/event-ui';

const permissionCatalog: Array<{ permission: EventPermission; label: string; description: string }> = [
  { permission: 'event:view', label: 'Xem sự kiện', description: 'Xem thông tin và tiến độ của sự kiện.' },
  { permission: 'event:update', label: 'Cập nhật sự kiện', description: 'Chỉnh sửa thông tin vận hành sự kiện.' },
  { permission: 'event:archive', label: 'Lưu trữ sự kiện', description: 'Đưa sự kiện vào trạng thái lưu trữ.' },
  { permission: 'member:view', label: 'Xem thành viên', description: 'Xem danh sách thành viên sự kiện.' },
  { permission: 'member:add', label: 'Thêm thành viên', description: 'Mời người dùng đang hoạt động vào sự kiện.' },
  { permission: 'member:update-role', label: 'Đổi vai trò thành viên', description: 'Cập nhật vai trò thành viên trong phạm vi được phép.' },
  { permission: 'member:remove', label: 'Xóa thành viên', description: 'Gỡ thành viên theo các ràng buộc công việc và chủ sự kiện.' },
  { permission: 'task:view:assigned', label: 'Xem công việc được giao', description: 'Xem các công việc bạn được giao.' },
  { permission: 'task:view:all', label: 'Xem mọi công việc', description: 'Xem các công việc trong phạm vi quyền của bạn.' },
  { permission: 'task:create', label: 'Tạo công việc', description: 'Tạo công việc trong phạm vi được phép.' },
  { permission: 'task:update:any', label: 'Cập nhật mọi công việc', description: 'Chỉnh sửa công việc trong sự kiện.' },
  { permission: 'task:update:department', label: 'Cập nhật công việc bộ phận', description: 'Chỉnh sửa công việc thuộc bộ phận của bạn.' },
  { permission: 'task:assign', label: 'Phân công công việc', description: 'Giao công việc cho thành viên đang hoạt động.' },
  { permission: 'task:update-status:assigned', label: 'Cập nhật trạng thái việc được giao', description: 'Cập nhật trạng thái trong luồng được phép.' },
  { permission: 'task:update-status:any', label: 'Cập nhật mọi trạng thái', description: 'Cập nhật trạng thái các công việc trong phạm vi quyền.' },
  { permission: 'task:archive', label: 'Lưu trữ công việc', description: 'Lưu trữ thay vì xóa cứng công việc.' },
  { permission: 'attachment:upload:assigned', label: 'Tải tệp lên việc được giao', description: 'Đính kèm tệp vào công việc của bạn.' },
  { permission: 'attachment:upload:any', label: 'Tải tệp lên mọi công việc', description: 'Đính kèm tệp trong phạm vi quyền.' },
  { permission: 'attachment:delete:own', label: 'Xóa tệp của mình', description: 'Xóa tệp do bạn tải lên.' },
  { permission: 'attachment:delete:any', label: 'Xóa mọi tệp', description: 'Xóa tệp trong phạm vi quyền.' },
];

interface State { phase: 'loading' | 'ready' | 'error'; membership: EventMembership | null; message: string | null; }

export default function RolePermissionsPage() {
  const params = useParams<{ eventId: string }>();
  const version = useDataVersion(`event-membership:${params.eventId}`);
  const [state, setState] = useState<State>({ phase: 'loading', membership: null, message: null });
  const [retry, setRetry] = useState(0);
  const load = useCallback(async () => { try { setState((current) => ({ ...current, phase: 'loading', message: null })); setState({ phase: 'ready', membership: await getEventMembership(params.eventId), message: null }); } catch (reason: unknown) { setState({ phase: 'error', membership: null, message: errorMessage(reason) }); } }, [params.eventId]);
  useEffect(() => { void load(); }, [load, retry, version]);
  if (state.phase === 'loading') return <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-10"><LoadingCards count={3} /></section>;
  if (state.phase === 'error' || !state.membership) return <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-10"><ErrorState message={state.message || 'Không thể tải quyền hạn.'} onRetry={() => setRetry((value) => value + 1)} /></section>;
  const membership = state.membership;
  return <section className="mx-auto max-w-4xl px-4 py-7 sm:px-6 lg:px-10 lg:py-10"><Link href={`/app/events/${encodeURIComponent(params.eventId)}`} className="inline-flex min-h-11 items-center text-sm font-medium text-slate-600 hover:text-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100">← Quay lại sự kiện</Link><p className="mt-4 text-sm font-semibold text-indigo-700">VAI TRÒ</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Vai trò & quyền hạn</h1><article className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Vai trò của bạn trong sự kiện</p><div className="mt-3"><RoleBadge role={membership.role} /></div><p className="mt-3 text-sm leading-6 text-slate-600">{roleDescription(membership.role)}{membership.department ? ` Bộ phận: ${membership.department.name}.` : ''}</p></article><section className="mt-6"><h2 className="text-lg font-semibold text-slate-950">Quyền được hệ thống cấp</h2><p className="mt-1 text-sm text-slate-600">Danh sách này dùng dữ liệu quyền trả về từ backend, không suy luận từ nhãn vai trò trên giao diện.</p><ul className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{permissionCatalog.map((item) => { const allowed = membership.permissions.includes(item.permission); return <li key={item.permission} className="flex gap-3 border-b border-slate-100 p-4 last:border-0"><span aria-hidden="true" className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm ${allowed ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{allowed ? '✓' : '–'}</span><div><p className="text-sm font-semibold text-slate-900">{allowed ? 'Được phép: ' : 'Không được phép: '}{item.label}</p><p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p></div></li>; })}</ul></section></section>;
}
