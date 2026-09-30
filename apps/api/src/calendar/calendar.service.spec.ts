import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CalendarCategory, EventMemberRole, EventStatus, TaskPriority, TaskStatus } from '@prisma/client';
import { DomainException } from '../common/domain.exception';
import { EventAccessService } from '../events/event-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarService } from './calendar.service';

describe('CalendarService', () => {
  let service: CalendarService;
  const prisma = {
    event: { findMany: jest.fn(), findFirst: jest.fn() },
    task: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
    eventMember: { findMany: jest.fn() },
  };
  const access = {
    requireMembership: jest.fn(),
    requireTaskView: jest.fn(),
    effectivePermissionsFor: jest.fn(),
    canListAllTasks: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.event.findMany.mockResolvedValue([]);
    prisma.task.findMany.mockResolvedValue([]);
    prisma.eventMember.findMany.mockResolvedValue([{ id: 'member-1', eventId: 'event-1', userId: 'user-1', role: EventMemberRole.MEMBER, departmentId: null }]);
    access.effectivePermissionsFor.mockResolvedValue({ baseRolePermissions: [], delegatedPermissions: [], effectivePermissions: [] });
    access.canListAllTasks.mockReturnValue(null);
    const module = await Test.createTestingModule({
      providers: [
        CalendarService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventAccessService, useValue: access },
      ],
    }).compile();
    service = module.get(CalendarService);
  });

  it('uses membership/assignee constrained overlap and due-date range queries', async () => {
    const eventDate = new Date('2026-10-05T09:00:00.000Z');
    const taskDate = new Date('2026-10-06T10:00:00.000Z');
    prisma.event.findMany.mockResolvedValue([{
      id: 'event-1', name: 'Hội thảo cộng đồng', startsAt: eventDate, endsAt: new Date('2026-10-05T12:00:00.000Z'), status: EventStatus.UPCOMING,
      calendarCategory: CalendarCategory.EVENT, locationName: 'Hà Nội', members: [{ role: EventMemberRole.MEMBER }],
    }]);
    prisma.task.findMany.mockResolvedValue([{
      id: 'task-1', eventId: 'event-1', title: 'Chuẩn bị sân khấu', dueAt: taskDate, status: TaskStatus.NOT_STARTED,
      calendarCategory: CalendarCategory.TASK, event: { name: 'Hội thảo cộng đồng' },
    }]);

    const result = await service.listItems('user-1', { from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z', search: 'hội' });

    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'event:event-1', sourceType: 'EVENT', userEventRole: EventMemberRole.MEMBER }),
      expect.objectContaining({ id: 'task:task-1', sourceType: 'TASK', eventName: 'Hội thảo cộng đồng' }),
    ]));
    const eventWhere = prisma.event.findMany.mock.calls[0]?.[0].where;
    const taskWhere = prisma.task.findMany.mock.calls[0]?.[0].where;
    expect(eventWhere.members.some).toMatchObject({ userId: 'user-1', status: 'ACTIVE' });
    expect(eventWhere.startsAt).toEqual({ lt: new Date('2026-11-01T00:00:00.000Z') });
    expect(eventWhere.endsAt).toEqual({ gt: new Date('2026-10-01T00:00:00.000Z') });
    expect(taskWhere.AND[0].OR).toEqual(expect.arrayContaining([expect.objectContaining({ assignees: { some: { eventMemberId: 'member-1' } } })]));
    expect(taskWhere.AND[1].OR).toEqual(expect.arrayContaining([expect.objectContaining({ title: { contains: 'hội', mode: 'insensitive' } })]));
    expect(taskWhere.dueAt).toEqual({ gte: new Date('2026-10-01T00:00:00.000Z'), lt: new Date('2026-11-01T00:00:00.000Z') });
  });

  it('includes global, department, and task-creator scopes granted by the shared access policy', async () => {
    prisma.eventMember.findMany.mockResolvedValue([
      { id: 'owner-member', eventId: 'event-global', userId: 'user-1', role: EventMemberRole.OWNER, departmentId: null },
      { id: 'lead-member', eventId: 'event-department', userId: 'user-1', role: EventMemberRole.DEPARTMENT_LEAD, departmentId: 'department-1' },
      { id: 'creator-member', eventId: 'event-created', userId: 'user-1', role: EventMemberRole.MEMBER, departmentId: null },
    ]);
    access.effectivePermissionsFor
      .mockResolvedValueOnce({ baseRolePermissions: [], delegatedPermissions: [], effectivePermissions: [] })
      .mockResolvedValueOnce({ baseRolePermissions: [], delegatedPermissions: [], effectivePermissions: [] })
      .mockResolvedValueOnce({ baseRolePermissions: [], delegatedPermissions: [], effectivePermissions: ['task:create'] });
    access.canListAllTasks
      .mockReturnValueOnce('global')
      .mockReturnValueOnce('department')
      .mockReturnValueOnce(null);

    await service.listItems('user-1', { from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z', sourceTypes: ['TASK'] });

    const taskWhere = prisma.task.findMany.mock.calls[0]?.[0].where;
    expect(taskWhere.AND[0].OR).toEqual(expect.arrayContaining([
      { eventId: 'event-global' },
      { eventId: 'event-department', departmentId: 'department-1' },
      { eventId: 'event-created', createdById: 'user-1' },
    ]));
  });

  it('rejects empty, inverted, and excessive ranges before querying data', async () => {
    await expect(service.listItems('user-1', { from: '2026-10-01T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z' })).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST, response: expect.objectContaining({ error: expect.objectContaining({ code: 'CALENDAR_RANGE_INVALID' }) }) });
    await expect(service.listItems('user-1', { from: '2026-01-01T00:00:00.000Z', to: '2026-05-01T00:00:00.000Z' })).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST, response: expect.objectContaining({ error: expect.objectContaining({ code: 'CALENDAR_RANGE_EXCESSIVE' }) }) });
    expect(prisma.event.findMany).not.toHaveBeenCalled();
  });

  it('keeps inaccessible task details behind the shared task-view policy', async () => {
    prisma.task.findFirst.mockResolvedValue({
      id: 'task-1', eventId: 'event-1', title: 'Riêng tư', description: null, dueAt: new Date('2026-10-06T10:00:00.000Z'), status: TaskStatus.NOT_STARTED,
      priority: TaskPriority.MEDIUM, createdById: 'owner-1', departmentId: null, workflowStage: { id: 'stage-1', code: 'PREP', name: 'Chuẩn bị', order: 1 },
      department: null, event: { name: 'Sự kiện riêng tư' }, assignees: [],
    });
    access.requireTaskView.mockRejectedValue(new DomainException(HttpStatus.FORBIDDEN, 'TASK_ACCESS_DENIED', 'Bạn không có quyền xem công việc này.'));

    await expect(service.getItemDetail('user-2', 'TASK', '00000000-0000-4000-8000-000000000001')).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
    expect(access.requireTaskView).toHaveBeenCalledWith(expect.objectContaining({ id: 'task-1' }), 'user-2');
  });
});
