import { EventDelegatedPermission, EventMemberRole } from '@prisma/client';

export type EventPermission =
  | 'event:view'
  | 'event:update'
  | 'event:archive'
  | 'event:delegate-task-permissions'
  | 'member:view'
  | 'member:add'
  | 'member:update-role'
  | 'member:remove'
  | 'task:view:assigned'
  | 'task:view:all'
  | 'task:create:self'
  | 'task:create'
  | 'task:update:any'
  | 'task:update:department'
  | 'task:move-stage'
  | 'task:assign'
  | 'task:update-status:assigned'
  | 'task:update-status:any'
  | 'task:archive'
  | 'task:archive:own'
  | 'workflow:initialize'
  | 'attachment:upload:assigned'
  | 'attachment:upload:any'
  | 'attachment:delete:own'
  | 'attachment:delete:any';

const ownerPermissions: EventPermission[] = [
  'event:view', 'event:update', 'event:archive', 'event:delegate-task-permissions',
  'member:view', 'member:add', 'member:update-role', 'member:remove',
  'task:view:assigned', 'task:view:all', 'task:create:self', 'task:create', 'task:update:any',
  'task:update:department', 'task:move-stage', 'task:assign', 'task:update-status:assigned',
  'task:update-status:any', 'task:archive', 'task:archive:own', 'workflow:initialize',
  'attachment:upload:assigned', 'attachment:upload:any',
  'attachment:delete:own', 'attachment:delete:any',
];

export function permissionsForRole(role: EventMemberRole): EventPermission[] {
  switch (role) {
    case EventMemberRole.OWNER:
      return ownerPermissions;
    case EventMemberRole.COORDINATOR:
      return [
        'event:view', 'event:update',
        'member:view', 'member:add', 'member:update-role', 'member:remove',
        'task:view:assigned', 'task:view:all', 'task:create:self', 'task:create', 'task:update:any',
        'task:move-stage', 'task:assign', 'task:update-status:assigned', 'task:update-status:any', 'task:archive', 'task:archive:own', 'workflow:initialize',
        'attachment:upload:assigned', 'attachment:upload:any', 'attachment:delete:own', 'attachment:delete:any',
      ];
    case EventMemberRole.DEPARTMENT_LEAD:
      return [
        'event:view', 'member:view', 'task:view:assigned', 'task:view:all',
        'task:create:self', 'task:create', 'task:update:department', 'task:move-stage', 'task:assign',
        'task:update-status:assigned', 'task:update-status:any',
        'attachment:upload:assigned', 'attachment:upload:any', 'attachment:delete:own', 'attachment:delete:any',
      ];
    case EventMemberRole.MEMBER:
    case EventMemberRole.VOLUNTEER:
      return ['event:view', 'member:view', 'task:view:assigned', 'task:create:self', 'task:update-status:assigned', 'task:archive:own', 'attachment:upload:assigned', 'attachment:delete:own'];
    case EventMemberRole.GUEST:
      return ['event:view', 'member:view', 'task:view:assigned'];
  }
}

export function hasEventPermission(role: EventMemberRole, permission: EventPermission): boolean {
  return permissionsForRole(role).includes(permission);
}

/**
 * Delegated permissions deliberately only expand task capabilities.  Keeping
 * this mapping in one place makes the authorization union auditable and
 * prevents a new grant enum value from accidentally becoming an implicit
 * platform or member-management permission.
 */
export const delegatedPermissionMap: Readonly<Record<EventDelegatedPermission, EventPermission>> = {
  [EventDelegatedPermission.TASK_VIEW_ALL]: 'task:view:all',
  [EventDelegatedPermission.TASK_CREATE]: 'task:create',
  [EventDelegatedPermission.TASK_UPDATE_ANY]: 'task:update:any',
  [EventDelegatedPermission.TASK_ASSIGN]: 'task:assign',
  [EventDelegatedPermission.TASK_UPDATE_STATUS_ANY]: 'task:update-status:any',
  [EventDelegatedPermission.TASK_ARCHIVE]: 'task:archive',
};

export function eventPermissionForDelegated(permission: EventDelegatedPermission): EventPermission {
  return delegatedPermissionMap[permission];
}
