import { EventDelegatedPermission, EventMemberRole } from '@prisma/client';
import { EventAccessService, type EventMembershipRecord } from './event-access.service';

const member: EventMembershipRecord = {
  id: 'member-b',
  eventId: 'event-1',
  userId: 'user-b',
  role: EventMemberRole.MEMBER,
  departmentId: null,
};

function accessWithGrants(permissions: EventDelegatedPermission[]): EventAccessService {
  return new EventAccessService({
    eventMemberPermissionGrant: {
      findMany: jest.fn().mockResolvedValue(permissions.map((permission) => ({ permission }))),
    },
  } as never);
}

describe('EventAccessService delegated task permissions', () => {
  it('unions current grants with role permissions without turning TASK_CREATE into global task visibility', async () => {
    const access = accessWithGrants([EventDelegatedPermission.TASK_CREATE, EventDelegatedPermission.TASK_ASSIGN]);
    const effective = await access.effectivePermissionsFor(member);

    expect(effective.effectivePermissions).toEqual(expect.arrayContaining(['task:create', 'task:assign', 'task:view:assigned']));
    expect(effective.effectivePermissions).not.toContain('task:view:all');
    expect(access.canViewTask(member, { departmentId: null, createdById: member.userId, assignees: [] }, effective)).toBe(true);
    expect(access.canViewTask(member, { departmentId: null, createdById: 'another-user', assignees: [] }, effective)).toBe(false);
    expect(access.canAssignTask(member, { departmentId: null, createdById: member.userId, assignees: [] }, effective)).toBe(true);
    expect(access.canAssignTask(member, { departmentId: null, createdById: 'another-user', assignees: [] }, effective)).toBe(false);
  });

  it('makes TASK_VIEW_ALL a global view grant but leaves unrelated task mutations denied', async () => {
    const access = accessWithGrants([EventDelegatedPermission.TASK_VIEW_ALL]);
    const effective = await access.effectivePermissionsFor(member);
    const task = { departmentId: null, createdById: 'another-user', assignees: [] };

    expect(access.canListAllTasks(member, effective)).toBe('global');
    expect(access.canViewTask(member, task, effective)).toBe(true);
    expect(access.canAssignTask(member, task, effective)).toBe(false);
    expect(access.canManageTask(member, task, effective)).toBe(false);
  });

  it('treats TASK_UPDATE_STATUS_ANY as a server-side global status authority', async () => {
    const access = accessWithGrants([EventDelegatedPermission.TASK_UPDATE_STATUS_ANY]);
    const effective = await access.effectivePermissionsFor(member);

    expect(access.canManageTaskStatus(member, { departmentId: null, assignees: [] }, effective)).toBe(true);
  });
});
