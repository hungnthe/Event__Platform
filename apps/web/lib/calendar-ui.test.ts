import { describe, expect, it } from 'vitest';
import {
  calendarCategories,
  calendarDateFromQuery,
  calendarDateQuery,
  calendarViewFromQuery,
  fullCalendarView,
  moveCalendarDate,
} from './calendar-ui';

describe('calendar UI helpers', () => {
  it('parses and serializes local calendar dates without UTC day drift', () => {
    const value = calendarDateFromQuery('2026-10-01');
    expect(value.getFullYear()).toBe(2026);
    expect(value.getMonth()).toBe(9);
    expect(value.getDate()).toBe(1);
    expect(calendarDateQuery(value)).toBe('2026-10-01');
  });

  it('falls back safely for invalid URL view and date state', () => {
    expect(calendarViewFromQuery('agenda')).toBe('month');
    expect(calendarViewFromQuery('week')).toBe('week');
    expect(Number.isNaN(calendarDateFromQuery('2026-13-40').getTime())).toBe(false);
  });

  it('moves by the active visible unit without changing view routes', () => {
    const date = new Date(2026, 0, 15);
    expect(calendarDateQuery(moveCalendarDate(date, 'month', 1))).toBe('2026-02-15');
    expect(calendarDateQuery(moveCalendarDate(date, 'week', -1))).toBe('2026-01-08');
    expect(fullCalendarView('day')).toBe('timeGridDay');
  });

  it('maps every semantic category to a readable label and design token', () => {
    expect(calendarCategories.EVENT.label).toBe('Sự kiện tôi tham gia');
    expect(calendarCategories.TASK.dotClass).toContain('blue');
    expect(calendarCategories.MEETING_INTERNAL.label).toBe('Họp / Nội bộ');
  });
});
