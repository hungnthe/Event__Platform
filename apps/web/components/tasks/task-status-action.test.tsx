import type { TaskDetail, UpdateTaskStatusResponse } from '@eventflow/contracts';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ updateTaskStatus: vi.fn() }));
vi.mock('../../lib/api-client', () => ({ updateTaskStatus: api.updateTaskStatus }));
import { TaskStatusAction } from './task-status-action';

const task: TaskDetail = {
  id: 'task-1', eventId: 'event-1', eventName: 'Workshop', title: 'Liên hệ nhà cung cấp âm thanh', description: null, status: 'NOT_STARTED', priority: 'HIGH', origin: 'USER_CREATED', templateKey: null,
  dueAt: '2026-10-09T09:00:00.000Z', completedAt: null, workflowStage: { id: 'stage-1', code: 'PREPARATION', name: 'Chuẩn bị', order: 2 }, department: null,
  assignees: [], isOverdue: false, capabilities: { canView: true, canUpdate: false, canMoveStage: false, canAssign: false, canArchive: false, canUploadAttachment: false, allowedStatusTransitions: ['IN_PROGRESS'] },
  assignedBy: { userId: 'owner-1', displayName: 'Owner', email: 'owner@example.com', role: 'OWNER' }, createdAt: '2026-09-30T00:00:00.000Z', updatedAt: '2026-09-30T00:00:00.000Z', attachments: [],
};

describe('TaskStatusAction', () => {
  it('uses the backend mutation for the start-work action', async () => {
    const updated: TaskDetail = { ...task, status: 'IN_PROGRESS', capabilities: { ...task.capabilities, allowedStatusTransitions: ['BLOCKED', 'DONE'] } };
    const response: UpdateTaskStatusResponse = { task: updated, progress: { eventId: 'event-1', overall: { completed: 0, total: 2, percentage: 0 }, currentUser: { completed: 0, total: 1, percentage: 0 }, stages: [] } };
    api.updateTaskStatus.mockResolvedValue(response);
    const onUpdated = vi.fn();
    render(<TaskStatusAction task={task} onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu công việc' }));
    await waitFor(() => expect(api.updateTaskStatus).toHaveBeenCalledWith('task-1', { status: 'IN_PROGRESS' }));
    expect(onUpdated).toHaveBeenCalledWith(updated);
  });
});
