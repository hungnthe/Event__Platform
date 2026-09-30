'use client';

import { useParams } from 'next/navigation';
import { EventWorkspace } from './event-workspace';

export default function EventDetailRoute() {
  const params = useParams<{ eventId: string }>();
  return <EventWorkspace eventId={params.eventId} />;
}
