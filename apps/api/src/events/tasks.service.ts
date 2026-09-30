import { HttpStatus, Injectable } from '@nestjs/common';
import type { AuthUser, EventProgressUpdatedOutboxPayload } from '@eventflow/contracts';
import { CalendarCategory, EventDelegatedPermission, EventMemberRole, EventMemberStatus, EventStatus, OutboxStatus, Prisma, TaskOrigin, TaskPriority, TaskStatus, UserStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { DomainException } from '../common/domain.exception';
import { NotificationFactory } from '../notifications/notification-factory.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventAccessService, type EffectiveEventPermissions, type EventMembershipRecord } from './event-access.service';
import { EventProgressService } from './event-progress.service';
import { CreateTaskDto, EventTasksQueryDto, MyTasksQueryDto, ReplaceTaskAssigneesDto, UpdateTaskDto, UpdateTaskStatusDto, WorkflowStageTasksQueryDto } from './dto/task.dto';
import { isAllowedTaskStatusTransition, type TaskTransitionActor } from './task-rules';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DUE_SOON_DAYS = 7;

const taskInclude = {
  event: { select: { id: true, name: true, archivedAt: true, status: true } },
  workflowStage: { select: { id: true, code: true, name: true, order: true } },
  department: { select: { id: true, name: true, description: true } },
  assignedBy: { select: { id: true, email: true, displayName: true } },
  assignees: {
    include: {
      eventMember: {
        include: {
          user: { select: { id: true, email: true, displayName: true } },
          department: { select: { id: true, name: true, description: true } },
        },
      },
    },
  },
  attachments: {
    include: { uploadedBy: { select: { id: true, email: true, displayName: true } } },
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.TaskInclude;

type DetailedTask = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationFactory,
    private readonly progress: EventProgressService,
  ) {}

  async listForEvent(eventId: string, userId: string, query: EventTasksQueryDto) {
    const membership = await this.access.requireMembership(eventId, userId);
    const effective = await this.access.effectivePermissionsFor(membership);
    const filters = this.baseTaskFilters(query, eventId);
    const scope = query.scope ?? 'mine';
    if (scope === 'all') {
      const allScope = this.access.canListAllTasks(membership, effective);
      if (allScope === 'department') {
        filters.push({ departmentId: membership.departmentId });
      } else if (allScope !== 'global') {
        throw this.forbidden('TASK_SCOPE_DENIED', 'Bạn chỉ có thể xem công việc được giao.');
      }
    } else {
      filters.push({
        OR: [
          { assignees: { some: { eventMemberId: membership.id } } },
          ...(effective.effectivePermissions.includes('task:create') ? [{ createdById: userId }] : []),
        ],
      });
    }
    const where: Prisma.TaskWhereInput = { AND: filters };
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const [total, tasks] = await Promise.all([
      this.prisma.task.count({ where }),
      this.prisma.task.findMany({
        where,
        include: taskInclude,
        orderBy: this.taskOrder(query.sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: tasks.map((task) => this.taskListItem(task, membership, effective)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async listMine(userId: string, query: MyTasksQueryDto) {
    const memberships = await this.prisma.eventMember.findMany({
      where: { userId, status: EventMemberStatus.ACTIVE, user: { status: UserStatus.ACTIVE } },
      select: { id: true, eventId: true, userId: true, role: true, departmentId: true },
    });
    const membershipByEvent = new Map(memberships.map((membership) => [membership.eventId, membership]));
    if (memberships.length === 0) return this.emptyPage(query);
    const effectiveByEvent = new Map(await Promise.all(memberships.map(async (membership) => [
      membership.eventId,
      await this.access.effectivePermissionsFor(membership),
    ] as const)));

    const filters = this.baseTaskFilters(query, query.eventId);
    filters.push({
      event: { archivedAt: null },
      OR: [
        { assignees: { some: { eventMemberId: { in: memberships.map((membership) => membership.id) } } } },
        {
          createdById: userId,
          eventId: {
            in: memberships
              .filter((membership) => effectiveByEvent.get(membership.eventId)?.effectivePermissions.includes('task:create'))
              .map((membership) => membership.eventId),
          },
        },
      ],
    });
    if (query.dueSoon) {
      const now = new Date();
      filters.push({ dueAt: { gte: now, lte: new Date(now.getTime() + DUE_SOON_DAYS * 86_400_000) } });
    }
    const tasks = await this.prisma.task.findMany({
      where: { AND: filters },
      include: taskInclude,
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
    });
    const sortableTasks = tasks.filter((task) => membershipByEvent.has(task.eventId));
    this.sortMyTasks(sortableTasks, query.sort);
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const start = (page - 1) * pageSize;
    return {
      items: sortableTasks.slice(start, start + pageSize).map((task) => {
        const membership = membershipByEvent.get(task.eventId);
        if (!membership) throw new Error('Membership scope invariant failed.');
        const effective = effectiveByEvent.get(task.eventId);
        if (!effective) throw new Error('Effective permission scope invariant failed.');
        return this.taskListItem(task, membership, effective);
      }),
      page,
      pageSize,
      total: sortableTasks.length,
      totalPages: Math.max(1, Math.ceil(sortableTasks.length / pageSize)),
    };
  }

  async getById(taskId: string, userId: string) {
    const task = await this.findTask(taskId);
    if (!task) throw this.notFound('TASK_NOT_FOUND', 'Không tìm thấy công việc.');
    const membership = await this.access.requireTaskView(task, userId);
    return this.taskDetail(task, membership, await this.access.effectivePermissionsFor(membership));
  }

  async listForWorkflowStage(eventId: string, stageId: string, userId: string, query: WorkflowStageTasksQueryDto) {
    const membership = await this.access.requireMembership(eventId, userId);
    const effective = await this.access.effectivePermissionsFor(membership);
    await this.requireWorkflowStage(eventId, stageId);
    const filters = this.baseTaskFilters(query, eventId);
    filters.push({ workflowStageId: stageId });
    if (query.origin) filters.push({ origin: query.origin });
    if (query.assigneeEventMemberId) filters.push({ assignees: { some: { eventMemberId: query.assigneeEventMemberId } } });
    if (query.mineOnly) {
      filters.push({ assignees: { some: { eventMemberId: membership.id } } });
    } else {
      const scope = this.access.canListAllTasks(membership, effective);
      if (scope === 'department') {
        filters.push({ departmentId: membership.departmentId });
      } else if (scope !== 'global') {
        filters.push({
          OR: [
            { assignees: { some: { eventMemberId: membership.id } } },
            ...(effective.effectivePermissions.includes('task:create') ? [{ createdById: userId }] : []),
          ],
        });
      }
    }
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const where: Prisma.TaskWhereInput = { AND: filters };
    const [total, tasks] = await Promise.all([
      this.prisma.task.count({ where }),
      this.prisma.task.findMany({
        where,
        include: taskInclude,
        orderBy: this.taskOrder(query.sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: tasks.map((task) => this.taskListItem(task, membership, effective)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async create(eventId: string, user: AuthUser, dto: CreateTaskDto) {
    const membership = await this.access.requireMembership(eventId, user.id);
    const effective = await this.access.effectivePermissionsFor(membership);
    await this.requireMutableEvent(eventId);
    const creationMode = dto.creationMode ?? 'TEAM';
    const isPersonal = creationMode === 'PERSONAL';
    if (isPersonal && !effective.effectivePermissions.includes('task:create:self')) {
      throw this.forbidden('TASK_PERSONAL_CREATE_FORBIDDEN', 'Bạn không có quyền tạo công việc cá nhân.');
    }
    if (!isPersonal && (!effective.effectivePermissions.includes('task:create') || !effective.effectivePermissions.includes('task:assign'))) {
      throw this.forbidden('TASK_TEAM_CREATE_FORBIDDEN', 'Bạn không có quyền giao công việc cho đội ngũ.');
    }
    if (!isPersonal && (!dto.assigneeEventMemberIds || dto.assigneeEventMemberIds.length === 0)) {
      throw new DomainException(HttpStatus.BAD_REQUEST, 'TASK_ASSIGNEE_REQUIRED', 'Công việc đội ngũ cần ít nhất một người thực hiện.');
    }
    if (!isPersonal && membership.role === EventMemberRole.DEPARTMENT_LEAD
      && !this.access.hasDelegatedPermission(effective, EventDelegatedPermission.TASK_CREATE)
      && (!membership.departmentId || dto.departmentId !== membership.departmentId)) {
      throw this.forbidden('TASK_DEPARTMENT_ACCESS_DENIED', 'Trưởng bộ phận chỉ có thể tạo công việc trong phòng ban của mình.');
    }
    await this.requireWorkflowStage(eventId, dto.workflowStageId);
    await this.requireDepartment(eventId, dto.departmentId ?? null);
    const dueAt = this.asDate(dto.dueAt);

    const task = await this.prisma.$transaction(async (transaction) => {
      const assignees = isPersonal
        ? await this.requireActiveAssignees(transaction, eventId, [membership.id])
        : await this.requireActiveAssignees(transaction, eventId, dto.assigneeEventMemberIds ?? []);
      const created = await transaction.task.create({
        data: {
          eventId,
          workflowStageId: dto.workflowStageId,
          departmentId: dto.departmentId ?? null,
          title: dto.title.trim(),
          description: dto.description ?? null,
          priority: dto.priority ?? TaskPriority.MEDIUM,
          origin: TaskOrigin.USER_CREATED,
          calendarCategory: dto.calendarCategory ?? CalendarCategory.TASK,
          dueAt,
          createdById: user.id,
          assignedById: user.id,
          assignees: { create: assignees.map((assignee) => ({ eventMemberId: assignee.id })) },
        },
        include: {
          event: { select: { name: true } },
          assignees: { include: { eventMember: { select: { userId: true } } } },
        },
      });
      await this.audit.record(transaction, {
        actorUserId: user.id,
        action: 'TASK_CREATED',
        targetType: 'Task',
        targetId: created.id,
        metadata: { eventId, origin: TaskOrigin.USER_CREATED, creationMode, assigneeEventMemberIds: assignees.map((assignee) => assignee.id) },
      });
      await this.audit.record(transaction, {
        actorUserId: user.id,
        action: 'TASK_ASSIGNEES_CHANGED',
        targetType: 'Task',
        targetId: created.id,
        metadata: { eventId, addedEventMemberIds: assignees.map((assignee) => assignee.id), removedEventMemberIds: [] },
      });
      await this.notifications.createTaskAssignmentNotifications(transaction, {
        eventId,
        eventName: created.event.name,
        taskId: created.id,
        taskTitle: created.title,
        actorUserId: user.id,
        actorDisplayName: user.displayName,
        recipients: created.assignees.map((assignment) => ({
          userId: assignment.eventMember.userId,
          assignmentEpisodeId: assignment.assignmentEpisodeId,
        })),
      });
      return created;
    });
    return this.getById(task.id, user.id);
  }

  async update(taskId: string, user: AuthUser, dto: UpdateTaskDto) {
    const task = await this.findTask(taskId);
    if (!task) throw this.notFound('TASK_NOT_FOUND', 'Không tìm thấy công việc.');
    const membership = await this.access.requireMembership(task.eventId, user.id);
    const effective = await this.access.effectivePermissionsFor(membership);
    this.assertTaskManageAllowed(membership, task, effective);
    await this.requireMutableTask(task);
    const stageChanged = dto.workflowStageId !== undefined && dto.workflowStageId !== task.workflowStageId;
    if (stageChanged && !this.access.canMoveTask(membership, task, effective)) {
      throw this.forbidden('TASK_STAGE_MOVE_FORBIDDEN', 'Bạn không có quyền chuyển giai đoạn công việc này.');
    }
    if (dto.workflowStageId !== undefined) await this.requireWorkflowStage(task.eventId, dto.workflowStageId);
    if (dto.departmentId !== undefined) await this.requireDepartment(task.eventId, dto.departmentId);
    if (membership.role === EventMemberRole.DEPARTMENT_LEAD
      && !this.access.hasDelegatedPermission(effective, EventDelegatedPermission.TASK_UPDATE_ANY)
      && dto.departmentId !== undefined
      && dto.departmentId !== membership.departmentId) {
      throw this.forbidden('TASK_DEPARTMENT_ACCESS_DENIED', 'Không thể chuyển công việc sang phòng ban khác.');
    }

    const data: Prisma.TaskUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.workflowStageId !== undefined) data.workflowStage = { connect: { id: dto.workflowStageId } };
    if (dto.departmentId !== undefined) data.department = dto.departmentId === null ? { disconnect: true } : { connect: { id: dto.departmentId } };
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.calendarCategory !== undefined) data.calendarCategory = dto.calendarCategory;
    if (dto.dueAt !== undefined) data.dueAt = this.asDate(dto.dueAt);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.task.update({ where: { id: taskId }, data });
      await this.audit.record(transaction, {
        actorUserId: user.id,
        action: stageChanged ? 'TASK_STAGE_CHANGED' : 'TASK_UPDATED',
        targetType: 'Task',
        targetId: taskId,
        metadata: { eventId: task.eventId, ...(stageChanged ? { previousWorkflowStageId: task.workflowStageId, workflowStageId: dto.workflowStageId } : {}) },
      });
    });
    return this.getById(taskId, user.id);
  }

  async updateStatus(taskId: string, user: AuthUser, dto: UpdateTaskStatusDto) {
    const task = await this.findTask(taskId);
    if (!task) throw this.notFound('TASK_NOT_FOUND', 'Không tìm thấy công việc.');
    const membership = await this.access.requireMembership(task.eventId, user.id);
    const effective = await this.access.effectivePermissionsFor(membership);
    await this.requireMutableTask(task);
    if (!this.access.canManageTaskStatus(membership, task, effective)) {
      throw this.forbidden('TASK_STATUS_UPDATE_FORBIDDEN', 'Bạn không có quyền cập nhật trạng thái công việc này.');
    }
    if (task.status === dto.status && dto.status === TaskStatus.DONE) {
      return {
        task: await this.getById(taskId, user.id),
        progress: await this.progress.calculate(task.eventId, membership.id),
      };
    }
    const actor: TaskTransitionActor = this.access.canManageTask(membership, task, effective)
      || this.access.hasDelegatedPermission(effective, EventDelegatedPermission.TASK_UPDATE_STATUS_ANY)
      ? 'MANAGER'
      : 'ASSIGNED_MEMBER';
    if (!isAllowedTaskStatusTransition(actor, task.status, dto.status)) {
      throw new DomainException(HttpStatus.CONFLICT, 'TASK_STATUS_TRANSITION_INVALID', 'Chuyển trạng thái công việc không hợp lệ.');
    }
    const progress = await this.prisma.$transaction(async (transaction) => {
      const updatedAt = new Date();
      await transaction.task.update({
        where: { id: taskId },
        data: {
          status: dto.status,
          completedAt: dto.status === TaskStatus.DONE ? new Date() : null,
          updatedAt,
        },
      });
      await this.audit.record(transaction, {
        actorUserId: user.id,
        action: 'TASK_STATUS_CHANGED',
        targetType: 'Task',
        targetId: taskId,
        metadata: { eventId: task.eventId, previousStatus: task.status, status: dto.status },
      });
      const currentProgress = await this.progress.calculate(task.eventId, membership.id, transaction);
      const stage = currentProgress.stages.find((entry) => entry.workflowStageId === task.workflowStageId);
      if (!stage) {
        throw new DomainException(HttpStatus.INTERNAL_SERVER_ERROR, 'TASK_STAGE_PROGRESS_MISSING', 'Không thể tính tiến độ giai đoạn.');
      }
      const progressPayload: EventProgressUpdatedOutboxPayload = {
        version: 1,
        eventId: task.eventId,
        recipientEventId: task.eventId,
        changedTaskId: taskId,
        overall: currentProgress.overall,
        stage,
        updatedAt: updatedAt.toISOString(),
      };
      const payload: Prisma.InputJsonObject = {
        version: progressPayload.version,
        eventId: progressPayload.eventId,
        recipientEventId: progressPayload.recipientEventId,
        changedTaskId: progressPayload.changedTaskId,
        overall: {
          completed: progressPayload.overall.completed,
          total: progressPayload.overall.total,
          percentage: progressPayload.overall.percentage,
        },
        stage: {
          workflowStageId: progressPayload.stage.workflowStageId,
          code: progressPayload.stage.code,
          name: progressPayload.stage.name,
          order: progressPayload.stage.order,
          completed: progressPayload.stage.completed,
          total: progressPayload.stage.total,
          percentage: progressPayload.stage.percentage,
        },
        updatedAt: progressPayload.updatedAt,
      };
      await transaction.outboxEvent.create({
        data: {
          eventType: 'EVENT_PROGRESS_UPDATED',
          aggregateType: 'Event',
          aggregateId: task.eventId,
          payload,
          deduplicationKey: `event-progress:${taskId}:${updatedAt.toISOString()}`,
          status: OutboxStatus.PENDING,
        },
      });
      return currentProgress;
    });
    return { task: await this.getById(taskId, user.id), progress };
  }

  async replaceAssignees(taskId: string, user: AuthUser, dto: ReplaceTaskAssigneesDto) {
    const task = await this.findTask(taskId);
    if (!task) throw this.notFound('TASK_NOT_FOUND', 'Không tìm thấy công việc.');
    const membership = await this.access.requireMembership(task.eventId, user.id);
    const effective = await this.access.effectivePermissionsFor(membership);
    if (!this.access.canAssignTask(membership, task, effective)) {
      throw this.forbidden('TASK_ASSIGNMENT_PERMISSION_DENIED', 'Bạn không có quyền giao việc.');
    }
    await this.requireMutableTask(task);
    await this.prisma.$transaction(async (transaction) => {
      // Assignment diffs must be calculated from a locked row. Otherwise two
      // concurrent replace calls can both treat an old assignee set as current
      // and emit duplicate/reordered notifications.
      await transaction.$queryRaw`SELECT "id" FROM "Task" WHERE "id" = CAST(${taskId} AS uuid) FOR UPDATE`;
      const lockedTask = await transaction.task.findUnique({ where: { id: taskId }, include: taskInclude });
      if (!lockedTask) throw this.notFound('TASK_NOT_FOUND', 'Không tìm thấy công việc.');
      await this.requireMutableTask(lockedTask);
      const assignees = await this.requireActiveAssignees(transaction, lockedTask.eventId, dto.eventMemberIds);
      const nextAssigneeIds = new Set(assignees.map((assignee) => assignee.id));
      const currentAssigneeIds = new Set(lockedTask.assignees.map((assignee) => assignee.eventMemberId));
      const addedAssignees = assignees.filter((assignee) => !currentAssigneeIds.has(assignee.id));
      const removedAssigneeIds = lockedTask.assignees
        .map((assignee) => assignee.eventMemberId)
        .filter((eventMemberId) => !nextAssigneeIds.has(eventMemberId));
      if (removedAssigneeIds.length > 0) {
        await transaction.taskAssignee.deleteMany({ where: { taskId, eventMemberId: { in: removedAssigneeIds } } });
      }
      const createdAssignments = await Promise.all(addedAssignees.map((assignee) => transaction.taskAssignee.create({
        data: { taskId, eventMemberId: assignee.id },
        select: { assignmentEpisodeId: true, eventMemberId: true },
      })));
      await this.audit.record(transaction, {
        actorUserId: user.id,
        action: 'TASK_ASSIGNEES_CHANGED',
        targetType: 'Task',
        targetId: taskId,
        metadata: {
          eventId: lockedTask.eventId,
          eventMemberIds: assignees.map((assignee) => assignee.id),
          addedEventMemberIds: addedAssignees.map((assignee) => assignee.id),
          removedEventMemberIds: removedAssigneeIds,
        },
      });
      const userIdByEventMemberId = new Map(assignees.map((assignee) => [assignee.id, assignee.userId]));
      await this.notifications.createTaskAssignmentNotifications(transaction, {
        eventId: lockedTask.eventId,
        eventName: lockedTask.event.name,
        taskId,
        taskTitle: lockedTask.title,
        actorUserId: user.id,
        actorDisplayName: user.displayName,
        recipients: createdAssignments.map((assignment) => ({
          userId: userIdByEventMemberId.get(assignment.eventMemberId) ?? '',
          assignmentEpisodeId: assignment.assignmentEpisodeId,
        })).filter((recipient) => recipient.userId.length > 0),
      });
    });
    return this.getById(taskId, user.id);
  }

  async archive(taskId: string, user: AuthUser) {
    const task = await this.findTask(taskId);
    if (!task) throw this.notFound('TASK_NOT_FOUND', 'Không tìm thấy công việc.');
    const membership = await this.access.requireMembership(task.eventId, user.id);
    const effective = await this.access.effectivePermissionsFor(membership);
    if (!this.access.canArchiveTask(membership, task, effective)) {
      throw this.forbidden('TASK_ARCHIVE_PERMISSION_DENIED', 'Bạn không có quyền lưu trữ công việc.');
    }
    await this.requireMutableTask(task);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.task.update({ where: { id: taskId }, data: { archivedAt: new Date() } });
      await this.audit.record(transaction, {
        actorUserId: user.id,
        action: 'TASK_ARCHIVED',
        targetType: 'Task',
        targetId: taskId,
        metadata: { eventId: task.eventId },
      });
    });
  }

  private baseTaskFilters(query: EventTasksQueryDto, eventId?: string): Prisma.TaskWhereInput[] {
    const filters: Prisma.TaskWhereInput[] = [{ archivedAt: null }];
    if (eventId) filters.push({ eventId });
    if (query.status) filters.push({ status: query.status });
    if (query.priority) filters.push({ priority: query.priority });
    if (query.workflowStageId) filters.push({ workflowStageId: query.workflowStageId });
    if (query.departmentId) filters.push({ departmentId: query.departmentId });
    if (query.search?.trim()) filters.push({ title: { contains: query.search.trim(), mode: 'insensitive' } });
    if (query.overdue) {
      filters.push({ dueAt: { lt: new Date() }, status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] } });
    }
    return filters;
  }

  private taskOrder(sort: EventTasksQueryDto['sort']): Prisma.TaskOrderByWithRelationInput[] {
    switch (sort) {
      case 'dueAt:desc':
        return [{ dueAt: 'desc' }, { createdAt: 'desc' }];
      case 'createdAt:desc':
        return [{ createdAt: 'desc' }];
      case 'priority:desc':
        return [{ priority: 'desc' }, { dueAt: 'asc' }];
      case 'dueAt:asc':
      default:
        return [{ dueAt: 'asc' }, { createdAt: 'desc' }];
    }
  }

  private sortMyTasks(tasks: DetailedTask[], sort: EventTasksQueryDto['sort']): void {
    if (sort) {
      const order = this.taskOrder(sort);
      if (order[0]?.dueAt === 'desc') tasks.sort((left, right) => right.dueAt.getTime() - left.dueAt.getTime());
      else if (order[0]?.createdAt === 'desc') tasks.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
      else if (order[0]?.priority === 'desc') tasks.sort((left, right) => this.priorityValue(right.priority) - this.priorityValue(left.priority));
      else tasks.sort((left, right) => left.dueAt.getTime() - right.dueAt.getTime());
      return;
    }
    tasks.sort((left, right) => {
      const overdueDifference = Number(this.isOverdue(right)) - Number(this.isOverdue(left));
      if (overdueDifference !== 0) return overdueDifference;
      const dueDifference = left.dueAt.getTime() - right.dueAt.getTime();
      return dueDifference !== 0 ? dueDifference : right.createdAt.getTime() - left.createdAt.getTime();
    });
  }

  private taskListItem(task: DetailedTask, membership: EventMembershipRecord, effective: EffectiveEventPermissions) {
    return {
      id: task.id,
      eventId: task.eventId,
      eventName: task.event.name,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      origin: task.origin,
      templateKey: task.templateKey,
      dueAt: task.dueAt.toISOString(),
      completedAt: task.completedAt ? task.completedAt.toISOString() : null,
      workflowStage: task.workflowStage,
      department: task.department,
      assignees: task.assignees.map((assignee) => ({
        eventMemberId: assignee.eventMemberId,
        userId: assignee.eventMember.userId,
        displayName: assignee.eventMember.user.displayName,
        email: assignee.eventMember.user.email,
        role: assignee.eventMember.role,
        department: assignee.eventMember.department,
      })),
      isOverdue: this.isOverdue(task),
      capabilities: this.capabilities(task, membership, effective),
    };
  }

  private async taskDetail(task: DetailedTask, membership: EventMembershipRecord, effective: EffectiveEventPermissions) {
    const listItem = this.taskListItem(task, membership, effective);
    const assignerMembership = await this.prisma.eventMember.findUnique({
      where: { eventId_userId: { eventId: task.eventId, userId: task.assignedById } },
      select: { role: true },
    });
    return {
      ...listItem,
      assignedBy: {
        userId: task.assignedBy.id,
        displayName: task.assignedBy.displayName,
        email: task.assignedBy.email,
        role: assignerMembership?.role ?? EventMemberRole.MEMBER,
      },
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      attachments: task.attachments.map((attachment) => ({
        id: attachment.id,
        originalFileName: attachment.originalFileName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        uploadedBy: {
          userId: attachment.uploadedBy.id,
          displayName: attachment.uploadedBy.displayName,
          email: attachment.uploadedBy.email,
        },
        createdAt: attachment.createdAt.toISOString(),
        downloadPath: `/api/v1/tasks/${task.id}/attachments/${attachment.id}/download`,
      })),
    };
  }

  private capabilities(task: DetailedTask, membership: EventMembershipRecord, effective: EffectiveEventPermissions) {
    const canManage = this.access.canManageTask(membership, task, effective);
    const canUpdateStatus = this.access.canManageTaskStatus(membership, task, effective);
    const isAssigned = task.assignees.some((assignee) => assignee.eventMemberId === membership.id);
    const statusActor: TaskTransitionActor = canManage
      || this.access.hasDelegatedPermission(effective, EventDelegatedPermission.TASK_UPDATE_STATUS_ANY)
      ? 'MANAGER'
      : 'ASSIGNED_MEMBER';
    return {
      canView: true,
      canUpdate: canManage,
      canMoveStage: this.access.canMoveTask(membership, task, effective),
      canAssign: this.access.canAssignTask(membership, task, effective),
      canArchive: this.access.canArchiveTask(membership, task, effective),
      canUploadAttachment: (canManage && effective.effectivePermissions.includes('attachment:upload:any'))
        || (isAssigned && effective.effectivePermissions.includes('attachment:upload:assigned')),
      allowedStatusTransitions: canUpdateStatus
        ? Object.values(TaskStatus).filter((status) => isAllowedTaskStatusTransition(statusActor, task.status, status))
        : [],
    };
  }

  private async findTask(taskId: string): Promise<DetailedTask | null> {
    return this.prisma.task.findUnique({ where: { id: taskId }, include: taskInclude });
  }

  private async requireMutableEvent(eventId: string): Promise<void> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, select: { archivedAt: true, status: true } });
    if (!event) throw this.notFound('EVENT_NOT_FOUND', 'Không tìm thấy sự kiện.');
    if (event.archivedAt || event.status === EventStatus.ARCHIVED) {
      throw new DomainException(HttpStatus.CONFLICT, 'EVENT_ARCHIVED', 'Sự kiện đã được lưu trữ.');
    }
  }

  private async requireMutableTask(task: { eventId: string; archivedAt: Date | null; event: { archivedAt: Date | null; status: EventStatus } }): Promise<void> {
    if (task.archivedAt) {
      throw new DomainException(HttpStatus.CONFLICT, 'TASK_ARCHIVED', 'Công việc đã được lưu trữ.');
    }
    if (task.event.archivedAt || task.event.status === EventStatus.ARCHIVED) {
      throw new DomainException(HttpStatus.CONFLICT, 'EVENT_ARCHIVED', 'Sự kiện đã được lưu trữ.');
    }
  }

  private async requireWorkflowStage(eventId: string, workflowStageId: string): Promise<void> {
    const stage = await this.prisma.workflowStage.findFirst({ where: { id: workflowStageId, eventId }, select: { id: true } });
    if (!stage) {
      throw new DomainException(HttpStatus.BAD_REQUEST, 'TASK_STAGE_CROSS_EVENT', 'Workflow stage phải thuộc cùng sự kiện.');
    }
  }

  private async requireDepartment(eventId: string, departmentId: string | null): Promise<void> {
    if (departmentId === null) return;
    const department = await this.prisma.department.findFirst({ where: { id: departmentId, eventId }, select: { id: true } });
    if (!department) {
      throw new DomainException(HttpStatus.BAD_REQUEST, 'TASK_DEPARTMENT_CROSS_EVENT', 'Phòng ban phải thuộc cùng sự kiện.');
    }
  }

  private async requireActiveAssignees(
    client: PrismaService | Prisma.TransactionClient,
    eventId: string,
    ids: string[],
  ): Promise<Array<{ id: string; userId: string }>> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length !== ids.length) {
      throw new DomainException(HttpStatus.BAD_REQUEST, 'TASK_ASSIGNEES_DUPLICATED', 'Không thể giao công việc trùng lặp cho một thành viên.');
    }
    const members = await client.eventMember.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, userId: true, eventId: true, status: true, user: { select: { status: true } } },
    });
    if (members.length !== uniqueIds.length) {
      throw new DomainException(HttpStatus.BAD_REQUEST, 'TASK_ASSIGNEE_INACTIVE', 'Không tìm thấy thành viên được giao đang hoạt động.');
    }
    if (members.some((member) => member.eventId !== eventId)) {
      throw new DomainException(HttpStatus.BAD_REQUEST, 'TASK_ASSIGNEE_CROSS_EVENT', 'Người được giao phải thuộc cùng sự kiện.');
    }
    if (members.some((member) => member.status !== EventMemberStatus.ACTIVE || member.user.status !== UserStatus.ACTIVE)) {
      throw new DomainException(HttpStatus.BAD_REQUEST, 'TASK_ASSIGNEE_INACTIVE', 'Người được giao phải đang hoạt động.');
    }
    return members.map((member) => ({ id: member.id, userId: member.userId }));
  }

  private assertTaskManageAllowed(
    membership: EventMembershipRecord,
    task: { departmentId: string | null; createdById: string; origin: TaskOrigin; assignees: Array<{ eventMemberId: string }> },
    effective: EffectiveEventPermissions,
  ): void {
    if (!this.access.canManageTask(membership, task, effective)) {
      throw this.forbidden('TASK_UPDATE_PERMISSION_DENIED', 'Bạn không có quyền chỉnh sửa công việc này.');
    }
  }

  private asDate(value: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new DomainException(HttpStatus.BAD_REQUEST, 'TASK_DUE_DATE_INVALID', 'Hạn hoàn thành không hợp lệ.');
    }
    return date;
  }

  private isOverdue(task: { dueAt: Date; status: TaskStatus; archivedAt: Date | null }): boolean {
    return !task.archivedAt
      && task.dueAt.getTime() < Date.now()
      && task.status !== TaskStatus.DONE
      && task.status !== TaskStatus.CANCELLED;
  }

  private priorityValue(priority: TaskPriority): number {
    switch (priority) {
      case TaskPriority.URGENT: return 4;
      case TaskPriority.HIGH: return 3;
      case TaskPriority.MEDIUM: return 2;
      case TaskPriority.LOW: return 1;
    }
  }

  private emptyPage(query: MyTasksQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    return { items: [], page, pageSize, total: 0, totalPages: 1 };
  }

  private forbidden(code: string, message: string): DomainException {
    return new DomainException(HttpStatus.FORBIDDEN, code, message);
  }

  private notFound(code: string, message: string): DomainException {
    return new DomainException(HttpStatus.NOT_FOUND, code, message);
  }
}
