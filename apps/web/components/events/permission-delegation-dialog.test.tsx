import type { EventMemberEffectivePermissions, EventMemberSummary } from '@eventflow/contracts';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  getEventMemberPermissions: vi.fn(),
  updateEventMemberDelegatedTaskPermissions: vi.fn(),
}));

vi.mock('../../lib/api-client', () => apiMocks);

import { PermissionDelegationDialog } from './permission-delegation-dialog';

const member: EventMemberSummary = {
  id: 'member-2',
  userId: 'user-2',
  displayName: 'Minh B',
  email: 'minh@example.com',
  role: 'MEMBER',
  status: 'ACTIVE',
  department: null,
  joinedAt: '2026-09-30T10:00:00.000Z',
};

const details: EventMemberEffectivePermissions = {
  eventId: 'event-1',
  eventMemberId: 'member-2',
  baseRolePermissions: ['task:view:all'],
  delegatedPermissions: ['TASK_ASSIGN'],
  effectivePermissions: ['task:view:all', 'task:assign'],
  grants: [{
    id: 'grant-1', eventId: 'event-1', granteeEventMemberId: 'member-2', permission: 'TASK_ASSIGN', grantedByEventMemberId: 'member-owner', grantedAt: '2026-09-30T10:00:00.000Z', expiresAt: null, revokedAt: null, revokedByEventMemberId: null,
  }],
};

describe('PermissionDelegationDialog', () => {
  beforeEach(() => {
    apiMocks.getEventMemberPermissions.mockResolvedValue(details);
    apiMocks.updateEventMemberDelegatedTaskPermissions.mockResolvedValue(details);
  });

  it('visually separates inherited permissions from delegated task permissions', async () => {
    render(<PermissionDelegationDialog eventId="event-1" member={member} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(await screen.findByText('Theo vai trò')).toBeTruthy();
    expect(screen.getByText(/Có sẵn theo vai trò; không thể thay đổi tại đây/i)).toBeTruthy();
    const taskAssignControl = screen.getByRole('checkbox', { name: /giao thêm quyền giao công việc/i });
    expect(taskAssignControl).toBeInstanceOf(HTMLInputElement);
    if (taskAssignControl instanceof HTMLInputElement) expect(taskAssignControl.checked).toBe(true);
  });
});
