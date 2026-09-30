import { HttpStatus, Injectable } from '@nestjs/common';
import type { AuthUser } from '@eventflow/contracts';
import { CalendarCategory, EventMemberRole, EventMemberStatus, EventStatus, Prisma, TaskStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { DomainException } from '../common/domain.exception';
import { PrismaService } from '../prisma/prisma.service';
import { EventAccessService } from './event-access.service';
import { EventProgressService } from './event-progress.service';
import { type CreateEventDto, MyEventsQueryDto, UpdateEventDto } from './dto/event.dto';
import { calculatePersonalTaskProgress } from './task-rules';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const defaultStages = [
  { code: 'DESIGN', name: 'Thiết kế', order: 1 },
  { code: 'PREPARATION', name: 'Chuẩn bị', order: 2 },
  { code: 'EXECUTION', name: 'Thực thi', order: 3 },
  { code: 'FEEDBACK', name: 'Đánh giá', order: 4 },
];

const defaultDepartments = [
  { name: 'Content', description: 'Nội dung và chương trình.' },
  { name: 'Media', description: 'Truyền thông và hình ảnh.' },
  { name: 'Logistics', description: 'Hậu cần và nhà cung cấp.' },
  { name: 'Finance', description: 'Tài chính và đối soát.' },
  { name: 'Check-in', description: 'Đón tiếp và check-in.' },
];

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessService,
    private readonly audit: AuditService,
    private readonly progress: EventProgressService,
  ) {}

  async create(user: AuthUser, dto: CreateEventDto) {
    const startsAt = this.asDate(dto.startsAt, 'EVENT_START_INVALID');
    const endsAt = this.asDate(dto.endsAt, 'EVENT_END_INVALID');
    this.assertDateRange(startsAt, endsAt);

    const event = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.event.create({
        data: {
          name: dto.name.trim(),
          description: dto.description ?? null,
          locationName: dto.locationName ?? null,
          startsAt,
          endsAt,
          status: dto.status ?? EventStatus.DRAFT,
          calendarCategory: dto.calendarCategory ?? CalendarCategory.EVENT,
          createdById: user.id,
          members: {
            create: {
              userId: user.id,
              role: EventMemberRole.OWNER,
              status: EventMemberStatus.ACTIVE,
            },
          },
          workflowStages: { create: defaultStages },
          departments: { create: defaultDepartments },
        },
        include: {
          workflowStages: { orderBy: { order: 'asc' } },
          departments: { orderBy: { name: 'asc' } },
          createdBy: { select: { id: true, displayName: true, email: true } },
        },
      });
      await this.audit.record(transaction, {
        actorUserId: user.id,
        action: 'EVENT_CREATED',
        targetType: 'Event',
        targetId: created.id,
      });
      return created;
    });
    return this.getById(event.id, user.id);
  }

  async getById(eventId: string, userId: string) {
    const membership = await this.access.requirePermission(eventId, userId, 'event:view');
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        workflowStages: { orderBy: { order: 'asc' } },
        departments: { orderBy: { name: 'asc' } },
        createdBy: { select: { id: true, displayName: true, email: true } },
      },
    });
    if (!event) throw this.notFound('EVENT_NOT_FOUND', 'Không tìm thấy sự kiện.');
    const [membershipResponse, progress] = await Promise.all([
      this.membershipResponse(membership),
      this.progress.calculate(eventId, membership.id),
    ]);
    return this.eventDetail(event, membershipResponse, progress);
  }

  async update(eventId: string, user: AuthUser, dto: UpdateEventDto) {
    await this.access.requirePermission(eventId, user.id, 'event:update');
    const current = await this.findMutableEvent(eventId);
    if (dto.status === EventStatus.ARCHIVED) {
      throw new DomainException(HttpStatus.BAD_REQUEST, 'EVENT_ARCHIVE_ENDPOINT_REQUIRED', 'Hãy dùng thao tác lưu trữ sự kiện.');
    }
    const startsAt = dto.startsAt === undefined ? current.startsAt : this.asDate(dto.startsAt, 'EVENT_START_INVALID');
    const endsAt = dto.endsAt === undefined ? current.endsAt : this.asDate(dto.endsAt, 'EVENT_END_INVALID');
    this.assertDateRange(startsAt, endsAt);

    const data: Prisma.EventUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.locationName !== undefined) data.locationName = dto.locationName;
    if (dto.startsAt !== undefined) data.startsAt = startsAt;
    if (dto.endsAt !== undefined) data.endsAt = endsAt;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.calendarCategory !== undefined) data.calendarCategory = dto.calendarCategory;

    const event = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.event.update({
        where: { id: eventId },
        data,
        include: {
          workflowStages: { orderBy: { order: 'asc' } },
          departments: { orderBy: { name: 'asc' } },
          createdBy: { select: { id: true, displayName: true, email: true } },
        },
      });
      await this.audit.record(transaction, {
        actorUserId: user.id,
        action: 'EVENT_UPDATED',
        targetType: 'Event',
        targetId: eventId,
      });
      return updated;
    });
    return this.getById(event.id, user.id);
  }

  async archive(eventId: string, user: AuthUser) {
    await this.access.requirePermission(eventId, user.id, 'event:archive');
    const current = await this.prisma.event.findUnique({ where: { id: eventId }, select: { id: true, archivedAt: true } });
    if (!current) throw this.notFound('EVENT_NOT_FOUND', 'Không tìm thấy sự kiện.');
    if (current.archivedAt) {
      throw new DomainException(HttpStatus.CONFLICT, 'EVENT_ALREADY_ARCHIVED', 'Sự kiện đã được lưu trữ.');
    }
    const event = await this.prisma.$transaction(async (transaction) => {
      const archivedAt = new Date();
      const updated = await transaction.event.update({
        where: { id: eventId },
        data: { status: EventStatus.ARCHIVED, archivedAt },
        include: {
          workflowStages: { orderBy: { order: 'asc' } },
          departments: { orderBy: { name: 'asc' } },
          createdBy: { select: { id: true, displayName: true, email: true } },
        },
      });
      await this.audit.record(transaction, {
        actorUserId: user.id,
        action: 'EVENT_ARCHIVED',
        targetType: 'Event',
        targetId: eventId,
      });
      return updated;
    });
    return this.getById(event.id, user.id);
  }

  async getMyEvents(userId: string, query: MyEventsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const eventFilter: Prisma.EventWhereInput = { archivedAt: null };
    const statusCountEventFilter: Prisma.EventWhereInput = { archivedAt: null };
    if (query.status) eventFilter.status = query.status;
    if (query.search?.trim()) {
      const name: Prisma.StringFilter = { contains: query.search.trim(), mode: 'insensitive' };
      eventFilter.name = name;
      statusCountEventFilter.name = name;
    }
    const membershipFilter: Prisma.EventMemberWhereInput = {
      userId,
      status: EventMemberStatus.ACTIVE,
      event: eventFilter,
    };
    const statusMembershipFilter: Prisma.EventMemberWhereInput = {
      userId,
      status: EventMemberStatus.ACTIVE,
      event: statusCountEventFilter,
    };
    const orderBy: Prisma.EventMemberOrderByWithRelationInput = this.memberEventOrder(query.sort);
    const [total, memberships, statusMemberships] = await Promise.all([
      this.prisma.eventMember.count({ where: membershipFilter }),
      this.prisma.eventMember.findMany({
        where: membershipFilter,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { event: true },
      }),
      this.prisma.eventMember.findMany({
        where: statusMembershipFilter,
        select: { event: { select: { status: true } } },
      }),
    ]);

    const membershipToEvent = new Map(memberships.map((membership) => [membership.id, membership.eventId]));
    const assignments = memberships.length === 0
      ? []
      : await this.prisma.taskAssignee.findMany({
        where: {
          eventMemberId: { in: memberships.map((membership) => membership.id) },
          task: { archivedAt: null },
        },
        select: { eventMemberId: true, task: { select: { id: true, status: true } } },
      });
    const progressByEvent = new Map<string, { assigned: number; completed: number }>();
    for (const assignment of assignments) {
      const eventId = membershipToEvent.get(assignment.eventMemberId);
      if (!eventId || assignment.task.status === TaskStatus.CANCELLED) continue;
      const current = progressByEvent.get(eventId) ?? { assigned: 0, completed: 0 };
      current.assigned += 1;
      if (assignment.task.status === TaskStatus.DONE) current.completed += 1;
      progressByEvent.set(eventId, current);
    }

    const statusCounts: Record<'ONGOING' | 'UPCOMING' | 'ENDED', number> = {
      UPCOMING: 0,
      ONGOING: 0,
      ENDED: 0,
    };
    for (const membership of statusMemberships) {
      if (membership.event.status === EventStatus.UPCOMING) statusCounts.UPCOMING += 1;
      if (membership.event.status === EventStatus.ONGOING) statusCounts.ONGOING += 1;
      if (membership.event.status === EventStatus.ENDED) statusCounts.ENDED += 1;
    }

    return {
      items: memberships.map((membership) => {
        const progress = progressByEvent.get(membership.eventId) ?? { assigned: 0, completed: 0 };
        return this.myEventCard(membership.event, membership.role, progress);
      }),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      statusCounts,
    };
  }

  async getMyMembership(eventId: string, userId: string) {
    const membership = await this.access.requireMembership(eventId, userId);
    return this.membershipResponse(membership);
  }

  private async findMutableEvent(eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw this.notFound('EVENT_NOT_FOUND', 'Không tìm thấy sự kiện.');
    if (event.archivedAt || event.status === EventStatus.ARCHIVED) {
      throw new DomainException(HttpStatus.CONFLICT, 'EVENT_ARCHIVED', 'Sự kiện đã được lưu trữ.');
    }
    return event;
  }

  private eventDetail(event: {
    id: string;
    name: string;
    description: string | null;
    locationName: string | null;
    startsAt: Date;
    endsAt: Date;
    status: EventStatus;
    archivedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    workflowStages: Array<{ id: string; code: string; name: string; order: number }>;
    departments: Array<{ id: string; name: string; description: string | null }>;
    createdBy: { id: string; displayName: string | null; email: string };
  }, membership: Awaited<ReturnType<EventsService['membershipResponse']>>, progress: Awaited<ReturnType<EventProgressService['calculate']>>) {
    return {
      id: event.id,
      name: event.name,
      description: event.description,
      locationName: event.locationName,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      status: event.status,
      coverUrl: null,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      workflowStages: event.workflowStages,
      departments: event.departments,
      membership,
      progress,
    };
  }

  private myEventCard(
    event: { id: string; name: string; description: string | null; locationName: string | null; startsAt: Date; endsAt: Date; status: EventStatus },
    role: EventMemberRole,
    progress: { assigned: number; completed: number },
  ) {
    return {
      id: event.id,
      name: event.name,
      description: event.description,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      locationName: event.locationName,
      status: event.status,
      coverUrl: null,
      eventRole: role,
      assignedTaskCount: progress.assigned,
      completedAssignedTaskCount: progress.completed,
      percentage: progress.assigned === 0 ? 0 : Math.round((progress.completed / progress.assigned) * 100),
      remainingTimeLabel: this.remainingTimeLabel(event),
    };
  }

  private memberEventOrder(sort: MyEventsQueryDto['sort']): Prisma.EventMemberOrderByWithRelationInput {
    switch (sort) {
      case 'startsAt:desc':
        return { event: { startsAt: 'desc' } };
      case 'createdAt:desc':
        return { event: { createdAt: 'desc' } };
      case 'startsAt:asc':
      default:
        return { event: { startsAt: 'asc' } };
    }
  }

  private remainingTimeLabel(event: { startsAt: Date; endsAt: Date; status: EventStatus }): string {
    if (event.status === EventStatus.ENDED) return 'Đã kết thúc';
    const now = Date.now();
    if (event.endsAt.getTime() <= now) return 'Đã kết thúc';
    if (event.startsAt.getTime() <= now) return 'Đang diễn ra';
    const remainingDays = Math.ceil((event.startsAt.getTime() - now) / 86_400_000);
    return remainingDays === 1 ? 'Còn 1 ngày' : `Còn ${remainingDays} ngày`;
  }

  private asDate(value: string, code: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new DomainException(HttpStatus.BAD_REQUEST, code, 'Thời gian không hợp lệ.');
    }
    return date;
  }

  private assertDateRange(startsAt: Date, endsAt: Date): void {
    if (startsAt >= endsAt) {
      throw new DomainException(HttpStatus.BAD_REQUEST, 'EVENT_INVALID_DATE_RANGE', 'Thời gian bắt đầu phải trước thời gian kết thúc.');
    }
  }

  private notFound(code: string, message: string): DomainException {
    return new DomainException(HttpStatus.NOT_FOUND, code, message);
  }

  private async membershipResponse(membership: { id: string; eventId: string; userId: string; role: EventMemberRole; departmentId: string | null }) {
    const [department, assignments, effective] = await Promise.all([
      membership.departmentId
        ? this.prisma.department.findFirst({
          where: { id: membership.departmentId, eventId: membership.eventId },
          select: { id: true, name: true, description: true },
        })
        : null,
      this.prisma.taskAssignee.findMany({
        where: { eventMemberId: membership.id },
        select: { task: { select: { status: true, archivedAt: true } } },
      }),
      this.access.effectivePermissionsFor(membership),
    ]);
    const progress = calculatePersonalTaskProgress(assignments.map((assignment) => assignment.task));
    return {
      id: membership.id,
      eventId: membership.eventId,
      role: membership.role,
      department,
      permissions: effective.effectivePermissions,
      assignedTaskCount: progress.assigned,
      completedAssignedTaskCount: progress.completed,
      percentage: progress.percentage,
    };
  }
}
