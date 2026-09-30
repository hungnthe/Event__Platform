import {
  CalendarCategory,
  EventMemberRole,
  EventMemberStatus,
  EventStatus,
  PrismaClient,
  TaskOrigin,
  TaskPriority,
  TaskStatus,
  UserStatus,
} from '@prisma/client';
import { BASIC_EVENT_WORKFLOW_V1, basicEventWorkflowV1 } from '../src/events/workflow-template';

const prisma = new PrismaClient();
const DEMO_MARKER = '[eventflow-demo:v1]';

interface DemoTaskSpec {
  title: string;
  description: string;
  calendarCategory: CalendarCategory;
  priority: TaskPriority;
  status: TaskStatus;
  dueInDays: number;
  assigneeIndexes: readonly number[];
}

interface DemoEventSpec {
  name: string;
  description: string;
  calendarCategory: CalendarCategory;
  locationName: string;
  status: EventStatus;
  startsInDays: number;
  endsInDays: number;
  initializeStarterWorkflow?: boolean;
  tasks: readonly DemoTaskSpec[];
}

const DEFAULT_STAGES = [
  { code: 'DESIGN', name: 'Thiết kế', order: 1 },
  { code: 'PREPARATION', name: 'Chuẩn bị', order: 2 },
  { code: 'EXECUTION', name: 'Thực thi', order: 3 },
  { code: 'FEEDBACK', name: 'Đánh giá', order: 4 },
] as const;

