'use client';

import { useParams } from 'next/navigation';
import { TaskFormPage } from '../task-form-page';

export default function NewTaskRoute() {
  const params = useParams<{ eventId: string }>();
  return <TaskFormPage eventId={params.eventId} />;
}
