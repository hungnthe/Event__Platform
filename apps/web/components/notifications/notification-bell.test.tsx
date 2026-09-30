import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface NotificationStub {
  id: string;
  type: string;
  title: string;
  body: string;
  eventId: string | null;
  taskId: string | null;
  actionPath: string;
  createdAt: string;
  readAt: string | null;
}

interface BellContextMock {
  notifications: NotificationStub[];
  unreadCount: number;
  refreshNotificationCenter: () => Promise<void>;
  markAllAsRead: () => Promise<void>;
  openNotification: () => Promise<void>;
}

const mocks = vi.hoisted((): { context: BellContextMock } => ({
  context: {
    notifications: [],
    unreadCount: 0,
    refreshNotificationCenter: vi.fn(async () => undefined),
    markAllAsRead: vi.fn(async () => undefined),
    openNotification: vi.fn(async () => undefined),
  },
}));

vi.mock('./notification-provider', () => ({
  useNotifications: () => mocks.context,
}));

import { NotificationBell } from './notification-bell';

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.context.notifications = [];
    mocks.context.unreadCount = 0;
  });

  it('hides the unread badge at zero and caps an oversized count at 99+', () => {
    const { rerender } = render(<NotificationBell />);
    expect(screen.queryByText('99+')).toBeNull();
    mocks.context.unreadCount = 100;
    rerender(<NotificationBell />);
    expect(screen.getByText('99+')).toBeTruthy();
  });

  it('opens a real notification through the safe notification action', () => {
    mocks.context.notifications = [{
      id: 'notification-1', type: 'TASK_ASSIGNED', title: 'Bạn có công việc mới', body: 'Bạn được giao công việc Chuẩn bị sân khấu.', eventId: 'event-1', taskId: 'task-1', actionPath: '/app/events/event-1/tasks/task-1', createdAt: '2026-09-30T10:00:00.000Z', readAt: null,
    }];
    mocks.context.unreadCount = 1;
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole('button', { name: /thông báo, 1 chưa đọc/i }));
    fireEvent.click(screen.getByRole('button', { name: /bạn có công việc mới/i }));
    expect(mocks.context.openNotification).toHaveBeenCalledWith(expect.objectContaining({ id: 'notification-1', actionPath: '/app/events/event-1/tasks/task-1' }));
  });
});
