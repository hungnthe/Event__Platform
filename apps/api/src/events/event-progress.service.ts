import { Injectable } from '@nestjs/common';
import type { EventProgressResponse, ProgressCount, StageProgress } from '@eventflow/contracts';
import { Prisma, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventAccessService } from './event-access.service';

type ProgressClient = Pick<Prisma.TransactionClient, 'task' | 'workflowStage'>;

function count(completed: number, total: number): ProgressCount {
  return {
    completed,
    total,
    percentage: total === 0 ? 0 : Math.min(100, Math.max(0, Math.round((completed / total) * 100))),
  };
}

@Injectable()
export class EventProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EventAccessService,
  ) {}

  async forUser(eventId: string, userId: string): Promise<EventProgressResponse> {
    const membership = await this.access.requireMembership(eventId, userId);
    return this.calculate(eventId, membership.id);
  }

  async calculate(
    eventId: string,
    currentEventMemberId: string,
    transaction?: Prisma.TransactionClient,
  ): Promise<EventProgressResponse> {
    const client: ProgressClient = transaction ?? this.prisma;
    const activeWhere: Prisma.TaskWhereInput = {
      eventId,
      archivedAt: null,
      status: { not: TaskStatus.CANCELLED },
    };
    const [stages, grouped, personalGrouped] = await Promise.all([
      client.workflowStage.findMany({
        where: { eventId },
        orderBy: { order: 'asc' },
        select: { id: true, code: true, name: true, order: true },
      }),
      client.task.groupBy({
        by: ['workflowStageId', 'status'],
        where: activeWhere,
        _count: { _all: true },
      }),
      client.task.groupBy({
        by: ['status'],
        where: { ...activeWhere, assignees: { some: { eventMemberId: currentEventMemberId } } },
        _count: { _all: true },
      }),
    ]);

    const stageTotals = new Map<string, { total: number; completed: number }>();
    let overallTotal = 0;
    let overallCompleted = 0;
    for (const row of grouped) {
      const aggregate = stageTotals.get(row.workflowStageId) ?? { total: 0, completed: 0 };
      aggregate.total += row._count._all;
      overallTotal += row._count._all;
      if (row.status === TaskStatus.DONE) {
        aggregate.completed += row._count._all;
        overallCompleted += row._count._all;
      }
      stageTotals.set(row.workflowStageId, aggregate);
    }

    let personalTotal = 0;
    let personalCompleted = 0;
    for (const row of personalGrouped) {
      personalTotal += row._count._all;
      if (row.status === TaskStatus.DONE) personalCompleted += row._count._all;
    }

    const stageProgress: StageProgress[] = stages.map((stage) => {
      const aggregate = stageTotals.get(stage.id) ?? { total: 0, completed: 0 };
      return {
        workflowStageId: stage.id,
        code: stage.code,
        name: stage.name,
        order: stage.order,
        ...count(aggregate.completed, aggregate.total),
      };
    });

    return {
      eventId,
      overall: count(overallCompleted, overallTotal),
      stages: stageProgress,
      currentUser: count(personalCompleted, personalTotal),
    };
  }
}
