import { TaskStatus } from '@prisma/client';

export type TaskTransitionActor = 'ASSIGNED_MEMBER' | 'MANAGER';

export interface ProgressTask {
  status: TaskStatus;
  archivedAt: Date | null;
}

export function isAllowedTaskStatusTransition(
  actor: TaskTransitionActor,
  from: TaskStatus,
  to: TaskStatus,
): boolean {
  if (from === to) return false;
  if (actor === 'ASSIGNED_MEMBER') {
    return (from === TaskStatus.NOT_STARTED && to === TaskStatus.IN_PROGRESS)
      || (from === TaskStatus.IN_PROGRESS && (to === TaskStatus.BLOCKED || to === TaskStatus.DONE))
      || (from === TaskStatus.BLOCKED && to === TaskStatus.IN_PROGRESS);
  }
  if (from === TaskStatus.CANCELLED) return to === TaskStatus.NOT_STARTED;
  if (from === TaskStatus.DONE) return to === TaskStatus.IN_PROGRESS;
  if (from === TaskStatus.IN_PROGRESS && to === TaskStatus.IN_REVIEW) return true;
  return to === TaskStatus.IN_PROGRESS || to === TaskStatus.DONE || to === TaskStatus.CANCELLED;
}

export function calculatePersonalTaskProgress(tasks: ProgressTask[]): { assigned: number; completed: number; percentage: number } {
  let assigned = 0;
  let completed = 0;
  for (const task of tasks) {
    if (task.archivedAt || task.status === TaskStatus.CANCELLED) continue;
    assigned += 1;
    if (task.status === TaskStatus.DONE) completed += 1;
  }
  return {
    assigned,
    completed,
    percentage: assigned === 0 ? 0 : Math.round((completed / assigned) * 100),
  };
}
