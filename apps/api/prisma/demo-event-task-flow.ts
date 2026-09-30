import { Prisma, PrismaClient, SystemRole, UserStatus } from '@prisma/client';
import { normalizeEmail } from '../src/auth/auth.utils';
import { PasswordService } from '../src/auth/password.service';

const prisma = new PrismaClient();
const demoEventName = 'DEMO - Workshop Kỹ năng AI 2026';

interface DemoEnvironment {
  ownerEmail: string;
  memberEmail: string;
  password: string;
}

function environment(): DemoEnvironment {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo commands are disabled in production.');
  const ownerEmail = normalizeEmail(process.env.DEMO_OWNER_EMAIL ?? '');
  const memberEmail = normalizeEmail(process.env.DEMO_MEMBER_EMAIL ?? '');
  const password = process.env.DEMO_USER_PASSWORD ?? '';
  if (!ownerEmail || !memberEmail || ownerEmail === memberEmail) throw new Error('Demo owner and member emails must be distinct.');
  if (password.length < 12) throw new Error('DEMO_USER_PASSWORD must contain at least 12 characters.');
  return { ownerEmail, memberEmail, password };
}

async function deleteOwnedDemoEvents(transaction: Prisma.TransactionClient, ownerId: string): Promise<number> {
  const events = await transaction.event.findMany({
    where: { name: demoEventName, createdById: ownerId },
    select: {
      id: true,
      tasks: { select: { id: true } },
      members: { select: { id: true } },
      notifications: { select: { id: true } },
    },
  });
  for (const event of events) {
    const taskIds = event.tasks.map((task) => task.id);
    const memberIds = event.members.map((member) => member.id);
    const notificationIds = event.notifications.map((notification) => notification.id);
    await transaction.outboxEvent.deleteMany({
      where: {
        OR: [
          { aggregateType: 'Event', aggregateId: event.id },
          ...(taskIds.length > 0 ? [{ aggregateType: 'Task', aggregateId: { in: taskIds } }] : []),
          ...(notificationIds.length > 0 ? [{ aggregateType: 'Notification', aggregateId: { in: notificationIds } }] : []),
        ],
      },
    });
    await transaction.auditLog.deleteMany({
      where: {
        OR: [
          { targetId: event.id },
          ...(taskIds.length > 0 ? [{ targetId: { in: taskIds } }] : []),
          ...(memberIds.length > 0 ? [{ targetId: { in: memberIds } }] : []),
          { metadata: { path: ['eventId'], equals: event.id } },
        ],
      },
    });
    await transaction.notification.deleteMany({ where: { id: { in: notificationIds } } });
    await transaction.taskAssignee.deleteMany({ where: { taskId: { in: taskIds } } });
    await transaction.task.deleteMany({ where: { id: { in: taskIds } } });
    await transaction.eventMemberPermissionGrant.deleteMany({ where: { eventId: event.id } });
    await transaction.event.delete({ where: { id: event.id } });
  }
  return events.length;
}

async function prepare(): Promise<void> {
  const demo = environment();
  const passwordHash = await new PasswordService().hash(demo.password);
  await prisma.$transaction(async (transaction) => {
    const owner = await transaction.user.upsert({
      where: { email: demo.ownerEmail },
      update: { passwordHash, systemRole: SystemRole.USER, status: UserStatus.ACTIVE, mustChangePassword: false },
      create: { email: demo.ownerEmail, displayName: 'Demo Owner', passwordHash, systemRole: SystemRole.USER, status: UserStatus.ACTIVE, mustChangePassword: false },
    });
    await transaction.user.upsert({
      where: { email: demo.memberEmail },
      update: { passwordHash, systemRole: SystemRole.USER, status: UserStatus.ACTIVE, mustChangePassword: false },
      create: { email: demo.memberEmail, displayName: 'Demo Member', passwordHash, systemRole: SystemRole.USER, status: UserStatus.ACTIVE, mustChangePassword: false },
    });
    await deleteOwnedDemoEvents(transaction, owner.id);
  });
  console.info(`Owner: ${demo.ownerEmail}`);
  console.info(`Member: ${demo.memberEmail}`);
  console.info('Login: http://localhost:3000/login');
  console.info('Status: ready');
}

async function reset(): Promise<void> {
  const demo = environment();
  const owner = await prisma.user.findUnique({ where: { email: demo.ownerEmail }, select: { id: true } });
  const removed = owner ? await prisma.$transaction((transaction) => deleteOwnedDemoEvents(transaction, owner.id)) : 0;
  console.info(`Status: reset (${removed} event removed)`);
}

const mode = process.argv[2];
void (mode === 'prepare' ? prepare() : mode === 'reset' ? reset() : Promise.reject(new Error('Expected prepare or reset.')))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Demo command failed.');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
