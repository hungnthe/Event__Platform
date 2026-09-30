import { TaskStatus } from '@prisma/client';
import { calculatePersonalTaskProgress, isAllowedTaskStatusTransition } from './task-rules';

describe('isAllowedTaskStatusTransition', () => {
  it.each([
    [TaskStatus.NOT_STARTED, TaskStatus.IN_PROGRESS],
    [TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
    [TaskStatus.IN_PROGRESS, TaskStatus.DONE],
    [TaskStatus.BLOCKED, TaskStatus.IN_PROGRESS],
  ])('allows an assigned member to move %s to %s', (from, to) => {
    expect(isAllowedTaskStatusTransition('ASSIGNED_MEMBER', from, to)).toBe(true);
  });

  it.each([
    [TaskStatus.NOT_STARTED, TaskStatus.DONE],
    [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
    [TaskStatus.IN_REVIEW, TaskStatus.DONE],
    [TaskStatus.DONE, TaskStatus.IN_PROGRESS],
    [TaskStatus.CANCELLED, TaskStatus.NOT_STARTED],
  ])('rejects an unauthorized assigned-member transition from %s to %s', (from, to) => {
    expect(isAllowedTaskStatusTransition('ASSIGNED_MEMBER', from, to)).toBe(false);
  });

  it.each([
    [TaskStatus.NOT_STARTED, TaskStatus.IN_PROGRESS],
    [TaskStatus.BLOCKED, TaskStatus.DONE],
    [TaskStatus.IN_REVIEW, TaskStatus.CANCELLED],
    [TaskStatus.DONE, TaskStatus.IN_PROGRESS],
    [TaskStatus.CANCELLED, TaskStatus.NOT_STARTED],
  ])('allows a manager transition from %s to %s', (from, to) => {
    expect(isAllowedTaskStatusTransition('MANAGER', from, to)).toBe(true);
  });

  it.each([
    ['ASSIGNED_MEMBER' as const, TaskStatus.NOT_STARTED],
    ['MANAGER' as const, TaskStatus.DONE],
  ])('rejects a no-op transition for %s', (actor, status) => {
    expect(isAllowedTaskStatusTransition(actor, status, status)).toBe(false);
  });
});

describe('calculatePersonalTaskProgress', () => {
  it('excludes cancelled and archived tasks from both denominator and numerator', () => {
    const progress = calculatePersonalTaskProgress([
      { status: TaskStatus.DONE, archivedAt: null },
      { status: TaskStatus.IN_PROGRESS, archivedAt: null },
      { status: TaskStatus.CANCELLED, archivedAt: null },
      { status: TaskStatus.DONE, archivedAt: new Date('2026-01-01T00:00:00.000Z') },
    ]);

    expect(progress).toEqual({ assigned: 2, completed: 1, percentage: 50 });
  });

  it('rounds the completed active-task percentage and returns zero for no active tasks', () => {
    expect(calculatePersonalTaskProgress([
      { status: TaskStatus.DONE, archivedAt: null },
      { status: TaskStatus.IN_PROGRESS, archivedAt: null },
      { status: TaskStatus.NOT_STARTED, archivedAt: null },
    ])).toEqual({ assigned: 3, completed: 1, percentage: 33 });
    expect(calculatePersonalTaskProgress([
      { status: TaskStatus.CANCELLED, archivedAt: null },
      { status: TaskStatus.DONE, archivedAt: new Date('2026-01-01T00:00:00.000Z') },
    ])).toEqual({ assigned: 0, completed: 0, percentage: 0 });
  });
});
