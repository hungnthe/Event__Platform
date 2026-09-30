import type { EventMemberRole, EventStatus, TaskOrigin, TaskPriority, TaskStatus } from '@eventflow/contracts';
import { eventStatusLabel, priorityLabel, roleLabel, taskStatusLabel } from '../../lib/event-ui';

function badgeClass(tone: 'neutral' | 'indigo' | 'emerald' | 'amber' | 'rose'): string {
  switch (tone) {
    case 'indigo': return 'bg-indigo-50 text-indigo-700 ring-indigo-100';
    case 'emerald': return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
    case 'amber': return 'bg-amber-50 text-amber-800 ring-amber-100';
    case 'rose': return 'bg-rose-50 text-rose-700 ring-rose-100';
    case 'neutral': return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
}

function Badge({ children, tone }: Readonly<{ children: React.ReactNode; tone: 'neutral' | 'indigo' | 'emerald' | 'amber' | 'rose' }>) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badgeClass(tone)}`}>{children}</span>;
}

export function RoleBadge({ role }: Readonly<{ role: EventMemberRole }>) { return <Badge tone="indigo">{roleLabel(role)}</Badge>; }

export function EventStatusBadge({ status }: Readonly<{ status: EventStatus }>) {
  const tone = status === 'ONGOING' ? 'emerald' : status === 'UPCOMING' ? 'indigo' : status === 'ENDED' || status === 'ARCHIVED' ? 'neutral' : 'amber';
  return <Badge tone={tone}>{eventStatusLabel(status)}</Badge>;
}

export function TaskStatusBadge({ status }: Readonly<{ status: TaskStatus }>) {
  const tone = status === 'DONE' ? 'emerald' : status === 'BLOCKED' ? 'rose' : status === 'IN_PROGRESS' ? 'indigo' : status === 'IN_REVIEW' ? 'amber' : 'neutral';
  return <Badge tone={tone}>{taskStatusLabel(status)}</Badge>;
}

export function PriorityBadge({ priority }: Readonly<{ priority: TaskPriority }>) {
  const tone = priority === 'URGENT' || priority === 'HIGH' ? 'rose' : priority === 'MEDIUM' ? 'amber' : 'neutral';
  return <Badge tone={tone}>{priorityLabel(priority)}</Badge>;
}

export function TaskOriginBadge({ origin }: Readonly<{ origin: TaskOrigin }>) {
  return <Badge tone={origin === 'WORKFLOW_TEMPLATE' ? 'indigo' : 'neutral'}>{origin === 'WORKFLOW_TEMPLATE' ? 'Mẫu quy trình' : 'Tự tạo'}</Badge>;
}
