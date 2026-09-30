import type { MyEventCard } from '@eventflow/contracts';
import Link from 'next/link';
import { formatDateRange } from '../../lib/event-ui';
import { EventStatusBadge, RoleBadge } from '../ui/badges';
import { ProgressBar } from '../ui/progress-bar';

export function EventCard({ event }: Readonly<{ event: MyEventCard }>) {
  const cover = event.coverUrl || '/demo/events/event-placeholder.svg';
  return <Link href={`/app/events/${encodeURIComponent(event.id)}`} className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-indigo-200 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-indigo-100">
    <article className="flex min-w-0 flex-col sm:flex-row">
      <img src={cover} alt="" className="h-36 w-full shrink-0 object-cover sm:h-auto sm:w-44" />
      <div className="min-w-0 flex-1 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2"><EventStatusBadge status={event.status} /><RoleBadge role={event.eventRole} /><span className="ml-auto text-xl text-slate-400 transition group-hover:translate-x-0.5" aria-hidden="true">›</span></div>
        <h2 className="mt-3 truncate text-lg font-semibold text-slate-950">{event.name}</h2>
        <p className="mt-1 text-sm text-slate-600">{formatDateRange(event.startsAt, event.endsAt)}{event.locationName ? ` · ${event.locationName}` : ''}</p>
        {event.description ? <p className="mt-3 hidden text-sm leading-6 text-slate-600 sm:block">{event.description}</p> : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><div><div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium text-slate-700">Tiến độ công việc của bạn</span><span className="shrink-0 text-slate-600">{event.completedAssignedTaskCount}/{event.assignedTaskCount} · {Math.round(event.percentage)}%</span></div><div className="mt-2"><ProgressBar value={event.percentage} label={`Tiến độ cá nhân trong ${event.name}`} /></div></div><span className="text-sm font-medium text-slate-600">{event.remainingTimeLabel || 'Đã hoàn tất'}</span></div>
      </div>
    </article>
  </Link>;
}