const DEMO_EVENTS: readonly DemoEventSpec[] = [
  {
    name: 'Đêm nhạc Tỏa Sáng',
    description: 'Dữ liệu minh họa cho không gian làm việc sự kiện đang diễn ra.',
    calendarCategory: CalendarCategory.EVENT,
    locationName: 'Nhà Văn hóa Thanh niên',
    status: EventStatus.ONGOING,
    startsInDays: -2,
    endsInDays: 7,
    initializeStarterWorkflow: true,
    tasks: [
      {
        title: 'Liên hệ nhà cung cấp âm thanh',
        description: 'Xác nhận lịch giao thiết bị và yêu cầu kỹ thuật.',
        calendarCategory: CalendarCategory.TASK,
        priority: TaskPriority.HIGH,
        status: TaskStatus.IN_PROGRESS,
        dueInDays: 2,
        assigneeIndexes: [1],
      },
      {
        title: 'Chuẩn bị danh sách khách mời',
        description: 'Rà soát danh sách khách mời và thông tin liên hệ.',
        calendarCategory: CalendarCategory.MEETING_INTERNAL,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.DONE,
        dueInDays: -1,
        assigneeIndexes: [1],
      },
    ],
  },
  {
    name: 'Hội thảo Khởi nghiệp Trẻ',
    description: 'Dữ liệu minh họa cho sự kiện sắp diễn ra.',
    calendarCategory: CalendarCategory.VOLUNTEER,
    locationName: 'Trung tâm Đổi mới sáng tạo',
    status: EventStatus.UPCOMING,
    startsInDays: 14,
    endsInDays: 15,
    tasks: [
      {
        title: 'Hỗ trợ setup sân khấu',
        description: 'Lập checklist setup, biển chỉ dẫn và khu vực đón tiếp.',
        calendarCategory: CalendarCategory.VOLUNTEER,
        priority: TaskPriority.URGENT,
        status: TaskStatus.NOT_STARTED,
        dueInDays: 10,
        assigneeIndexes: [1, 2],
      },
      {
        title: 'Xác nhận diễn giả',
        description: 'Xác nhận thời lượng trình bày và nhu cầu hậu cần.',
        calendarCategory: CalendarCategory.TASK,
        priority: TaskPriority.HIGH,
        status: TaskStatus.IN_PROGRESS,
        dueInDays: 8,
        assigneeIndexes: [0],
      },
    ],
  },
  {
    name: 'Giải chạy Vì Cộng đồng',
    description: 'Dữ liệu minh họa cho sự kiện đã kết thúc.',
    calendarCategory: CalendarCategory.OTHER,
    locationName: 'Công viên ven sông',
    status: EventStatus.ENDED,
    startsInDays: -21,
    endsInDays: -20,
    tasks: [
      {
        title: 'Tổng hợp phản hồi tình nguyện viên',
        description: 'Tổng hợp các đề xuất cải thiện cho mùa giải tiếp theo.',
        calendarCategory: CalendarCategory.OTHER,
        priority: TaskPriority.LOW,
        status: TaskStatus.DONE,
        dueInDays: -18,
        assigneeIndexes: [1],
      },
    ],
  },
  {
    name: 'Gala Tri Ân',
    description: 'Dữ liệu minh họa cho sự kiện đang chuẩn bị.',
    calendarCategory: CalendarCategory.EVENT,
    locationName: 'Khách sạn Riverside',
    status: EventStatus.UPCOMING,
    startsInDays: 35,
    endsInDays: 36,
    tasks: [
      {
        title: 'Chốt phương án trang trí',
        description: 'So sánh báo giá và chọn phương án trang trí phù hợp.',
        calendarCategory: CalendarCategory.MEETING_INTERNAL,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.BLOCKED,
        dueInDays: 21,
        assigneeIndexes: [1],
      },
    ],
  },
  {
    name: 'Phiên họp Điều phối tháng',
    description: 'Dữ liệu minh họa cho lịch họp nội bộ và các việc cần xử lý ngay.',
    calendarCategory: CalendarCategory.MEETING_INTERNAL,
    locationName: 'Phòng họp EventFlow',
    status: EventStatus.ONGOING,
    startsInDays: -1,
    endsInDays: 1,
    tasks: [
      {
        title: 'Chốt biên bản cuộc họp',
        description: 'Tổng hợp quyết định, người phụ trách và hạn hoàn thành sau phiên họp.',
        calendarCategory: CalendarCategory.MEETING_INTERNAL,
        priority: TaskPriority.HIGH,
        status: TaskStatus.IN_REVIEW,
        dueInDays: 1,
        assigneeIndexes: [0],
      },
      {
        title: 'Cập nhật bảng phân công tuần',
        description: 'Đồng bộ đầu việc của các nhóm vận hành, nội dung và hậu cần.',
        calendarCategory: CalendarCategory.TASK,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.NOT_STARTED,
        dueInDays: 2,
        assigneeIndexes: [1],
      },
    ],
  },
  {
    name: 'Chuỗi tọa đàm Công nghệ & Cộng đồng',
    description: 'Dữ liệu minh họa cho một chương trình nhiều đầu việc và thành viên phối hợp.',
    calendarCategory: CalendarCategory.EVENT,
    locationName: 'Không gian Sáng tạo Quận 3',
    status: EventStatus.UPCOMING,
    startsInDays: 5,
    endsInDays: 5,
    tasks: [
      {
        title: 'Duyệt agenda và kịch bản điều phối',
        description: 'Kiểm tra thời lượng từng phiên, lời dẫn và phương án chuyển tiếp.',
        calendarCategory: CalendarCategory.MEETING_INTERNAL,
        priority: TaskPriority.HIGH,
        status: TaskStatus.IN_REVIEW,
        dueInDays: 2,
        assigneeIndexes: [0],
      },
      {
        title: 'Kiểm tra thiết bị trình chiếu',
        description: 'Xác nhận máy chiếu, micro, đường truyền và phương án dự phòng.',
        calendarCategory: CalendarCategory.TASK,
        priority: TaskPriority.HIGH,
        status: TaskStatus.NOT_STARTED,
        dueInDays: 4,
        assigneeIndexes: [1],
      },
      {
        title: 'Phân công bàn đón tiếp',
        description: 'Bố trí tình nguyện viên theo ca và chuẩn bị danh sách khách mời.',
        calendarCategory: CalendarCategory.VOLUNTEER,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.IN_PROGRESS,
        dueInDays: 3,
        assigneeIndexes: [0, 2],
      },
    ],
  },
  {
    name: 'Ngày hội Kết nối Tình nguyện viên',
    description: 'Dữ liệu minh họa cho hoạt động tuyển và điều phối tình nguyện viên.',
    calendarCategory: CalendarCategory.VOLUNTEER,
    locationName: 'Công viên Gia Định',
    status: EventStatus.UPCOMING,
    startsInDays: 9,
    endsInDays: 9,
    tasks: [
      {
        title: 'Mở đăng ký ca trực',
        description: 'Xuất biểu mẫu, rà soát số lượng nhân sự và giờ làm việc của từng khu vực.',
        calendarCategory: CalendarCategory.VOLUNTEER,
        priority: TaskPriority.URGENT,
        status: TaskStatus.IN_PROGRESS,
        dueInDays: 5,
        assigneeIndexes: [2],
      },
      {
        title: 'Chuẩn bị bộ nhận diện khu vực',
        description: 'In bảng chỉ dẫn, thẻ tên và vật tư cho các quầy hoạt động.',
        calendarCategory: CalendarCategory.TASK,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.BLOCKED,
        dueInDays: 6,
        assigneeIndexes: [0, 1],
      },
      {
        title: 'Rà soát checklist an toàn',
        description: 'Đối chiếu lối thoát hiểm, điểm y tế và phương án ứng phó thời tiết.',
        calendarCategory: CalendarCategory.OTHER,
        priority: TaskPriority.HIGH,
        status: TaskStatus.DONE,
        dueInDays: -1,
        assigneeIndexes: [0],
      },
    ],
  },
];

