'use client';

import { useParams } from 'next/navigation';
import { MembersPage } from './members-page';

export default function MembersRoute() {
  const params = useParams<{ eventId: string }>();
  return <MembersPage eventId={params.eventId} />;
}
