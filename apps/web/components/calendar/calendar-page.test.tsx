import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  search: 'view=month&date=2026-10-15',
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/calendar',
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));
vi.mock('@fullcalendar/react', () => ({ default: () => null }));
vi.mock('../../lib/api-client', () => ({
  ApiRequestError: class ApiRequestError extends Error {},
  getCalendarItemDetail: vi.fn(),
  getCalendarItems: vi.fn(),
}));
vi.mock('../data-refresh-provider', () => ({ useDataVersion: () => 0 }));

import { CalendarPage } from './calendar-page';

describe('CalendarPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.search = 'view=month&date=2026-10-15';
  });

  it('renders the EventFlow calendar header and keeps navigation client-side', () => {
    render(<CalendarPage />);
    expect(screen.getByRole('heading', { name: 'Lịch sự kiện' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tháng' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('link', { name: /tạo sự kiện mới/i }).getAttribute('href')).toBe('/app/events/new');
    fireEvent.click(screen.getByRole('button', { name: 'Tuần' }));
    expect(mocks.replace).toHaveBeenCalledWith('/app/calendar?view=week&date=2026-10-15', { scroll: false });
    fireEvent.click(screen.getAllByRole('button', { name: 'Sự kiện' })[0]!);
    expect(mocks.replace).toHaveBeenCalledWith('/app/calendar?view=month&date=2026-10-15&sourceTypes=EVENT', { scroll: false });
  });
});
