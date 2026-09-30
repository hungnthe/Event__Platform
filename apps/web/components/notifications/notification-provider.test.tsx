import type { EventProgressUpdatedSocketPayload, Notification, NotificationCreatedSocketPayload, NotificationListResponse, NotificationPreference } from '@eventflow/contracts';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type SocketHandler = (payload?: unknown) => void;

const socketMocks = vi.hoisted(() => {
  const handlers = new Map<string, SocketHandler>();
  return {
    handlers,
    socket: {
      on: vi.fn((event: string, handler: SocketHandler) => { handlers.set(event, handler); }),
      connect: vi.fn(),
      disconnect: vi.fn(),
      io: { on: vi.fn() },
    },
    emit(event: string, payload: unknown): void { handlers.get(event)?.(payload); },
  };
});

const apiMocks = vi.hoisted(() => ({
  apiBaseUrl: 'http://api.test',
  getNotificationPreferences: vi.fn(),
  getNotifications: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
  updateNotificationPreferences: vi.fn(),
}));
const refreshMocks = vi.hoisted(() => ({ invalidate: vi.fn() }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/events/event-1',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('socket.io-client', () => ({ io: () => socketMocks.socket }));
vi.mock('../authenticated-app', () => ({
  useAuthenticatedUser: () => ({ user: { id: 'recipient-1', email: 'recipient@example.com', displayName: 'Người nhận', systemRole: 'USER', status: 'ACTIVE', mustChangePassword: false, permissions: [] } }),
}));
vi.mock('../data-refresh-provider', () => ({ useDataRefresh: () => refreshMocks }));
vi.mock('../../lib/api-client', () => apiMocks);

import { NotificationProvider, useNotifications } from './notification-provider';

const notification: Notification = {
  id: 'notification-1',
  type: 'TASK_ASSIGNED',
  title: 'Bạn có công việc mới',
  body: 'Bạn được giao công việc Chuẩn bị sân khấu.',
  eventId: 'event-1',
  taskId: 'task-1',
  actionPath: '/app/events/event-1/tasks/task-1',
  payload: null,
  readAt: null,
  createdAt: '2026-09-30T10:00:00.000Z',
};

const listResponse: NotificationListResponse = { items: [], page: 1, pageSize: 20, total: 0, totalPages: 1, unreadCount: 0 };
const preference: NotificationPreference = { inAppEnabled: true, soundEnabled: true, desktopEnabled: false };

function Probe() {
  const { toasts, unreadCount } = useNotifications();
  return <p><span data-testid="toast-count">{toasts.length}</span><span data-testid="unread-count">{unreadCount}</span></p>;
}

describe('NotificationProvider', () => {
  beforeEach(() => {
    socketMocks.handlers.clear();
    vi.clearAllMocks();
    window.localStorage.clear();
    apiMocks.getNotificationPreferences.mockResolvedValue(preference);
    apiMocks.getNotifications.mockResolvedValue(listResponse);
    apiMocks.getUnreadNotificationCount.mockResolvedValue(0);
    apiMocks.markAllNotificationsRead.mockResolvedValue({ readAt: '2026-09-30T10:00:00.000Z', unreadCount: 0 });
    apiMocks.markNotificationRead.mockResolvedValue({ notification: { ...notification, readAt: '2026-09-30T10:01:00.000Z' }, unreadCount: 0 });
    apiMocks.updateNotificationPreferences.mockResolvedValue(preference);
  });

  it('deduplicates progress events and invalidates every affected projection', async () => {
    render(<NotificationProvider><Probe /></NotificationProvider>);
    await waitFor(() => expect(apiMocks.getNotificationPreferences).toHaveBeenCalled());
    const payload: EventProgressUpdatedSocketPayload = {
      version: 1,
      eventId: 'event-1',
      changedTaskId: 'task-1',
      overall: { completed: 1, total: 2, percentage: 50 },
      stage: { workflowStageId: 'stage-1', code: 'PREPARATION', name: 'Chuẩn bị', order: 2, completed: 1, total: 2, percentage: 50 },
      updatedAt: '2026-09-30T13:00:00.000Z',
    };
    await act(async () => {
      socketMocks.emit('event.progress.updated', payload);
      socketMocks.emit('event.progress.updated', payload);
    });
    expect(refreshMocks.invalidate).toHaveBeenCalledTimes(1);
    expect(refreshMocks.invalidate).toHaveBeenCalledWith(expect.arrayContaining([
      'event:event-1', 'event-tasks:event-1', 'workflow:event-1', 'task:task-1', 'my-events', 'my-tasks',
    ]));
  });

  it('deduplicates duplicate socket delivery into one toast and one chime', async () => {
    const start = vi.fn();
    class TestAudioContext {
      state: AudioContextState = 'suspended';
      currentTime = 0;
      destination = {};
      async resume(): Promise<void> { this.state = 'running'; }
      createOscillator() { return { type: 'sine', frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(), start, stop: vi.fn() }; }
      createGain() { return { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() }; }
    }
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: TestAudioContext });

    render(<NotificationProvider><Probe /></NotificationProvider>);
    await waitFor(() => expect(apiMocks.getNotificationPreferences).toHaveBeenCalled());
    await act(async () => {
      fireEvent.pointerDown(window);
      await Promise.resolve();
    });
    const payload: NotificationCreatedSocketPayload = { version: 1, notification, unreadCount: 1 };
    await act(async () => {
      socketMocks.emit('notification.created', payload);
      socketMocks.emit('notification.created', payload);
    });

    expect(screen.getByTestId('toast-count').textContent).toBe('1');
    expect(screen.getByTestId('unread-count').textContent).toBe('1');
    expect(start).toHaveBeenCalledTimes(1);
  });
});
