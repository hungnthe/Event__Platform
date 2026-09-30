import * as argon2 from 'argon2';
import {
  EventMemberRole,
  EventMemberStatus,
  EventStatus,
  PrismaClient,
  UserStatus,
} from '@prisma/client';

/**
 * Local-only fixture for the documented A/B/C notification acceptance flow.
 * It never runs outside development and requires the password at execution
 * time, so no reusable login secret is committed to the repository.
 */
const prisma = new PrismaClient();
const QA_MARKER = '[eventflow-qa:sprint3]';
const QA_PASSWORD = process.env.EVENTFLOW_QA_PASSWORD;

const QA_USERS = [
  { email: 'qa.owner@eventflow.local', displayName: 'QA Owner A' },
  { email: 'qa.assigner@eventflow.local', displayName: 'QA Assigner B' },
  { email: 'qa.member@eventflow.local', displayName: 'QA Member C' },
] as const;

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Sprint 3 QA seed only runs in NODE_ENV=development.');
  }
  if (!QA_PASSWORD || QA_PASSWORD.length < 12) {
    throw new Error('Set EVENTFLOW_QA_PASSWORD to a development-only value of at least 12 characters.');
  }

  const passwordHash = await argon2.hash(QA_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  const users = await Promise.all(QA_USERS.map(({ email, displayName }) => prisma.user.upsert({
    where: { email },
    update: {
      displayName,
      passwordHash,
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
      failedLoginCount: 0,
      lastFailedLoginAt: null,
      lockedUntil: null,
    },
    create: {
      email,
      displayName,
      passwordHash,
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
    },
  })));
  const [owner, assigner, member] = users;
  if (!owner || !assigner || !member) throw new Error('Could not create local QA users.');

  const now = new Date();
  const existing = await prisma.event.findFirst({
    where: { createdById: owner.id, description: { contains: QA_MARKER } },
    select: { id: true },
  });
  const event = existing
    ? await prisma.event.update({
      where: { id: existing.id },
      data: {
        name: 'Sprint 3 QA Notification Flow',
        description: `Local A/B/C acceptance fixture ${QA_MARKER}`,
        locationName: 'Local development',
        startsAt: new Date(now.getTime() - 60 * 60 * 1000),
        endsAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        status: EventStatus.ONGOING,
        archivedAt: null,
      },
    })
    : await prisma.event.create({
      data: {
        name: 'Sprint 3 QA Notification Flow',
        description: `Local A/B/C acceptance fixture ${QA_MARKER}`,
        locationName: 'Local development',
        startsAt: new Date(now.getTime() - 60 * 60 * 1000),
        endsAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        status: EventStatus.ONGOING,
        createdById: owner.id,
        workflowStages: {
          create: [
            { code: 'TODO', name: 'To do', order: 1 },
            { code: 'DONE', name: 'Done', order: 2 },
          ],
        },
      },
    });

  const department = await prisma.department.upsert({
    where: { eventId_name: { eventId: event.id, name: 'QA' } },
    update: { description: 'Local-only acceptance-test department.' },
    create: { eventId: event.id, name: 'QA', description: 'Local-only acceptance-test department.' },
  });
  await prisma.workflowStage.upsert({
    where: { eventId_code: { eventId: event.id, code: 'TODO' } },
    update: { name: 'To do', order: 1 },
    create: { eventId: event.id, code: 'TODO', name: 'To do', order: 1 },
  });
  await prisma.workflowStage.upsert({
    where: { eventId_code: { eventId: event.id, code: 'DONE' } },
    update: { name: 'Done', order: 2 },
    create: { eventId: event.id, code: 'DONE', name: 'Done', order: 2 },
  });

  const memberships = await Promise.all([
    prisma.eventMember.upsert({
      where: { eventId_userId: { eventId: event.id, userId: owner.id } },
      update: { role: EventMemberRole.OWNER, status: EventMemberStatus.ACTIVE, departmentId: department.id },
      create: { eventId: event.id, userId: owner.id, role: EventMemberRole.OWNER, status: EventMemberStatus.ACTIVE, departmentId: department.id },
    }),
    prisma.eventMember.upsert({
      where: { eventId_userId: { eventId: event.id, userId: assigner.id } },
      update: { role: EventMemberRole.MEMBER, status: EventMemberStatus.ACTIVE, departmentId: department.id },
      create: { eventId: event.id, userId: assigner.id, role: EventMemberRole.MEMBER, status: EventMemberStatus.ACTIVE, departmentId: department.id },
    }),
    prisma.eventMember.upsert({
      where: { eventId_userId: { eventId: event.id, userId: member.id } },
      update: { role: EventMemberRole.MEMBER, status: EventMemberStatus.ACTIVE, departmentId: department.id },
      create: { eventId: event.id, userId: member.id, role: EventMemberRole.MEMBER, status: EventMemberStatus.ACTIVE, departmentId: department.id },
    }),
  ]);

  // Make reruns deterministic: B starts as a normal member and A grants the
  // two required permissions through the actual API in the acceptance flow.
  await prisma.eventMemberPermissionGrant.updateMany({
    where: { eventId: event.id, granteeEventMemberId: memberships[1].id, revokedAt: null },
    data: { revokedAt: now, revokedByEventMemberId: memberships[0].id },
  });

  console.info(JSON.stringify({
    eventId: event.id,
    workflowStageId: (await prisma.workflowStage.findUnique({
      where: { eventId_code: { eventId: event.id, code: 'TODO' } },
      select: { id: true },
    }))?.id,
    ownerEmail: owner.email,
    assignerEmail: assigner.email,
    memberEmail: member.email,
  }));
}

void main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Sprint 3 QA seed failed.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