function addDays(base: Date, offset: number): Date {
  return new Date(base.getTime() + offset * 24 * 60 * 60 * 1000);
}

async function ensureDemoEvent(spec: DemoEventSpec, ownerId: string, now: Date) {
  const description = `${spec.description} ${DEMO_MARKER}`;
  const data = {
    name: spec.name,
    description,
    locationName: spec.locationName,
    startsAt: addDays(now, spec.startsInDays),
    endsAt: addDays(now, spec.endsInDays),
    status: spec.status,
    calendarCategory: spec.calendarCategory,
    archivedAt: null,
  };
  const existing = await prisma.event.findFirst({
    where: { createdById: ownerId, name: spec.name, description: { contains: DEMO_MARKER } },
    select: { id: true },
  });

  if (existing) {
    return prisma.event.update({ where: { id: existing.id }, data });
  }

  return prisma.event.create({
    data: {
      ...data,
      createdById: ownerId,
      workflowStages: { create: DEFAULT_STAGES.map((stage) => ({ ...stage })) },
    },
  });
}

async function seedEvent(spec: DemoEventSpec, ownerId: string, memberUserIds: readonly string[], now: Date): Promise<void> {
  const event = await ensureDemoEvent(spec, ownerId, now);
  const department = await prisma.department.upsert({
    where: { eventId_name: { eventId: event.id, name: 'Điều phối' } },
    update: { description: 'Nhóm điều phối dữ liệu minh họa.' },
    create: { eventId: event.id, name: 'Điều phối', description: 'Nhóm điều phối dữ liệu minh họa.' },
  });

  const stages = await Promise.all(DEFAULT_STAGES.map((stage) => prisma.workflowStage.upsert({
    where: { eventId_code: { eventId: event.id, code: stage.code } },
    update: { name: stage.name, order: stage.order },
    create: { eventId: event.id, ...stage },
  })));
  const preparationStage = stages.find((stage) => stage.code === 'PREPARATION');
  if (!preparationStage) {
    throw new Error('Demo workflow stage PREPARATION could not be created.');
  }

  const ownerMembership = await prisma.eventMember.upsert({
    where: { eventId_userId: { eventId: event.id, userId: ownerId } },
    update: { role: EventMemberRole.OWNER, status: EventMemberStatus.ACTIVE, departmentId: department.id },
    create: {
      eventId: event.id,
      userId: ownerId,
      role: EventMemberRole.OWNER,
      status: EventMemberStatus.ACTIVE,
      departmentId: department.id,
    },
  });
  const memberMemberships = await Promise.all(memberUserIds.map((userId, index) => prisma.eventMember.upsert({
    where: { eventId_userId: { eventId: event.id, userId } },
    update: {
      role: index === 0 ? EventMemberRole.MEMBER : EventMemberRole.VOLUNTEER,
      status: EventMemberStatus.ACTIVE,
      departmentId: department.id,
    },
    create: {
      eventId: event.id,
      userId,
      role: index === 0 ? EventMemberRole.MEMBER : EventMemberRole.VOLUNTEER,
      status: EventMemberStatus.ACTIVE,
      departmentId: department.id,
    },
  })));
  const memberships = [ownerMembership, ...memberMemberships];

  for (const taskSpec of spec.tasks) {
    const taskDescription = `${taskSpec.description} ${DEMO_MARKER}`;
    const existing = await prisma.task.findFirst({
      where: { eventId: event.id, title: taskSpec.title, description: { contains: DEMO_MARKER } },
      select: { id: true },
    });
    const data = {
      workflowStageId: preparationStage.id,
      departmentId: department.id,
      title: taskSpec.title,
      description: taskDescription,
      status: taskSpec.status,
      priority: taskSpec.priority,
      origin: TaskOrigin.USER_CREATED,
      templateKey: null,
      calendarCategory: taskSpec.calendarCategory,
      dueAt: addDays(now, taskSpec.dueInDays),
      completedAt: taskSpec.status === TaskStatus.DONE ? now : null,
      archivedAt: null,
      createdById: ownerId,
      assignedById: ownerId,
    };
    const task = existing
      ? await prisma.task.update({ where: { id: existing.id }, data })
      : await prisma.task.create({ data: { ...data, eventId: event.id } });

    const assigneeIds = [...new Set(taskSpec.assigneeIndexes.map((index) => memberships[index % memberships.length]?.id).filter((id): id is string => Boolean(id)))];
    if (assigneeIds.length === 0) {
      throw new Error(`Demo task ${taskSpec.title} has no eligible assignee.`);
    }
    await prisma.taskAssignee.deleteMany({ where: { taskId: task.id } });
    await prisma.taskAssignee.createMany({ data: assigneeIds.map((eventMemberId) => ({ taskId: task.id, eventMemberId })) });
  }

  if (spec.initializeStarterWorkflow) {
    const stageIdByCode = new Map(stages.map((stage) => [stage.code, stage.id]));
    for (const templateTask of basicEventWorkflowV1) {
      const workflowStageId = stageIdByCode.get(templateTask.stageCode);
      if (!workflowStageId) throw new Error(`Missing demo workflow stage ${templateTask.stageCode}.`);
      const anchor = templateTask.dueOffset.anchor === 'START' ? event.startsAt : event.endsAt;
      const dueAt = new Date(anchor.getTime() + templateTask.dueOffset.milliseconds);
      const task = await prisma.task.upsert({
        where: { eventId_templateKey: { eventId: event.id, templateKey: templateTask.templateKey } },
        update: {
          workflowStageId,
          title: templateTask.title,
          description: templateTask.description,
          priority: templateTask.priority,
          origin: TaskOrigin.WORKFLOW_TEMPLATE,
          dueAt,
          archivedAt: null,
        },
        create: {
          eventId: event.id,
          workflowStageId,
          title: templateTask.title,
          description: templateTask.description,
          priority: templateTask.priority,
          origin: TaskOrigin.WORKFLOW_TEMPLATE,
          templateKey: templateTask.templateKey,
          dueAt,
          createdById: ownerId,
          assignedById: ownerId,
        },
      });
      await prisma.taskAssignee.upsert({
        where: { taskId_eventMemberId: { taskId: task.id, eventMemberId: ownerMembership.id } },
        update: {},
        create: { taskId: task.id, eventMemberId: ownerMembership.id },
      });
    }
    await prisma.event.update({
      where: { id: event.id },
      data: { workflowTemplateVersion: BASIC_EVENT_WORKFLOW_V1, workflowInitializedAt: event.workflowInitializedAt ?? now },
    });
  }
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('The demo seed only runs when NODE_ENV=development.');
  }

  const activeUsers = await prisma.user.findMany({
    where: { status: UserStatus.ACTIVE },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  if (activeUsers.length < 2) {
    throw new Error('Demo seed requires at least two existing ACTIVE users; no accounts were created.');
  }

  const [owner, ...otherUsers] = activeUsers;
  if (!owner) {
    throw new Error('Demo seed could not select an ACTIVE owner.');
  }
  const memberUserIds = otherUsers.slice(0, 3).map((user) => user.id);
  const now = new Date();
  for (const spec of DEMO_EVENTS) {
    await seedEvent(spec, owner.id, memberUserIds, now);
  }

  console.info(`Seeded ${DEMO_EVENTS.length} deterministic EventFlow demo events for existing ACTIVE users.`);
}

void main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown demo seed failure.';
    console.error(`Demo seed failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
