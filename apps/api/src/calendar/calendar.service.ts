import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  CalendarEventDetail,
  CalendarItem,
  CalendarItemDetail,
  CalendarItemsResponse,
  CalendarTaskDetail,
  TaskAssigneeSummary,
} from '@eventflow/contracts';
import { CalendarCategory, EventMemberStatus, EventStatus, Prisma, TaskStatus, UserStatus } from '@prisma/client';
import { DomainException } from '../common/domain.exception';
import { type EffectiveEventPermissions, type EventMembershipRecord, EventAccessService } from '../events/event-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarItemsQueryDto } from './dto/calendar.dto';

const MAX_RANGE_DAYS = 93;
const MAX_CALENDAR_ITEMS = 300;

type CalendarSourceType = 'EVENT' | 'TASK';

interface DateRange {
  from: Date;
  to: Date;
}

@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessService,
  ) {}

  async listItems(userId: string, dto: CalendarItemsQueryDto): Promise<CalendarItemsResponse> {
    const range = this.parseRange(dto.from, dto.to);
    const sourceTypes = new Set<CalendarSourceType>(dto.sourceTypes?.length ? dto.sourceTypes : ['EVENT', 'TASK']);
    const categories = dto.categories?.length ? dto.categories : undefined;
    const search = dto.search?.trim() || undefined;

    const taskMemberships = sourceTypes.has('TASK')
      ? await this.prisma.eventMember.findMany({
        where: { userId, status: EventMemberStatus.ACTIVE, user: { status: UserStatus.ACTIVE } },
        select: { id: true, eventId: true, userId: true, role: true, departmentId: true },
      })
      : [];
    const taskScopes = await Promise.all(taskMemberships.map(async (membership) => ({
      membership,
      effective: await this.access.effectivePermissionsFor(membership),
    })));

    const [events, tasks] = await Promise.all([
      sourceTypes.has('EVENT')
        ? this.prisma.event.findMany({
          where: this.eventWhere(userId, range, categories, search),
          select: {
            id: true,
            name: true,
            startsAt: true,
            endsAt: true,
            status: true,
            calendarCategory: true,
            locationName: true,
            members: {
              where: { userId, status: EventMemberStatus.ACTIVE, user: { status: UserStatus.ACTIVE } },
              select: { role: true },
            },
          },
          orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
          take: MAX_CALENDAR_ITEMS,
        })
        : Promise.resolve([]),
      sourceTypes.has('TASK')
        ? this.prisma.task.findMany({
          where: this.taskWhere(userId, range, categories, search, taskScopes),
          select: {
            id: true,
            eventId: true,
            title: true,
            dueAt: true,
            status: true,
            calendarCategory: true,
            event: { select: { name: true } },
          },
          orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
          take: MAX_CALENDAR_ITEMS,
        })
        : Promise.resolve([]),
    ]);

    const items: CalendarItem[] = [
      ...events.map((event) => ({
        id: `event:${event.id}`,
        sourceType: 'EVENT' as const,
        sourceId: event.id,
        eventId: event.id,
        taskId: null,
        category: event.calendarCategory,
        title: event.name,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        allDay: this.isAllDay(event.startsAt, event.endsAt),
        locationName: event.locationName,
        status: event.status,
        eventName: null,
        eventCoverUrl: null,
        userEventRole: event.members[0]?.role ?? null,
      })),
      ...tasks.map((task) => ({
        id: `task:${task.id}`,
        sourceType: 'TASK' as const,
        sourceId: task.id,
        eventId: task.eventId,
        taskId: task.id,
        category: task.calendarCategory,
        title: task.title,
        startsAt: task.dueAt.toISOString(),
        endsAt: null,
        allDay: false,
        locationName: null,
        status: task.status,
        eventName: task.event.name,
        eventCoverUrl: null,
        userEventRole: null,
      })),
    ].sort((left, right) => left.startsAt.localeCompare(right.startsAt) || left.id.localeCompare(right.id));

    return { items: items.slice(0, MAX_CALENDAR_ITEMS), from: range.from.toISOString(), to: range.to.toISOString() };
  }

  async getItemDetail(userId: string, sourceType: string, sourceId: string): Promise<CalendarItemDetail> {
    if (sourceType === 'EVENT') return this.eventDetail(userId, sourceId);
    if (sourceType === 'TASK') return this.taskDetail(userId, sourceId);
    throw this.notFound();
  }

  private async eventDetail(userId: string, eventId: string): Promise<CalendarEventDetail> {
    const membership = await this.access.requireMembership(eventId, userId);
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, archivedAt: null, status: { not: EventStatus.ARCHIVED } },
      select: {
        id: true,
        name: true,
        description: true,
        startsAt: true,
        endsAt: true,
        locationName: true,
        status: true,
        createdBy: { select: { displayName: true, email: true } },
      },
    });
    if (!event) throw this.notFound();
    const [relatedAssignedTaskCount, relatedCompletedTaskCount, effective] = await Promise.all([
      this.prisma.task.count({ where: { eventId, archivedAt: null, assignees: { some: { eventMemberId: membership.id } } } }),
      this.prisma.task.count({ where: { eventId, archivedAt: null, status: TaskStatus.DONE, assignees: { some: { eventMemberId: membership.id } } } }),
      this.access.effectivePermissionsFor(membership),
    ]);
    const shortDescription = event.description ? event.description.slice(0, 180) : null;
    return {
      sourceType: 'EVENT',
      eventId: event.id,
      title: event.name,
      shortDescription,
      description: event.description,
      coverUrl: null,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      locationName: event.locationName,
      eventStatus: event.status,
      userEventRole: membership.role,
      organizerName: event.createdBy.displayName || event.createdBy.email,
      organizerSubtitle: event.createdBy.displayName ? event.createdBy.email : null,
      relatedAssignedTaskCount,
      relatedCompletedTaskCount,
      permissions: effective.effectivePermissions,
    };
  }

  private async taskDetail(userId: string, taskId: string): Promise<CalendarTaskDetail> {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        archivedAt: null,
        event: { archivedAt: null, status: { not: EventStatus.ARCHIVED } },
      },
      select: {
        id: true,
        eventId: true,
        title: true,
        description: true,
        dueAt: true,
        status: true,
        priority: true,
        createdById: true,
        departmentId: true,
        workflowStage: { select: { id: true, code: true, name: true, order: true } },
        department: { select: { id: true, name: true, description: true } },
        event: { select: { name: true } },
        assignees: {
          select: {
            eventMemberId: true,
            eventMember: {
              select: {
                role: true,
                user: { select: { id: true, email: true, displayName: true } },
                department: { select: { id: true, name: true, description: true } },
              },
            },
          },
        },
      },
    });
    if (!task) throw this.notFound();
    const membership = await this.access.requireTaskView(task, userId);
    const effective = await this.access.effectivePermissionsFor(membership);
    const assignees: TaskAssigneeSummary[] = task.assignees.map((assignee) => ({
      eventMemberId: assignee.eventMemberId,
      userId: assignee.eventMember.user.id,
      displayName: assignee.eventMember.user.displayName,
      email: assignee.eventMember.user.email,
      role: assignee.eventMember.role,
      department: assignee.eventMember.department,
    }));
    return {
      sourceType: 'TASK',
      taskId: task.id,
      eventId: task.eventId,
      title: task.title,
      description: task.description,
      dueAt: task.dueAt.toISOString(),
      status: task.status,
      priority: task.priority,
      workflowStage: task.workflowStage,
      department: task.department,
      eventName: task.event.name,
      eventCoverUrl: null,
      assignees,
      permissions: effective.effectivePermissions,
    };
  }

  private eventWhere(userId: string, range: DateRange, categories: CalendarCategory[] | undefined, search: string | undefined): Prisma.EventWhereInput {
    return {
      archivedAt: null,
      status: { not: EventStatus.ARCHIVED },
      startsAt: { lt: range.to },
      endsAt: { gt: range.from },
      members: { some: { userId, status: EventMemberStatus.ACTIVE, user: { status: UserStatus.ACTIVE } } },
      ...(categories ? { calendarCategory: { in: categories } } : {}),
      ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { locationName: { contains: search, mode: 'insensitive' } }] } : {}),
    };
  }

  private taskWhere(
    userId: string,
    range: DateRange,
    categories: CalendarCategory[] | undefined,
    search: string | undefined,
    taskScopes: ReadonlyArray<{ membership: EventMembershipRecord; effective: EffectiveEventPermissions }>,
  ): Prisma.TaskWhereInput {
    const visibleToUser = taskScopes.flatMap(({ membership, effective }) => {
      const scope: Prisma.TaskWhereInput[] = [{ assignees: { some: { eventMemberId: membership.id } } }];
      const listScope = this.access.canListAllTasks(membership, effective);
      if (listScope === 'global') scope.push({ eventId: membership.eventId });
      if (listScope === 'department' && membership.departmentId) scope.push({ eventId: membership.eventId, departmentId: membership.departmentId });
      if (effective.effectivePermissions.includes('task:create')) scope.push({ eventId: membership.eventId, createdById: userId });
      return scope;
    });
    const searchFilters: Prisma.TaskWhereInput[] = search
      ? [{ OR: [{ title: { contains: search, mode: 'insensitive' } }, { event: { name: { contains: search, mode: 'insensitive' } } }] }]
      : [];
    return {
      archivedAt: null,
      dueAt: { gte: range.from, lt: range.to },
      event: { archivedAt: null, status: { not: EventStatus.ARCHIVED } },
      AND: [
        { OR: visibleToUser },
        ...searchFilters,
      ],
      ...(categories ? { calendarCategory: { in: categories } } : {}),
    };
  }

  private parseRange(fromValue: string, toValue: string): DateRange {
    const from = new Date(fromValue);
    const to = new Date(toValue);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
      throw new DomainException(HttpStatus.BAD_REQUEST, 'CALENDAR_RANGE_INVALID', 'Khoảng thời gian lịch không hợp lệ.');
    }
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
      throw new DomainException(HttpStatus.BAD_REQUEST, 'CALENDAR_RANGE_EXCESSIVE', 'Khoảng thời gian lịch vượt quá giới hạn cho phép.');
    }
    return { from, to };
  }

  private isAllDay(startsAt: Date, endsAt: Date): boolean {
    const isMidnight = (value: Date) => value.getUTCHours() === 0 && value.getUTCMinutes() === 0 && value.getUTCSeconds() === 0 && value.getUTCMilliseconds() === 0;
    return startsAt < endsAt && isMidnight(startsAt) && isMidnight(endsAt);
  }

  private notFound(): DomainException {
    return new DomainException(HttpStatus.NOT_FOUND, 'CALENDAR_ITEM_NOT_FOUND', 'Không tìm thấy nội dung lịch.');
  }
}
