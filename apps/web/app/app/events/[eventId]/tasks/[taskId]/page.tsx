'use client';

import { useParams } from 'next/navigation';
import { TaskDetailPage } from './task-detail-page';

export default function TaskDetailRoute() {
  const params = useParams<{ eventId: string; taskId: string }>();
  return <TaskDetailPage eventId={params.eventId} taskId={params.taskId} />;
}
