import type { MyEventCard } from '@eventflow/contracts';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EventCard } from './event-card';

const event: MyEventCard = {
  id: 'event-123',
  name: 'Đêm nhạc Tỏa Sáng',
  description: 'Sự kiện thử nghiệm từ dữ liệu API.',
  locationName: 'Nhà hát Thành phố',
  startsAt: '2026-10-10T10:00:00.000Z',
  endsAt: '2026-10-10T15:00:00.000Z',
  status: 'UPCOMING',
  coverUrl: null,
  eventRole: 'MEMBER',
  assignedTaskCount: 4,
  completedAssignedTaskCount: 2,
  percentage: 50,
  remainingTimeLabel: 'Còn 10 ngày',
};

describe('EventCard', () => {
  it('links to the real event route and presents personal progress from its API card', () => {
    render(<EventCard event={event} />);
    const link = screen.getByRole('link', { name: /Đêm nhạc Tỏa Sáng/i });
    expect(link.getAttribute('href')).toBe('/app/events/event-123');
    expect(screen.getByText('2/4 · 50%')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50');
    expect(screen.getByText('Còn 10 ngày')).toBeTruthy();
  });
});
