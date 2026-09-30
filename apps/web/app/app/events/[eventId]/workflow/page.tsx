'use client';

import { useParams } from 'next/navigation';
import { WorkflowWorkspace } from './workflow-workspace';

export default function WorkflowRoute() {
  const params = useParams<{ eventId: string }>();
  return <WorkflowWorkspace eventId={params.eventId} />;
}
