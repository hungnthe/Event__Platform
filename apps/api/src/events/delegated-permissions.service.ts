import { HttpStatus, Injectable } from '@nestjs/common';
import type { AuthUser, DelegatedPermissionGrant, EventMemberEffectivePermissions } from '@eventflow/contracts';
import { EventDelegatedPermission, EventMemberRole, EventMemberStatus, EventStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { DomainException } from '../common/domain.exception';
import { NotificationFactory } from '../notifications/notification-factory.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventAccessService, type EventMembershipRecord } from './event-access.service';
import { UpdateDelegatedPermissionsDto } from './dto/delegated-permission.dto';

@Injectable()
export class DelegatedPermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationFactory,
  ) {}

  async get(eventId: string, eventMemberId: string, actorUserId: string): Promise<EventMemberEffectivePermissions> {
    await this.requireOwner(eventId, actorUserId);
    const target = await this.findActiveTarget(eventId, eventMemberId);
    return this.responseFor(target);
  }

  /** A member may inspect only their own effective task permissions. */
  async getCurrent(eventId: string, userId: string): Promise<EventMemberEffectivePermissions> {
    return this.responseFor(await this.access.requireMembership(eventId, userId));
  }

  async update(
    eventId: string,
    eventMemberId: string,
    actor: AuthUser,
    dto: UpdateDelegatedPermissionsDto,
  ): Promise<EventMemberEffectivePermissions> {
    const expiresAt = this.parseExpiry(dto.expiresAt);
    const desired = new Set(dto.permissions);
    await this.prisma.$transaction(async (transaction) => {
      // Follow the Event -> EventMember lock order used by member removal.
      // This serializes full-state permission replacements and prevents two
      // concurrent first grants from racing the unique current-state row.
      const lockedEvents = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Event" WHERE "id" = CAST(${eventId} AS uuid) FOR UPDATE
      `;
      if (lockedEvents.length === 0) throw this.notFound('EVENT_NOT_FOUND', 'Không tìm thấy sự kiện.');
      const event = await transaction.event.findUnique({
        where: { id: eventId },
        select: { id: true, name: true, archivedAt: true, status: true },
      });
      if (!event) throw this.notFound('EVENT_NOT_FOUND', 'Không tìm thấy sự kiện.');
      if (event.archivedAt || event.status === EventStatus.ARCHIVED) {
        throw new DomainException(HttpStatus.CONFLICT, 'EVENT_ARCHIVED', 'Không thể thay đổi quyền của sự kiện đã lưu trữ.');
      }

      await transaction.$queryRaw`
        SELECT "id" FROM "EventMember"
        WHERE "id" = CAST(${eventMemberId} AS uuid) AND "eventId" = CAST(${eventId} AS uuid)
        FOR UPDATE
      `;

      const [actorMembership, target] = await Promise.all([
        transaction.eventMember.findFirst({
          where: { eventId, userId: actor.id, status: EventMemberStatus.ACTIVE },
          select: { id: true, userId: true, role: true },
        }),
        transaction.eventMember.findFirst({
          where: { id: eventMemberId, eventId, status: EventMemberStatus.ACTIVE, user: { status: 'ACTIVE' } },
          select: { id: true, userId: true, role: true, departmentId: true, eventId: true },
        }),
      ]);
      if (!actorMembership || actorMembership.role !== EventMemberRole.OWNER) {
        throw this.forbidden('EVENT_PERMISSION_DELEGATION_FORBIDDEN', 'Chỉ OWNER có thể cấp hoặc thu hồi quyền công việc.');
      }
      if (!target) throw this.notFound('EVENT_PERMISSION_GRANTEE_INACTIVE', 'Thành viên nhận quyền không còn hoạt động trong sự kiện.');

      const now = new Date();
      const existing = await transaction.eventMemberPermissionGrant.findMany({
        where: { eventId, granteeEventMemberId: target.id },
      });
      const existingByPermission = new Map(existing.map((grant) => [grant.permission, grant]));

      for (const permission of Object.values(EventDelegatedPermission)) {
        const grant = existingByPermission.get(permission);
        const isActive = Boolean(grant && !grant.revokedAt && (!grant.expiresAt || grant.expiresAt > now));
        if (desired.has(permission)) {
          if (!isActive || grant?.expiresAt?.getTime() !== expiresAt?.getTime()) {
            const saved = grant
              ? await transaction.eventMemberPermissionGrant.update({
                where: { id: grant.id },
                data: {
                  grantedByEventMemberId: actorMembership.id,
                  grantedAt: now,
                  expiresAt,
                  revokedAt: null,
                  revokedByEventMemberId: null,
                },
              })
              : await transaction.eventMemberPermissionGrant.create({
                data: {
                  eventId,
                  granteeEventMemberId: target.id,
                  permission,
                  grantedByEventMemberId: actorMembership.id,
                  expiresAt,
                },
              });
            await this.audit.record(transaction, {
              actorUserId: actor.id,
              action: 'EVENT_PERMISSION_GRANTED',
              targetType: 'EventMemberPermissionGrant',
              targetId: saved.id,
              metadata: { eventId, eventMemberId: target.id, permission, expiresAt: expiresAt?.toISOString() ?? null },
            });
            await this.notifications.createPermissionChangedNotification(transaction, {
              eventId,
              recipientUserId: target.userId,
              actorUserId: actor.id,
              eventName: event.name,
              granted: true,
              permissionLabel: permission,
              changeId: `${saved.id}:${saved.grantedAt.getTime()}`,
            });
          }
        } else if (isActive && grant) {
          const revoked = await transaction.eventMemberPermissionGrant.update({
            where: { id: grant.id },
            data: { revokedAt: now, revokedByEventMemberId: actorMembership.id },
          });
          await this.audit.record(transaction, {
            actorUserId: actor.id,
            action: 'EVENT_PERMISSION_REVOKED',
            targetType: 'EventMemberPermissionGrant',
            targetId: revoked.id,
            metadata: { eventId, eventMemberId: target.id, permission },
          });
          await this.notifications.createPermissionChangedNotification(transaction, {
            eventId,
            recipientUserId: target.userId,
            actorUserId: actor.id,
            eventName: event.name,
            granted: false,
            permissionLabel: permission,
            changeId: `${revoked.id}:${revoked.revokedAt?.getTime() ?? now.getTime()}`,
          });
        }
      }
    });
    return this.get(eventId, eventMemberId, actor.id);
  }

  private async requireOwner(eventId: string, userId: string): Promise<EventMembershipRecord> {
    const membership = await this.access.requireMembership(eventId, userId);
    if (membership.role !== EventMemberRole.OWNER) {
      throw this.forbidden('EVENT_PERMISSION_DELEGATION_FORBIDDEN', 'Chỉ OWNER có thể xem hoặc thay đổi quyền công việc.');
    }
    return membership;
  }

  private async findActiveTarget(eventId: string, eventMemberId: string): Promise<EventMembershipRecord> {
    const target = await this.prisma.eventMember.findFirst({
      where: { id: eventMemberId, eventId, status: EventMemberStatus.ACTIVE, user: { status: 'ACTIVE' } },
      select: { id: true, eventId: true, userId: true, role: true, departmentId: true },
    });
    if (!target) throw this.notFound('EVENT_PERMISSION_GRANTEE_INACTIVE', 'Thành viên nhận quyền không còn hoạt động trong sự kiện.');
    return target;
  }

  private async responseFor(target: EventMembershipRecord): Promise<EventMemberEffectivePermissions> {
    const [effective, grants] = await Promise.all([
      this.access.effectivePermissionsFor(target),
      this.prisma.eventMemberPermissionGrant.findMany({
        where: { eventId: target.eventId, granteeEventMemberId: target.id },
        orderBy: { permission: 'asc' },
      }),
    ]);
    return {
      eventId: target.eventId,
      eventMemberId: target.id,
      baseRolePermissions: effective.baseRolePermissions,
      delegatedPermissions: effective.delegatedPermissions,
      effectivePermissions: effective.effectivePermissions,
      grants: grants.map((grant): DelegatedPermissionGrant => ({
        id: grant.id,
        eventId: grant.eventId,
        granteeEventMemberId: grant.granteeEventMemberId,
        permission: grant.permission,
        grantedByEventMemberId: grant.grantedByEventMemberId,
        grantedAt: grant.grantedAt.toISOString(),
        expiresAt: grant.expiresAt?.toISOString() ?? null,
        revokedAt: grant.revokedAt?.toISOString() ?? null,
        revokedByEventMemberId: grant.revokedByEventMemberId,
      })),
    };
  }

  private parseExpiry(value: string | null | undefined): Date | null {
    if (!value) return null;
    const expiresAt = new Date(value);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      throw new DomainException(HttpStatus.BAD_REQUEST, 'EVENT_PERMISSION_EXPIRY_INVALID', 'Thời hạn quyền phải nằm trong tương lai.');
    }
    return expiresAt;
  }

  private forbidden(code: string, message: string): DomainException {
    return new DomainException(HttpStatus.FORBIDDEN, code, message);
  }

  private notFound(code: string, message: string): DomainException {
    return new DomainException(HttpStatus.NOT_FOUND, code, message);
  }
}
