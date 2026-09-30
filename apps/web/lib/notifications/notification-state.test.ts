import type { Notification } from '@eventflow/contracts';
import { describe, expect, it } from 'vitest';
import { isSafeInternalActionPath, mergeNotifications, unreadBadgeLabel } from './notification-state';

const notification: Notification = {
  id: 'notification-1',
  type: 'TASK_ASSIGNED',
  title: 'Bạn có công việc mới',
  body: 'Bạn được giao một công việc.',
  eventId: 'event-1',
  taskId: 'task-1',
  actionPath: '/app/events/event-1/tasks/task-1',
  payload: null,
  readAt: null,
  createdAt: '2026-09-30T10:00:00.000Z',
};

describe('notification client state', () => {
  it('deduplicates a socket notification by stable notification id', () => {
    const initial = mergeNotifications([], notification);
    const repeated = mergeNotifications(initial, { ...notification, title: 'Bản cập nhật không tạo mục mới' });
    expect(repeated).toHaveLength(1);
    expect(repeated[0]?.title).toBe('Bản cập nhật không tạo mục mới');
  });

  it('formats unread badge counts without rendering a badge at zero', () => {
    expect(unreadBadgeLabel(0)).toBeNull();
    expect(unreadBadgeLabel(7)).toBe('7');
    expect(unreadBadgeLabel(100)).toBe('99+');
  });

  it('accepts only internal EventFlow paths before navigation', () => {
    expect(isSafeInternalActionPath('/app/events/event-1/tasks/task-1')).toBe(true);
    expect(isSafeInternalActionPath('https://outside.example/app/events/1')).toBe(false);
    expect(isSafeInternalActionPath('//outside.example')).toBe(false);
    expect(isSafeInternalActionPath('javascript:alert(1)')).toBe(false);
  });
});
