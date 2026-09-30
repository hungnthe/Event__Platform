import type { EventDetail } from '@eventflow/contracts';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createEvent: vi.fn(), replace: vi.fn(), push: vi.fn(), invalidate: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace, push: mocks.push }) }));
vi.mock('../../../../components/data-refresh-provider', () => ({ useDataRefresh: () => ({ invalidate: mocks.invalidate }) }));
vi.mock('../../../../lib/api-client', () => ({ createEvent: mocks.createEvent }));

import { EventCreateForm } from './event-create-form';

const createdEvent: EventDetail = {
  id: 'event-1', name: 'Workshop', description: null, locationName: 'Demo Hall', startsAt: '2026-10-10T09:00:00.000Z', endsAt: '2026-10-10T11:00:00.000Z', status: 'UPCOMING', coverUrl: null,
  createdAt: '2026-09-30T00:00:00.000Z', updatedAt: '2026-09-30T00:00:00.000Z', departments: [], workflowStages: [],
  membership: { id: 'member-1', eventId: 'event-1', role: 'OWNER', department: null, permissions: [], assignedTaskCount: 0, completedAssignedTaskCount: 0, percentage: 0 },
  progress: { eventId: 'event-1', overall: { completed: 0, total: 0, percentage: 0 }, currentUser: { completed: 0, total: 0, percentage: 0 }, stages: [] },
};

describe('EventCreateForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects an invalid date range before calling the API', async () => {
    render(<EventCreateForm />);
    fireEvent.change(screen.getByLabelText('Tên sự kiện'), { target: { value: 'Workshop' } });
    fireEvent.change(screen.getByLabelText('Bắt đầu'), { target: { value: '2026-10-10T12:00' } });
    fireEvent.change(screen.getByLabelText('Kết thúc'), { target: { value: '2026-10-10T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo sự kiện' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Thời gian bắt đầu phải trước thời gian kết thúc.');
    expect(mocks.createEvent).not.toHaveBeenCalled();
  });

  it('navigates to the created event and blocks duplicate submission while pending', async () => {
    let resolveCreate: ((value: EventDetail) => void) | undefined;
    mocks.createEvent.mockReturnValue(new Promise<EventDetail>((resolve) => { resolveCreate = resolve; }));
    render(<EventCreateForm />);
    fireEvent.change(screen.getByLabelText('Tên sự kiện'), { target: { value: 'Workshop' } });
    fireEvent.change(screen.getByLabelText('Bắt đầu'), { target: { value: '2026-10-10T09:00' } });
    fireEvent.change(screen.getByLabelText('Kết thúc'), { target: { value: '2026-10-10T11:00' } });
    const submit = screen.getByRole('button', { name: 'Tạo sự kiện' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(mocks.createEvent).toHaveBeenCalledTimes(1);
    resolveCreate?.(createdEvent);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/app/events/event-1'));
  });
});
