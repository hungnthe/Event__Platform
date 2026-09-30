import { TaskStatus } from '@prisma/client';
import { EventProgressService } from './event-progress.service';

describe('EventProgressService', () => {
  const access = { requireMembership: jest.fn() };
  const prisma = {
    workflowStage: { findMany: jest.fn() },
    task: { groupBy: jest.fn() },
  };
  const service = new EventProgressService(prisma as never, access as never);

  beforeEach(() => {
    jest.clearAllMocks();
    access.requireMembership.mockResolvedValue({ id: 'member-b' });
    prisma.workflowStage.findMany.mockResolvedValue([
      { id: 'design', code: 'DESIGN', name: 'Thiết kế', order: 1 },
      { id: 'preparation', code: 'PREPARATION', name: 'Chuẩn bị', order: 2 },
      { id: 'execution', code: 'EXECUTION', name: 'Thực thi', order: 3 },
      { id: 'feedback', code: 'FEEDBACK', name: 'Đánh giá', order: 4 },
    ]);
  });

  it('returns zero percent for an empty event and empty stages', async () => {
    prisma.task.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const result = await service.forUser('event-1', 'user-b');
    expect(result.overall).toEqual({ completed: 0, total: 0, percentage: 0 });
    expect(result.currentUser).toEqual({ completed: 0, total: 0, percentage: 0 });
    expect(result.stages).toHaveLength(4);
    expect(result.stages.every((stage) => stage.percentage === 0)).toBe(true);
  });

  it('calculates overall, stage and personal progress from active task aggregates', async () => {
    prisma.task.groupBy
      .mockResolvedValueOnce([
        { workflowStageId: 'preparation', status: TaskStatus.NOT_STARTED, _count: { _all: 1 } },
        { workflowStageId: 'preparation', status: TaskStatus.DONE, _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        { status: TaskStatus.DONE, _count: { _all: 1 } },
      ]);
    const result = await service.forUser('event-1', 'user-b');
    expect(result.overall).toEqual({ completed: 1, total: 2, percentage: 50 });
    expect(result.stages.find((stage) => stage.code === 'PREPARATION')).toEqual(expect.objectContaining({ completed: 1, total: 2, percentage: 50 }));
    expect(result.currentUser).toEqual({ completed: 1, total: 1, percentage: 100 });
    expect(prisma.task.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ archivedAt: null, status: { not: TaskStatus.CANCELLED } }),
    }));
  });
});
