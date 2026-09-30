import { HttpStatus, Injectable } from '@nestjs/common';
import type { AuthUser } from '@eventflow/contracts';
import { EventMemberRole, EventMemberStatus, EventStatus, Prisma, TaskStatus, UserStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { DomainException } from '../common/domain.exception';
import { normalizeEmail } from '../auth/auth.utils';
import { PrismaService } from '../prisma/prisma.service';
import { EventAccessService } from './event-access.service';
import { hasEventPermission } from './event-permissions';
import { CreateEventMemberDto, EventMembersQueryDto, RemoveEventMemberDto, UpdateEventMemberDto } from './dto/member.dto';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessService,
    private readonly audit: AuditService,
  ) {}

  async list(eventId: string, userId: string, query: EventMembersQueryDto) {
    await this.access.requirePermission(eventId, userId, 'member:view');
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const where: Prisma.EventMemberWhereInput = { eventId, status: EventMemberStatus.ACTIVE };
    if (query.role) where.role = query.role;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { displayName: { contains: search, mode: 'insensitive' } } },
      ];
    }
    const orderBy: Prisma.EventMemberOrderByWithRelationInput = query.sort === 'displayName:asc'
      ? { user: { displayName: 'asc' } }
      : { joinedAt: 'desc' };
    const [total, members] = await Promise.all([
      this.prisma.eventMember.count({ where }),
      this.prisma.eventMember.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, email: true, displayName: true } },
          department: { select: { id: true, name: true, description: true } },
        },
      }),
    ]);
    return {
      items: members.map((member) => this.memberSummary(member)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async add(eventId: string, actor: AuthUser, dto: CreateEventMemberDto) {
    await this.access.requirePermission(eventId, actor.id, 'member:add');
    const actorMembership = await this.access.requireMembership(eventId, actor.id);
    if (dto.role === EventMemberRole.OWNER && actorMembership.role !== EventMemberRole.OWNER) {
      throw this.forbidden('MEMBER_OWNER_MANAGEMENT_DENIED', 'Chỉ OWNER mới có thể thêm OWNER.');
    }
    const user = await this.resolveActiveUser(dto);
    await this.requireDepartment(eventId, dto.departmentId ?? null);

    const membership = await this.prisma.$transaction(async (transaction) => {
      await this.lockEvent(transaction, eventId);
      await this.requireMutableEvent(transaction, eventId);
      const existing = await transaction.eventMember.findUnique({
        where: { eventId_userId: { eventId, userId: user.id } },
      });
      if (existing?.status === EventMemberStatus.ACTIVE) {
        throw new DomainException(HttpStatus.CONFLICT, 'EVENT_MEMBER_ALREADY_EXISTS', 'Người dùng đã là thành viên của sự kiện.');
      }
      const saved = existing
        ? await transaction.eventMember.update({
          where: { id: existing.id },
          data: {
            role: dto.role,
            status: EventMemberStatus.ACTIVE,
            departmentId: dto.departmentId ?? null,
            joinedAt: new Date(),
          },
          include: {
            user: { select: { id: true, email: true, displayName: true } },
            department: { select: { id: true, name: true, description: true } },
          },
        })
        : await transaction.eventMember.create({
          data: {
            eventId,
            userId: user.id,
            role: dto.role,
            departmentId: dto.departmentId ?? null,
            status: EventMemberStatus.ACTIVE,
          },
          include: {
            user: { select: { id: true, email: true, displayName: true } },
            department: { select: { id: true, name: true, description: true } },
          },
        });
      await this.audit.record(transaction, {
        actorUserId: actor.id,
        action: 'EVENT_MEMBER_ADDED',
        targetType: 'EventMember',
        targetId: saved.id,
        metadata: { eventId, userId: user.id, role: dto.role },
      });
      return saved;
    });
    return this.memberSummary(membership);
  }

  async update(eventId: string, eventMemberId: string, actor: AuthUser, dto: UpdateEventMemberDto) {
    await this.access.requirePermission(eventId, actor.id, 'member:update-role');
    const membership = await this.prisma.$transaction(async (transaction) => {
      await this.lockEvent(transaction, eventId);
      await this.requireMutableEvent(transaction, eventId);
      const [actorMembership, target] = await Promise.all([
        transaction.eventMember.findFirst({ where: { eventId, userId: actor.id, status: EventMemberStatus.ACTIVE } }),
        transaction.eventMember.findFirst({
          where: { id: eventMemberId, eventId, status: EventMemberStatus.ACTIVE },
          include: {
            user: { select: { id: true, email: true, displayName: true } },
            department: { select: { id: true, name: true, description: true } },
          },
        }),
      ]);
      if (!actorMembership || !hasEventPermission(actorMembership.role, 'member:update-role')) {
        throw this.forbidden('EVENT_PERMISSION_DENIED', 'Bạn không có quyền thay đổi thành viên.');
      }
      if (!target) throw this.notFound('EVENT_MEMBER_NOT_FOUND', 'Không tìm thấy thành viên sự kiện.');
      const nextRole = dto.role ?? target.role;
      await this.assertMemberManagementAllowed(transaction, eventId, actorMembership, target, nextRole, false);
      if (dto.departmentId !== undefined) await this.requireDepartment(eventId, dto.departmentId);
      const updated = await transaction.eventMember.update({
        where: { id: target.id },
        data: {
          ...(dto.role === undefined ? {} : { role: dto.role }),
          ...(dto.departmentId === undefined ? {} : { departmentId: dto.departmentId }),
        },
        include: {
          user: { select: { id: true, email: true, displayName: true } },
          department: { select: { id: true, name: true, description: true } },
        },
      });
      if ((dto.role !== undefined && dto.role !== target.role)
        || (dto.departmentId !== undefined && dto.departmentId !== target.departmentId)) {
        await this.audit.record(transaction, {
          actorUserId: actor.id,
          action: 'EVENT_MEMBER_ROLE_CHANGED',
          targetType: 'EventMember',
          targetId: target.id,
          metadata: {
            eventId,
            previousRole: target.role,
            role: nextRole,
            previousDepartmentId: target.departmentId,
            departmentId: dto.departmentId ?? null,
          },
        });
      }
      return updated;
    });
    return this.memberSummary(membership);
  }

  async remove(eventId: string, eventMemberId: string, actor: AuthUser, dto: RemoveEventMemberDto) {
    await this.access.requirePermission(eventId, actor.id, 'member:remove');
    await this.prisma.$transaction(async (transaction) => {
      await this.lockEvent(transaction, eventId);
      await this.requireMutableEvent(transaction, eventId);
      const [actorMembership, target] = await Promise.all([
        transaction.eventMember.findFirst({ where: { eventId, userId: actor.id, status: EventMemberStatus.ACTIVE } }),
        transaction.eventMember.findFirst({ where: { id: eventMemberId, eventId, status: EventMemberStatus.ACTIVE } }),
      ]);
      if (!actorMembership || !hasEventPermission(actorMembership.role, 'member:remove')) {
        throw this.forbidden('EVENT_PERMISSION_DENIED', 'Bạn không có quyền xóa thành viên.');
      }
      if (!target) throw this.notFound('EVENT_MEMBER_NOT_FOUND', 'Không tìm thấy thành viên sự kiện.');
      await this.assertMemberManagementAllowed(transaction, eventId, actorMembership, target, target.role, true);

      // Explicit grants are current-state records, not a second source of
      // access after removal. Revoke them in the same transaction that removes
      // membership so a concurrent request cannot observe a stale grant.
      const activeGrants = await transaction.eventMemberPermissionGrant.findMany({
        where: { eventId, granteeEventMemberId: target.id, revokedAt: null },
        select: { id: true, permission: true, expiresAt: true },
      });
      const revokedAt = new Date();
      const revocableGrantIds = activeGrants
        .filter((grant) => !grant.expiresAt || grant.expiresAt > revokedAt)
        .map((grant) => grant.id);
      if (revocableGrantIds.length > 0) {
        await transaction.eventMemberPermissionGrant.updateMany({
          where: { id: { in: revocableGrantIds }, revokedAt: null },
          data: { revokedAt, revokedByEventMemberId: actorMembership.id },
        });
        await Promise.all(activeGrants
          .filter((grant) => revocableGrantIds.includes(grant.id))
          .map((grant) => this.audit.record(transaction, {
            actorUserId: actor.id,
            action: 'EVENT_PERMISSION_REVOKED',
            targetType: 'EventMemberPermissionGrant',
            targetId: grant.id,
            metadata: { eventId, eventMemberId: target.id, permission: grant.permission, reason: 'EVENT_MEMBER_REMOVED' },
          })));
      }

      const incompleteAssignments = await transaction.taskAssignee.findMany({
        where: {
          eventMemberId: target.id,
          task: {
            eventId,
            archivedAt: null,
            status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
          },
        },
        select: { taskId: true },
      });
      if (incompleteAssignments.length > 0 && !dto.replacementAssigneeIds?.length) {
        throw new DomainException(HttpStatus.CONFLICT, 'EVENT_MEMBER_INCOMPLETE_TASKS', 'Cần chuyển giao các công việc chưa hoàn thành trước khi xóa thành viên.');
      }
      const replacementIds = [...new Set(dto.replacementAssigneeIds ?? [])];
      if (replacementIds.includes(target.id)) {
        throw new DomainException(HttpStatus.BAD_REQUEST, 'EVENT_MEMBER_REPLACEMENT_INVALID', 'Không thể chọn chính thành viên bị xóa làm người thay thế.');
      }
      if (incompleteAssignments.length > 0) {
        const replacements = await transaction.eventMember.findMany({
          where: { id: { in: replacementIds }, eventId, status: EventMemberStatus.ACTIVE },
          select: { id: true },
        });
        if (replacements.length !== replacementIds.length) {
          throw new DomainException(HttpStatus.BAD_REQUEST, 'EVENT_MEMBER_REPLACEMENT_INVALID', 'Người thay thế phải là thành viên đang hoạt động của cùng sự kiện.');
        }
        const taskIds = incompleteAssignments.map((assignment) => assignment.taskId);
        await transaction.taskAssignee.createMany({
          data: taskIds.flatMap((taskId) => replacementIds.map((eventMemberId) => ({ taskId, eventMemberId }))),
          skipDuplicates: true,
        });
        await transaction.taskAssignee.deleteMany({ where: { taskId: { in: taskIds }, eventMemberId: target.id } });
      }
      await transaction.eventMember.update({ where: { id: target.id }, data: { status: EventMemberStatus.REMOVED } });
      await this.audit.record(transaction, {
        actorUserId: actor.id,
        action: 'EVENT_MEMBER_REMOVED',
        targetType: 'EventMember',
        targetId: target.id,
        metadata: { eventId, replacementAssigneeIds: replacementIds },
      });
    });
  }

  private async resolveActiveUser(dto: CreateEventMemberDto) {
    const hasUserId = dto.userId !== undefined;
    const hasEmail = dto.email !== undefined;
    if (hasUserId === hasEmail) {
      throw new DomainException(HttpStatus.BAD_REQUEST, 'EVENT_MEMBER_USER_REQUIRED', 'Cần cung cấp chính xác userId hoặc email.');
    }
    const user = hasUserId && dto.userId
      ? await this.prisma.user.findUnique({ where: { id: dto.userId } })
      : await this.prisma.user.findUnique({ where: { email: normalizeEmail(dto.email ?? '') } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new DomainException(HttpStatus.BAD_REQUEST, 'EVENT_MEMBER_TARGET_NOT_ACTIVE', 'Chỉ có thể thêm người dùng đang hoạt động.');
    }
    return user;
  }

  private async requireDepartment(eventId: string, departmentId: string | null): Promise<void> {
    if (departmentId === null) return;
    const department = await this.prisma.department.findFirst({ where: { id: departmentId, eventId }, select: { id: true } });
    if (!department) {
      throw new DomainException(HttpStatus.BAD_REQUEST, 'EVENT_MEMBER_CROSS_EVENT_DEPARTMENT', 'Phòng ban phải thuộc cùng sự kiện.');
    }
  }

  private async requireMutableEvent(transaction: Prisma.TransactionClient, eventId: string): Promise<void> {
    const event = await transaction.event.findUnique({ where: { id: eventId }, select: { archivedAt: true, status: true } });
    if (!event) throw this.notFound('EVENT_NOT_FOUND', 'Không tìm thấy sự kiện.');
    if (event.archivedAt || event.status === EventStatus.ARCHIVED) {
      throw new DomainException(HttpStatus.CONFLICT, 'EVENT_ARCHIVED', 'Sự kiện đã được lưu trữ.');
    }
  }

  private async assertMemberManagementAllowed(
    transaction: Prisma.TransactionClient,
    eventId: string,
    actor: { id: string; role: EventMemberRole },
    target: { id: string; role: EventMemberRole },
    nextRole: EventMemberRole,
    removing: boolean,
  ): Promise<void> {
    if ((target.role === EventMemberRole.OWNER || nextRole === EventMemberRole.OWNER) && actor.role !== EventMemberRole.OWNER) {
      throw this.forbidden('MEMBER_OWNER_MANAGEMENT_DENIED', 'Chỉ OWNER mới có thể quản lý OWNER.');
    }
    if (target.role === EventMemberRole.OWNER && (removing || nextRole !== EventMemberRole.OWNER)) {
      const activeOwnerCount = await transaction.eventMember.count({
        where: { eventId, status: EventMemberStatus.ACTIVE, role: EventMemberRole.OWNER },
      });
      if (activeOwnerCount <= 1) {
        throw new DomainException(HttpStatus.CONFLICT, 'EVENT_LAST_OWNER_PROTECTED', 'Sự kiện phải luôn có ít nhất một OWNER đang hoạt động.');
      }
    }
  }

  private async lockEvent(transaction: Prisma.TransactionClient, eventId: string): Promise<void> {
    await transaction.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = CAST(${eventId} AS uuid) FOR UPDATE`;
  }

  private memberSummary(member: {
    id: string;
    eventId: string;
    userId: string;
    role: EventMemberRole;
    status: EventMemberStatus;
    joinedAt: Date;
    user: { id: string; email: string; displayName: string | null };
    department: { id: string; name: string; description: string | null } | null;
  }) {
    return {
      id: member.id,
      eventId: member.eventId,
      userId: member.userId,
      role: member.role,
      status: member.status,
      displayName: member.user.displayName,
      email: member.user.email,
      joinedAt: member.joinedAt.toISOString(),
      department: member.department,
    };
  }

  private forbidden(code: string, message: string): DomainException {
    return new DomainException(HttpStatus.FORBIDDEN, code, message);
  }

  private notFound(code: string, message: string): DomainException {
    return new DomainException(HttpStatus.NOT_FOUND, code, message);
  }
}
