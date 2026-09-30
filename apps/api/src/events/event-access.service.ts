import { HttpStatus, Injectable } from '@nestjs/common';
import { EventDelegatedPermission, EventMemberRole, EventMemberStatus, TaskOrigin, UserStatus } from '@prisma/client';
import { DomainException } from '../common/domain.exception';
import { PrismaService } from '../prisma/prisma.service';
import {
  type EventPermission,
  eventPermissionForDelegated,
  permissionsForRole,
} from './event-permissions';

export interface EventMembershipRecord {
  id: string;
  eventId: string;
  userId: string;
  role: EventMemberRole;
  departmentId: string | null;
}

export interface EffectiveEventPermissions {
  baseRolePermissions: EventPermission[];
  delegatedPermissions: EventDelegatedPermission[];
  effectivePermissions: EventPermission[];
}

export interface TaskAccessRecord {
  departmentId: string | null;
  createdById?: string;
  origin?: TaskOrigin;
  assignees: Array<{ eventMemberId: string }>;
}

/**
 * The policy boundary for every event-scoped request. It intentionally reads
 * live grants from PostgreSQL on every authorization decision, so expiry and
 * revocation take effect on the next request rather than a later login.
 */
@Injectable()
export class EventAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireMembership(eventId: string, userId: string): Promise<EventMembershipRecord> {
    const membership = await this.prisma.eventMember.findFirst({
      where: {
        eventId,
        userId,
        status: EventMemberStatus.ACTIVE,
        user: { status: UserStatus.ACTIVE },
      },
      select: { id: true, eventId: true, userId: true, role: true, departmentId: true },
    });
    if (!membership) {
      throw new DomainException(HttpStatus.FORBIDDEN, 'EVENT_MEMBERSHIP_REQUIRED', 'Bạn không có quyền truy cập sự kiện này.');
    }
    return membership;
  }

  async effectivePermissionsFor(membership: EventMembershipRecord): Promise<EffectiveEventPermissions> {
    const now = new Date();
    const grants = await this.prisma.eventMemberPermissionGrant.findMany({
      where: {
        eventId: membership.eventId,
        granteeEventMemberId: membership.id,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { permission: true },
    });
    const baseRolePermissions = permissionsForRole(membership.role);
    const delegatedPermissions = [...new Set(grants.map((grant) => grant.permission))];
    const effectivePermissions = [...new Set([
      ...baseRolePermissions,
      ...delegatedPermissions.map(eventPermissionForDelegated),
    ])];
    return { baseRolePermissions, delegatedPermissions, effectivePermissions };
  }

  async requirePermission(eventId: string, userId: string, permission: EventPermission): Promise<EventMembershipRecord> {
    const membership = await this.requireMembership(eventId, userId);
    const effective = await this.effectivePermissionsFor(membership);
    if (!effective.effectivePermissions.includes(permission)) {
      throw new DomainException(HttpStatus.FORBIDDEN, 'EVENT_PERMISSION_DENIED', 'Bạn không có quyền thực hiện thao tác này.');
    }
    return membership;
  }

  async requireTaskView(task: TaskAccessRecord & { eventId: string }, userId: string): Promise<EventMembershipRecord> {
    const membership = await this.requireMembership(task.eventId, userId);
    const effective = await this.effectivePermissionsFor(membership);
    if (!this.canViewTask(membership, task, effective)) {
      throw new DomainException(HttpStatus.FORBIDDEN, 'TASK_ACCESS_DENIED', 'Bạn không có quyền xem công việc này.');
    }
    return membership;
  }

  canViewTask(membership: EventMembershipRecord, task: TaskAccessRecord, effective: EffectiveEventPermissions): boolean {
    if (this.hasGlobalTaskView(membership, effective)) return true;
    if (membership.role === EventMemberRole.DEPARTMENT_LEAD) {
      return membership.departmentId !== null && task.departmentId === membership.departmentId;
    }
    // A member exercising a live TASK_CREATE grant can manage the task they
    // created without that grant becoming an implicit event-wide task viewer.
    if (task.createdById === membership.userId && effective.effectivePermissions.includes('task:create')) return true;
    return task.assignees.some((assignee) => assignee.eventMemberId === membership.id);
  }

  canManageTask(
    membership: EventMembershipRecord,
    task: Pick<TaskAccessRecord, 'departmentId' | 'createdById' | 'origin' | 'assignees'>,
    effective: EffectiveEventPermissions,
  ): boolean {
    if (membership.role === EventMemberRole.OWNER || membership.role === EventMemberRole.COORDINATOR) return true;
    if (effective.delegatedPermissions.includes(EventDelegatedPermission.TASK_UPDATE_ANY)) return true;
    if (this.isOwnPersonalTask(membership, task)) return true;
    return membership.role === EventMemberRole.DEPARTMENT_LEAD
      && membership.departmentId !== null
      && membership.departmentId === task.departmentId
      && effective.effectivePermissions.includes('task:update:department');
  }

  canAssignTask(membership: EventMembershipRecord, task: TaskAccessRecord, effective: EffectiveEventPermissions): boolean {
    return effective.effectivePermissions.includes('task:assign') && this.canViewTask(membership, task, effective);
  }

  canArchiveTask(membership: EventMembershipRecord, task: TaskAccessRecord, effective: EffectiveEventPermissions): boolean {
    return (membership.role === EventMemberRole.OWNER || membership.role === EventMemberRole.COORDINATOR)
      || effective.delegatedPermissions.includes(EventDelegatedPermission.TASK_ARCHIVE)
      || (effective.effectivePermissions.includes('task:archive:own') && this.isOwnPersonalTask(membership, task));
  }

  canMoveTask(membership: EventMembershipRecord, task: TaskAccessRecord, effective: EffectiveEventPermissions): boolean {
    return this.canManageTask(membership, task, effective)
      || effective.delegatedPermissions.includes(EventDelegatedPermission.TASK_UPDATE_ANY);
  }

  canManageTaskStatus(membership: EventMembershipRecord, task: TaskAccessRecord, effective: EffectiveEventPermissions): boolean {
    if (membership.role === EventMemberRole.OWNER || membership.role === EventMemberRole.COORDINATOR) return true;
    if (effective.delegatedPermissions.includes(EventDelegatedPermission.TASK_UPDATE_STATUS_ANY)) return true;
    if (membership.role === EventMemberRole.DEPARTMENT_LEAD
      && membership.departmentId !== null
      && membership.departmentId === task.departmentId
      && effective.effectivePermissions.includes('task:update-status:any')) return true;
    return effective.effectivePermissions.includes('task:update-status:assigned')
      && task.assignees.some((assignee) => assignee.eventMemberId === membership.id);
  }

  canListAllTasks(membership: EventMembershipRecord, effective: EffectiveEventPermissions): 'global' | 'department' | null {
    if (this.hasGlobalTaskView(membership, effective)) return 'global';
    if (membership.role === EventMemberRole.DEPARTMENT_LEAD && membership.departmentId) return 'department';
    return null;
  }

  hasDelegatedPermission(effective: EffectiveEventPermissions, permission: EventDelegatedPermission): boolean {
    return effective.delegatedPermissions.includes(permission);
  }

  private hasGlobalTaskView(membership: EventMembershipRecord, effective: EffectiveEventPermissions): boolean {
    return membership.role === EventMemberRole.OWNER
      || membership.role === EventMemberRole.COORDINATOR
      || effective.delegatedPermissions.includes(EventDelegatedPermission.TASK_VIEW_ALL);
  }

  private isOwnPersonalTask(membership: EventMembershipRecord, task: Pick<TaskAccessRecord, 'createdById' | 'origin' | 'assignees'>): boolean {
    return task.origin === TaskOrigin.USER_CREATED
      && task.createdById === membership.userId
      && task.assignees.length === 1
      && task.assignees[0]?.eventMemberId === membership.id;
  }
}
