'use client';

import { useParams } from 'next/navigation';
import { TaskFormPage } from '../../task-form-page';

export default function EditTaskRoute() {
  const params = useParams<{ eventId: string; taskId: string }>();
  return <TaskFormPage eventId={params.eventId} taskId={params.taskId} />;
}
