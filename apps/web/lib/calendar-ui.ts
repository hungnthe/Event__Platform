import type { CalendarCategory } from '@eventflow/contracts';

export type CalendarView = 'month' | 'week' | 'day';

export const calendarCategories: Record<CalendarCategory, { label: string; pillClass: string; dotClass: string }> = {
  EVENT: { label: 'Sự kiện tôi tham gia', pillClass: 'bg-indigo-50 text-indigo-800 ring-indigo-200', dotClass: 'bg-indigo-500' },
  TASK: { label: 'Công việc', pillClass: 'bg-blue-50 text-blue-800 ring-blue-200', dotClass: 'bg-blue-500' },
  MEETING_INTERNAL: { label: 'Họp / Nội bộ', pillClass: 'bg-emerald-50 text-emerald-800 ring-emerald-200', dotClass: 'bg-emerald-500' },
  VOLUNTEER: { label: 'Tình nguyện', pillClass: 'bg-amber-50 text-amber-800 ring-amber-200', dotClass: 'bg-amber-500' },
  OTHER: { label: 'Khác', pillClass: 'bg-pink-50 text-pink-800 ring-pink-200', dotClass: 'bg-pink-500' },
};

export function calendarDateFromQuery(value: string | null): Date {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date();
  const [yearText, monthText, dayText] = value.match(/\d+/g) ?? [];
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const result = new Date(year, month - 1, day);
  return Number.isNaN(result.getTime()) || result.getFullYear() !== year || result.getMonth() !== month - 1 || result.getDate() !== day ? new Date() : result;
}

export function calendarDateQuery(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calendarViewFromQuery(value: string | null): CalendarView {
  return value === 'week' || value === 'day' ? value : 'month';
}

export function fullCalendarView(view: CalendarView): 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' {
  if (view === 'week') return 'timeGridWeek';
  if (view === 'day') return 'timeGridDay';
  return 'dayGridMonth';
}

export function moveCalendarDate(value: Date, view: CalendarView, direction: -1 | 1): Date {
  const next = new Date(value);
  if (view === 'month') next.setMonth(next.getMonth() + direction);
  else next.setDate(next.getDate() + direction * (view === 'week' ? 7 : 1));
  return next;
}

export function formatCalendarHeading(value: Date, view: CalendarView): string {
  if (view === 'day') return new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(value);
  if (view === 'week') return `Tuần của ${new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' }).format(value)}`;
  return new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(value);
}

export function formatCalendarDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa xác định';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }).format(date);
}

export function formatCalendarDateRange(startsAt: string, endsAt: string | null): string {
  const start = formatCalendarDateTime(startsAt);
  return endsAt ? `${start} – ${formatCalendarDateTime(endsAt)}` : start;
}
