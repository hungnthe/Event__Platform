'use client';

import type { TaskListItem } from '@eventflow/contracts';
import { TaskRow } from './task-row';

export function TaskList({ tasks, showEvent = false, onTaskUpdated }: Readonly<{ tasks: TaskListItem[]; showEvent?: boolean; onTaskUpdated: (task: TaskListItem) => void }>) {
  return <div className="space-y-3">{tasks.map((task) => <TaskRow key={task.id} task={task} showEvent={showEvent} onTaskUpdated={onTaskUpdated} />)}</div>;
}
