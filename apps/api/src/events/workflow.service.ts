import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  EventWorkflowSummary,
  EventProgressResponse,
  WorkflowAssignmentStrategy,
  WorkflowInitializationResponse,
} from '@eventflow/contracts';
import { EventMemberRole, EventMemberStatus, EventStatus, Prisma, TaskStatus, UserStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { DomainException } from '../common/domain.exception';
import { PrismaService } from '../prisma/prisma.service';
import { EventAccessService, type EventMembershipRecord } from './event-access.service';
import { EventProgressService } from './event-progress.service';
import { InitializeWorkflowDto } from './dto/workflow.dto';
import {
  BASIC_EVENT_WORKFLOW_V1,
  basicEventWorkflowV1,
  canonicalWorkflowStages,
  type StarterWorkflowTask,
} from './workflow-template';

interface WorkflowEventRecord {
  id: string;
  name: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  status: EventStatus;
  archivedAt: Date | null;
  workflowTemplateVersion: string | null;
  workflowInitializedAt: Date | null;
  workflowStages: Array<{ id: string; code: string; name: string; order: number }>;
  tasks: Array<{ workflowStageId: string; status: TaskStatus; dueAt: Date; archivedAt: Date | null }>;
}

export function starterTaskDueAt(
  event: Pick<WorkflowEventRecord, 'startsAt' | 'endsAt'>,
  initializedAt: Date,
  task: Pick<StarterWorkflowTask, 'dueOffset'>,
): Date {
  const anchor = task.dueOffset.anchor === 'START' ? event.startsAt : event.endsAt;
  const historicalDueAt = new Date(anchor.getTime() + task.dueOffset.milliseconds);

  // A retrospective workflow must keep its historical dates. For an upcoming
  // event, prevent a late initialization from creating a due date before the
  // workflow existed, while still never moving a pre-event item beyond start.
  if (event.startsAt.getTime() <= initializedAt.getTime()) return historicalDueAt;
  if (task.dueOffset.anchor !== 'START') return historicalDueAt;
  return new Date(Math.min(event.startsAt.getTime(), Math.max(initializedAt.getTime(), historicalDueAt.getTime())));
}

@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessService,
    private readonly audit: AuditService,
    private readonly progress: EventProgressService,
  ) {}

  async get(eventId: string, userId: string): Promise<EventWorkflowSummary> {
    const membership = await this.access.requireMembership(eventId, userId);
    const effective = await this.access.effectivePermissionsFor(membership);
    const event = await this.loadEvent(eventId);
    if (!event) throw this.notFound();
    const progress = await this.progress.calculate(eventId, membership.id);
    return this.summary(event, membership, effective.effectivePermissions, progress);
  }

  async initialize(
    eventId: string,
    userId: string,
    dto: InitializeWorkflowDto,
  ): Promise<WorkflowInitializationResponse> {
    const membership = await this.access.requirePermission(eventId, userId, 'workflow:initialize');
    const effective = await this.access.effectivePermissionsFor(membership);
    if (!effective.effectivePermissions.includes('task:create') || !effective.effectivePermissions.includes('task:assign')) {
      throw this.forbidden('WORKFLOW_INITIALIZATION_FORBIDDEN', 'Bạn không có quyền khởi tạo quy trình này.');
    }

    const result = await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = CAST(${eventId} AS uuid) FOR UPDATE`;
      const event = await transaction.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          archivedAt: true,
          status: true,
          workflowInitializedAt: true,
          workflowTemplateVersion: true,
        },
      });
      if (!event) throw this.notFound();
      if (event.archivedAt || event.status === EventStatus.ARCHIVED) {
        throw new DomainException(HttpStatus.CONFLICT, 'EVENT_ARCHIVED', 'Không thể khởi tạo quy trình cho sự kiện đã lưu trữ.');
      }

      const actorMembership = await transaction.eventMember.findFirst({
        where: {
          id: membership.id,
          eventId,
          status: EventMemberStatus.ACTIVE,
          user: { status: UserStatus.ACTIVE },
        },
        select: { id: true, userId: true },
      });
      if (!actorMembership) {
        throw this.forbidden('EVENT_MEMBERSHIP_REQUIRED', 'Bạn không còn là thành viên hoạt động của sự kiện này.');
      }

      const assignee = await this.assignmentRecipient(transaction, eventId, actorMembership, dto.assignmentStrategy);
      const existingStages = await transaction.workflowStage.findMany({
        where: { eventId },
        select: { id: true, code: true, order: true },
      });
      const existingStageByCode = new Map(existingStages.map((stage) => [stage.code, stage]));
      let nextStageOrder = existingStages.reduce((maximum, stage) => Math.max(maximum, stage.order), 0) + 1;
      const stageIdByCode = new Map<string, string>();
      for (const stage of canonicalWorkflowStages) {
        const existing = existingStageByCode.get(stage.code);
        const saved = existing
          ? await transaction.workflowStage.update({
            where: { id: existing.id },
            data: { name: stage.name },
            select: { id: true },
          })
          : await transaction.workflowStage.create({
            data: { eventId, code: stage.code, name: stage.name, order: nextStageOrder++ },
            select: { id: true },
          });
        stageIdByCode.set(stage.code, saved.id);
      }

      const existingTemplateTasks = await transaction.task.findMany({
        where: { eventId, templateKey: { in: basicEventWorkflowV1.map((task) => task.templateKey) } },
        select: { templateKey: true },
      });
      const existingTemplateKeys = new Set(existingTemplateTasks.flatMap((task) => task.templateKey === null ? [] : [task.templateKey]));
      const initializedAt = event.workflowInitializedAt ?? new Date();
      let createdTaskCount = 0;

      for (const task of basicEventWorkflowV1) {
        if (existingTemplateKeys.has(task.templateKey)) continue;
        const workflowStageId = stageIdByCode.get(task.stageCode);
        if (!workflowStageId) {
          throw new DomainException(HttpStatus.INTERNAL_SERVER_ERROR, 'WORKFLOW_STAGE_INVARIANT_FAILED', 'Thiếu giai đoạn quy trình chuẩn.');
        }
        await transaction.task.create({
          data: {
            eventId,
            workflowStageId,
            title: task.title,
            description: task.description,
            priority: task.priority,
            origin: task.origin,
            templateKey: task.templateKey,
            dueAt: starterTaskDueAt(event, initializedAt, task),
            createdById: userId,
            assignedById: userId,
            assignees: { create: { eventMemberId: assignee.id } },
          },
        });
        createdTaskCount += 1;
      }

      await transaction.event.update({
        where: { id: eventId },
        data: {
          workflowTemplateVersion: BASIC_EVENT_WORKFLOW_V1,
          workflowInitializedAt: initializedAt,
        },
      });
      await this.audit.record(transaction, {
        actorUserId: userId,
        action: event.workflowInitializedAt ? 'EVENT_WORKFLOW_TEMPLATE_REPAIRED' : 'EVENT_WORKFLOW_INITIALIZED',
        targetType: 'Event',
        targetId: eventId,
        metadata: {
          templateVersion: dto.templateVersion,
          assignmentStrategy: dto.assignmentStrategy,
          createdTaskCount,
          existingTaskCount: basicEventWorkflowV1.length - createdTaskCount,
        },
      });
      return { createdTaskCount, existingTaskCount: basicEventWorkflowV1.length - createdTaskCount };
    });

    return {
      initialized: true,
      createdTaskCount: result.createdTaskCount,
      existingTaskCount: result.existingTaskCount,
      templateVersion: BASIC_EVENT_WORKFLOW_V1,
      workflow: await this.get(eventId, userId),
    };
  }

  private async assignmentRecipient(
    transaction: Prisma.TransactionClient,
    eventId: string,
    actor: { id: string; userId: string },
    strategy: WorkflowAssignmentStrategy,
  ): Promise<{ id: string; userId: string }> {
    if (strategy === 'CURRENT_USER') return actor;
    const departmentLead = await transaction.eventMember.findFirst({
      where: {
        eventId,
        role: EventMemberRole.DEPARTMENT_LEAD,
        status: EventMemberStatus.ACTIVE,
        user: { status: UserStatus.ACTIVE },
      },
      orderBy: { joinedAt: 'asc' },
      select: { id: true, userId: true },
    });
    return departmentLead ?? actor;
  }

  private async loadEvent(eventId: string): Promise<WorkflowEventRecord | null> {
    return this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        name: true,
        description: true,
        startsAt: true,
        endsAt: true,
        status: true,
        archivedAt: true,
        workflowTemplateVersion: true,
        workflowInitializedAt: true,
        workflowStages: { select: { id: true, code: true, name: true, order: true }, orderBy: { order: 'asc' } },
        tasks: { select: { workflowStageId: true, status: true, dueAt: true, archivedAt: true } },
      },
    });
  }

  private summary(
    event: WorkflowEventRecord,
    membership: EventMembershipRecord,
    permissions: EventWorkflowSummary['permissions'],
    progress: EventProgressResponse,
  ): EventWorkflowSummary {
    const stageByCode = new Map(event.workflowStages.map((stage) => [stage.code, stage]));
    const canonicalStageIds = new Set(canonicalWorkflowStages.flatMap((definition) => {
      const stage = stageByCode.get(definition.code);
      return stage ? [stage.id] : [];
    }));
    const now = Date.now();
    const activeTasks = event.tasks.filter((task) => canonicalStageIds.has(task.workflowStageId) && task.archivedAt === null && task.status !== TaskStatus.CANCELLED);
    const stages = canonicalWorkflowStages.map((definition) => {
      const stage = stageByCode.get(definition.code);
      const stageProgress = progress.stages.find((entry) => entry.code === definition.code);
      const completedTaskCount = stageProgress?.completed ?? 0;
      const activeTaskCount = stageProgress?.total ?? 0;
      return {
        id: stage?.id ?? '',
        code: definition.code,
        name: stage?.name ?? definition.name,
        order: definition.order,
        label: definition.label,
        summary: definition.summary,
        iconKey: definition.iconKey,
        activeTaskCount,
        completedTaskCount,
        percentage: stageProgress?.percentage ?? 0,
      };
    });
    const overdueTaskCount = activeTasks.filter((task) => task.status !== TaskStatus.DONE && task.dueAt.getTime() < now).length;
    const blockedTaskCount = activeTasks.filter((task) => task.status === TaskStatus.BLOCKED).length;

    return {
      event: {
        id: event.id,
        name: event.name,
        description: event.description,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        status: event.status,
      },
      initialization: {
        initialized: event.workflowTemplateVersion === BASIC_EVENT_WORKFLOW_V1 && event.workflowInitializedAt !== null,
        templateVersion: event.workflowTemplateVersion,
        initializedAt: event.workflowInitializedAt?.toISOString() ?? null,
      },
      stages,
      progress: {
        activeTaskCount: progress.overall.total,
        completedTaskCount: progress.overall.completed,
        percentage: progress.overall.percentage,
        overdueTaskCount,
        blockedTaskCount,
      },
      permissions,
      role: membership.role,
    };
  }

  private forbidden(code: string, message: string): DomainException {
    return new DomainException(HttpStatus.FORBIDDEN, code, message);
  }

  private notFound(): DomainException {
    return new DomainException(HttpStatus.NOT_FOUND, 'EVENT_NOT_FOUND', 'Không tìm thấy sự kiện.');
  }
}
