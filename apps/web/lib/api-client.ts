import type {
  AddEventMemberRequest,
  AuthUser,
  CalendarCategory,
  CalendarEventDetail,
  CalendarItem,
  CalendarItemDetail,
  CalendarItemsResponse,
  CalendarSourceType,
  CalendarTaskDetail,
  CreateEventRequest,
  CreateTaskRequest,
  CsrfResponse,
  DelegatedPermissionGrant,
  DepartmentSummary,
  EventDelegatedPermission,
  EventDetail,
  EventMemberRole,
  EventMemberEffectivePermissions,
  EventMemberStatus,
  EventMemberSummary,
  EventMembership,
  EventPermission,
  EventProgressResponse,
  EventStatus,
  LoginRequest,
  LoginResponse,
  MarkAllNotificationsReadResponse,
  MarkNotificationReadResponse,
  MyEventCard,
  MyEventsResponse,
  Notification,
  NotificationListResponse,
  NotificationPreference,
  NotificationType,
  PaginatedResponse,
  ReadinessFailureResponse,
  ReadinessResponse,
  ReplaceTaskAssigneesRequest,
  TaskAssigneeSummary,
  TaskAttachment,
  TaskCapabilities,
  TaskDetail,
  TaskListItem,
  TaskOrigin,
  TaskPriority,
  TaskStatus,
  UpdateEventMemberRequest,
  UpdateEventRequest,
  UpdateDelegatedTaskPermissionsRequest,
  UpdateNotificationPreferenceRequest,
  UpdateTaskRequest,
  UpdateTaskStatusRequest,
  UpdateTaskStatusResponse,
  EventWorkflowSummary,
  WorkflowInitializationRequest,
  WorkflowInitializationResponse,
  WorkflowStageCode,
  WorkflowStageSummary,
  WorkflowTaskFilters,
} from '@eventflow/contracts';

export type SystemStatusResult = ReadinessResponse | ReadinessFailureResponse;

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

export interface MyEventsQuery extends PaginationQuery {
  status?: 'ONGOING' | 'UPCOMING' | 'ENDED';
  search?: string;
  sort?: string;
}

export interface MembersQuery extends PaginationQuery {
  search?: string;
  role?: EventMemberRole;
  departmentId?: string;
}

export interface EventTasksQuery extends PaginationQuery {
  scope?: 'mine' | 'all';
  status?: TaskStatus;
  priority?: TaskPriority;
  workflowStageId?: string;
  departmentId?: string;
  overdue?: boolean;
  search?: string;
  sort?: string;
}

export interface MyTasksQuery extends PaginationQuery {
  eventId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  overdue?: boolean;
  dueSoon?: boolean;
  search?: string;
  sort?: string;
}

export type WorkflowStageTasksQuery = WorkflowTaskFilters;

export interface NotificationsQuery extends PaginationQuery {
  unreadOnly?: boolean;
  type?: NotificationType;
  eventId?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface CalendarItemsQuery {
  from: string;
  to: string;
  search?: string;
  categories?: CalendarCategory[];
  sourceTypes?: CalendarSourceType[];
}

export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(safeMessageForStatus(status));
    this.name = 'ApiRequestError';
  }
}

type JsonRecord = Record<string, unknown>;
type Decoder<T> = (value: unknown) => T | null;

function safeMessageForStatus(status: number): string {
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (status === 403 || status === 404) return 'Bạn không có quyền truy cập nội dung này.';
  if (status === 409) return 'Dữ liệu đã thay đổi hoặc không thể thực hiện thao tác này.';
  if (status === 422 || status === 400) return 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.';
  return 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.';
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function nullableStringValue(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === 'string' ? value : undefined;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== 'string') return null;
  for (const option of allowed) if (option === value) return option;
  return null;
}

function eventStatus(value: unknown): EventStatus | null {
  return enumValue(value, ['DRAFT', 'UPCOMING', 'ONGOING', 'ENDED', 'ARCHIVED']);
}

function eventMemberRole(value: unknown): EventMemberRole | null {
  return enumValue(value, ['OWNER', 'COORDINATOR', 'DEPARTMENT_LEAD', 'MEMBER', 'VOLUNTEER', 'GUEST']);
}

function eventMemberStatus(value: unknown): EventMemberStatus | null {
  return enumValue(value, ['ACTIVE', 'REMOVED']);
}

function taskStatus(value: unknown): TaskStatus | null {
  return enumValue(value, ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE', 'CANCELLED']);
}

function taskPriority(value: unknown): TaskPriority | null {
  return enumValue(value, ['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
}

function taskOrigin(value: unknown): TaskOrigin | null {
  return enumValue(value, ['WORKFLOW_TEMPLATE', 'USER_CREATED']);
}

function workflowStageCode(value: unknown): WorkflowStageCode | null {
  return enumValue(value, ['DESIGN', 'PREPARATION', 'EXECUTION', 'FEEDBACK']);
}

function calendarCategory(value: unknown): CalendarCategory | null {
  return enumValue(value, ['EVENT', 'TASK', 'MEETING_INTERNAL', 'VOLUNTEER', 'OTHER']);
}

function calendarSourceType(value: unknown): CalendarSourceType | null {
  return enumValue(value, ['EVENT', 'TASK']);
}

function eventPermission(value: unknown): EventPermission | null {
  return enumValue(value, [
    'event:view', 'event:update', 'event:archive', 'event:delegate-task-permissions', 'member:view', 'member:add', 'member:update-role', 'member:remove',
    'task:view:assigned', 'task:view:all', 'task:create:self', 'task:create', 'task:update:any', 'task:update:department', 'task:move-stage', 'task:assign',
    'task:update-status:assigned', 'task:update-status:any', 'task:archive', 'task:archive:own', 'workflow:initialize', 'attachment:upload:assigned',
    'attachment:upload:any', 'attachment:delete:own', 'attachment:delete:any',
  ]);
}

function notificationType(value: unknown): NotificationType | null {
  return enumValue(value, ['TASK_ASSIGNED', 'TASK_REASSIGNED', 'TASK_UNASSIGNED', 'EVENT_PERMISSION_GRANTED', 'EVENT_PERMISSION_REVOKED']);
}

function delegatedTaskPermission(value: unknown): EventDelegatedPermission | null {
  return enumValue(value, ['TASK_VIEW_ALL', 'TASK_CREATE', 'TASK_UPDATE_ANY', 'TASK_ASSIGN', 'TASK_UPDATE_STATUS_ANY', 'TASK_ARCHIVE']);
}

function decodeArray<T>(value: unknown, decoder: Decoder<T>): T[] | null {
  if (!Array.isArray(value)) return null;
  const decoded: T[] = [];
  for (const item of value) {
    const result = decoder(item);
    if (result === null) return null;
    decoded.push(result);
  }
  return decoded;
}

function decodeDepartment(value: unknown): DepartmentSummary | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const name = stringValue(value.name);
  const description = nullableStringValue(value.description);
  if (!id || !name || description === undefined) return null;
  return { id, name, description };
}

function decodeStage(value: unknown): WorkflowStageSummary | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const code = stringValue(value.code);
  const name = stringValue(value.name);
  const order = numberValue(value.order);
  if (!id || !code || !name || order === null) return null;
  return { id, code, name, order };
}

function decodeEventSummary(value: unknown): MyEventCard | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const name = stringValue(value.name);
  const description = nullableStringValue(value.description);
  const locationName = nullableStringValue(value.locationName);
  const startsAt = stringValue(value.startsAt);
  const endsAt = stringValue(value.endsAt);
  const status = eventStatus(value.status);
  const coverUrl = nullableStringValue(value.coverUrl);
  const eventRole = eventMemberRole(value.eventRole);
  const assignedTaskCount = numberValue(value.assignedTaskCount);
  const completedAssignedTaskCount = numberValue(value.completedAssignedTaskCount);
  const percentage = numberValue(value.percentage);
  const remainingTimeLabel = nullableStringValue(value.remainingTimeLabel);
  if (!id || !name || description === undefined || locationName === undefined || !startsAt || !endsAt || !status || coverUrl === undefined || !eventRole || assignedTaskCount === null || completedAssignedTaskCount === null || percentage === null || remainingTimeLabel === undefined) return null;
  return { id, name, description, locationName, startsAt, endsAt, status, coverUrl, eventRole, assignedTaskCount, completedAssignedTaskCount, percentage, remainingTimeLabel };
}

function decodeMyEvents(value: unknown): MyEventsResponse | null {
  if (!isRecord(value)) return null;
  const items = decodeArray(value.items, decodeEventSummary);
  const page = numberValue(value.page);
  const pageSize = numberValue(value.pageSize);
  const total = numberValue(value.total);
  const totalPages = numberValue(value.totalPages);
  const counts = value.statusCounts;
  if (!items || page === null || pageSize === null || total === null || totalPages === null || !isRecord(counts)) return null;
  const ongoing = numberValue(counts.ONGOING);
  const upcoming = numberValue(counts.UPCOMING);
  const ended = numberValue(counts.ENDED);
  if (ongoing === null || upcoming === null || ended === null) return null;
  return { items, page, pageSize, total, totalPages, statusCounts: { ONGOING: ongoing, UPCOMING: upcoming, ENDED: ended } };
}

function decodeMembership(value: unknown): EventMembership | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const eventId = stringValue(value.eventId);
  const role = eventMemberRole(value.role);
  const department = value.department === null ? null : decodeDepartment(value.department);
  const assignedTaskCount = numberValue(value.assignedTaskCount);
  const completedAssignedTaskCount = numberValue(value.completedAssignedTaskCount);
  const percentage = numberValue(value.percentage);
  const permissions = decodeArray(value.permissions, eventPermission);
  if (!id || !eventId || !role || (department === null && value.department !== null) || assignedTaskCount === null || completedAssignedTaskCount === null || percentage === null || !permissions) return null;
  return { id, eventId, role, department, assignedTaskCount, completedAssignedTaskCount, percentage, permissions };
}

function decodeEventDetail(value: unknown): EventDetail | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const name = stringValue(value.name);
  const description = nullableStringValue(value.description);
  const locationName = nullableStringValue(value.locationName);
  const startsAt = stringValue(value.startsAt);
  const endsAt = stringValue(value.endsAt);
  const status = eventStatus(value.status);
  const coverUrl = nullableStringValue(value.coverUrl);
  const createdAt = stringValue(value.createdAt);
  const updatedAt = stringValue(value.updatedAt);
  const departments = decodeArray(value.departments, decodeDepartment);
  const workflowStages = decodeArray(value.workflowStages, decodeStage);
  const membership = decodeMembership(value.membership);
  const progress = decodeEventProgress(value.progress);
  if (!id || !name || description === undefined || locationName === undefined || !startsAt || !endsAt || !status || coverUrl === undefined || !createdAt || !updatedAt || !departments || !workflowStages || !membership || !progress) return null;
  return { id, name, description, locationName, startsAt, endsAt, status, coverUrl, createdAt, updatedAt, departments, workflowStages, membership, progress };
}

function decodeEventMember(value: unknown): EventMemberSummary | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const userId = stringValue(value.userId);
  const displayName = nullableStringValue(value.displayName);
  const email = stringValue(value.email);
  const role = eventMemberRole(value.role);
  const status = eventMemberStatus(value.status);
  const department = value.department === null ? null : decodeDepartment(value.department);
  const joinedAt = stringValue(value.joinedAt);
  if (!id || !userId || displayName === undefined || !email || !role || !status || (department === null && value.department !== null) || !joinedAt) return null;
  return { id, userId, displayName, email, role, status, department, joinedAt };
}

function decodeAssignee(value: unknown): TaskAssigneeSummary | null {
  if (!isRecord(value)) return null;
  const eventMemberId = stringValue(value.eventMemberId);
  const userId = stringValue(value.userId);
  const displayName = nullableStringValue(value.displayName);
  const email = stringValue(value.email);
  const role = eventMemberRole(value.role);
  const department = value.department === null ? null : decodeDepartment(value.department);
  if (!eventMemberId || !userId || displayName === undefined || !email || !role || (department === null && value.department !== null)) return null;
  return { eventMemberId, userId, displayName, email, role, department };
}

function decodeCapabilities(value: unknown): TaskCapabilities | null {
  if (!isRecord(value)) return null;
  const canView = booleanValue(value.canView);
  const canUpdate = booleanValue(value.canUpdate);
  const canMoveStage = booleanValue(value.canMoveStage);
  const canAssign = booleanValue(value.canAssign);
  const canArchive = booleanValue(value.canArchive);
  const canUploadAttachment = booleanValue(value.canUploadAttachment);
  const allowedStatusTransitions = decodeArray(value.allowedStatusTransitions, taskStatus);
  if (canView === null || canUpdate === null || canMoveStage === null || canAssign === null || canArchive === null || canUploadAttachment === null || !allowedStatusTransitions) return null;
  return { canView, canUpdate, canMoveStage, canAssign, canArchive, canUploadAttachment, allowedStatusTransitions };
}

function decodeTaskListItem(value: unknown): TaskListItem | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const eventId = stringValue(value.eventId);
  const eventName = stringValue(value.eventName);
  const title = stringValue(value.title);
  const description = nullableStringValue(value.description);
  const status = taskStatus(value.status);
  const priority = taskPriority(value.priority);
  const origin = taskOrigin(value.origin);
  const templateKey = nullableStringValue(value.templateKey);
  const dueAt = stringValue(value.dueAt);
  const completedAt = nullableStringValue(value.completedAt);
  const workflowStage = decodeStage(value.workflowStage);
  const department = value.department === null ? null : decodeDepartment(value.department);
  const assignees = decodeArray(value.assignees, decodeAssignee);
  const isOverdue = booleanValue(value.isOverdue);
  const capabilities = decodeCapabilities(value.capabilities);
  if (!id || !eventId || !eventName || !title || description === undefined || !status || !priority || !origin || templateKey === undefined || !dueAt || completedAt === undefined || !workflowStage || (department === null && value.department !== null) || !assignees || isOverdue === null || !capabilities) return null;
  return { id, eventId, eventName, title, description, status, priority, origin, templateKey, dueAt, completedAt, workflowStage, department, assignees, isOverdue, capabilities };
}

function decodeWorkflow(value: unknown): EventWorkflowSummary | null {
  if (!isRecord(value) || !isRecord(value.event) || !isRecord(value.initialization) || !isRecord(value.progress)) return null;
  const id = stringValue(value.event.id);
  const name = stringValue(value.event.name);
  const description = nullableStringValue(value.event.description);
  const startsAt = stringValue(value.event.startsAt);
  const endsAt = stringValue(value.event.endsAt);
  const status = eventStatus(value.event.status);
  const initialized = booleanValue(value.initialization.initialized);
  const templateVersion = nullableStringValue(value.initialization.templateVersion);
  const initializedAt = nullableStringValue(value.initialization.initializedAt);
  const activeTaskCount = numberValue(value.progress.activeTaskCount);
  const completedTaskCount = numberValue(value.progress.completedTaskCount);
  const percentage = numberValue(value.progress.percentage);
  const overdueTaskCount = numberValue(value.progress.overdueTaskCount);
  const blockedTaskCount = numberValue(value.progress.blockedTaskCount);
  const role = eventMemberRole(value.role);
  const permissions = decodeArray(value.permissions, eventPermission);
  const stages = decodeArray(value.stages, decodeWorkflowStage);
  if (!id || !name || description === undefined || !startsAt || !endsAt || !status || initialized === null || templateVersion === undefined || initializedAt === undefined || activeTaskCount === null || completedTaskCount === null || percentage === null || overdueTaskCount === null || blockedTaskCount === null || !role || !permissions || !stages) return null;
  return {
    event: { id, name, description, startsAt, endsAt, status },
    initialization: { initialized, templateVersion, initializedAt },
    stages,
    progress: { activeTaskCount, completedTaskCount, percentage, overdueTaskCount, blockedTaskCount },
    permissions,
    role,
  };
}

function decodeWorkflowStage(value: unknown): EventWorkflowSummary['stages'][number] | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const code = workflowStageCode(value.code);
  const name = stringValue(value.name);
  const order = numberValue(value.order);
  const label = stringValue(value.label);
  const summary = stringValue(value.summary);
  const iconKey = enumValue(value.iconKey, ['sparkles', 'clipboard', 'play', 'chart']);
  const activeTaskCount = numberValue(value.activeTaskCount);
  const completedTaskCount = numberValue(value.completedTaskCount);
  const percentage = numberValue(value.percentage);
  if (id === null || !code || !name || order === null || !label || !summary || !iconKey || activeTaskCount === null || completedTaskCount === null || percentage === null) return null;
  return { id, code, name, order, label, summary, iconKey, activeTaskCount, completedTaskCount, percentage };
}

function decodeWorkflowInitialization(value: unknown): WorkflowInitializationResponse | null {
  if (!isRecord(value)) return null;
  const initialized = booleanValue(value.initialized);
  const createdTaskCount = numberValue(value.createdTaskCount);
  const existingTaskCount = numberValue(value.existingTaskCount);
  const templateVersion = enumValue(value.templateVersion, ['BASIC_EVENT_WORKFLOW_V1']);
  const workflow = decodeWorkflow(value.workflow);
  if (initialized === null || createdTaskCount === null || existingTaskCount === null || !templateVersion || !workflow) return null;
  return { initialized, createdTaskCount, existingTaskCount, templateVersion, workflow };
}

function decodeAttachment(value: unknown): TaskAttachment | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const originalFileName = stringValue(value.originalFileName);
  const mimeType = stringValue(value.mimeType);
  const sizeBytes = numberValue(value.sizeBytes);
  const createdAt = stringValue(value.createdAt);
  const downloadPath = stringValue(value.downloadPath);
  if (!id || !originalFileName || !mimeType || sizeBytes === null || !createdAt || !downloadPath || !isRecord(value.uploadedBy)) return null;
  const userId = stringValue(value.uploadedBy.userId);
  const displayName = nullableStringValue(value.uploadedBy.displayName);
  const email = stringValue(value.uploadedBy.email);
  if (!userId || displayName === undefined || !email) return null;
  return { id, originalFileName, mimeType, sizeBytes, createdAt, downloadPath, uploadedBy: { userId, displayName, email } };
}

function decodeTaskDetail(value: unknown): TaskDetail | null {
  const listItem = decodeTaskListItem(value);
  if (!listItem || !isRecord(value)) return null;
  const assignedBy = value.assignedBy;
  const createdAt = stringValue(value.createdAt);
  const updatedAt = stringValue(value.updatedAt);
  const attachments = decodeArray(value.attachments, decodeAttachment);
  if (!isRecord(assignedBy) || !createdAt || !updatedAt || !attachments) return null;
  const userId = stringValue(assignedBy.userId);
  const displayName = nullableStringValue(assignedBy.displayName);
  const email = stringValue(assignedBy.email);
  const role = eventMemberRole(assignedBy.role);
  if (!userId || displayName === undefined || !email || !role) return null;
  return { ...listItem, assignedBy: { userId, displayName, email, role }, createdAt, updatedAt, attachments };
}

function decodeProgressCount(value: unknown): EventProgressResponse['overall'] | null {
  if (!isRecord(value)) return null;
  const completed = numberValue(value.completed);
  const total = numberValue(value.total);
  const percentage = numberValue(value.percentage);
  return completed === null || total === null || percentage === null ? null : { completed, total, percentage };
}

function decodeEventProgress(value: unknown): EventProgressResponse | null {
  if (!isRecord(value)) return null;
  const eventId = stringValue(value.eventId);
  const overall = decodeProgressCount(value.overall);
  const currentUser = decodeProgressCount(value.currentUser);
  const stages = decodeArray(value.stages, (entry) => {
    if (!isRecord(entry)) return null;
    const progress = decodeProgressCount(entry);
    const workflowStageId = stringValue(entry.workflowStageId);
    const code = stringValue(entry.code);
    const name = stringValue(entry.name);
    const order = numberValue(entry.order);
    return progress && workflowStageId && code && name && order !== null
      ? { workflowStageId, code, name, order, ...progress }
      : null;
  });
  return eventId && overall && currentUser && stages ? { eventId, overall, currentUser, stages } : null;
}

function decodeUpdateTaskStatusResponse(value: unknown): UpdateTaskStatusResponse | null {
  if (!isRecord(value)) return null;
  const task = decodeTaskDetail(value.task);
  const progress = decodeEventProgress(value.progress);
  return task && progress ? { task, progress } : null;
}

function decodeCalendarItem(value: unknown): CalendarItem | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const sourceType = calendarSourceType(value.sourceType);
  const sourceId = stringValue(value.sourceId);
  const eventId = stringValue(value.eventId);
  const taskId = nullableStringValue(value.taskId);
  const category = calendarCategory(value.category);
  const title = stringValue(value.title);
  const startsAt = stringValue(value.startsAt);
  const endsAt = nullableStringValue(value.endsAt);
  const allDay = booleanValue(value.allDay);
  const locationName = nullableStringValue(value.locationName);
  const eventName = nullableStringValue(value.eventName);
  const eventCoverUrl = nullableStringValue(value.eventCoverUrl);
  const userEventRole = nullableStringValue(value.userEventRole);
  if (!id || !sourceType || !sourceId || !eventId || taskId === undefined || !category || !title || !startsAt || endsAt === undefined || allDay === null || locationName === undefined || eventName === undefined || eventCoverUrl === undefined || userEventRole === undefined) return null;
  const status = sourceType === 'EVENT' ? eventStatus(value.status) : taskStatus(value.status);
  const role = userEventRole === null ? null : eventMemberRole(userEventRole);
  if (!status || (userEventRole !== null && !role)) return null;
  if ((sourceType === 'EVENT' && taskId !== null) || (sourceType === 'TASK' && taskId === null)) return null;
  return { id, sourceType, sourceId, eventId, taskId, category, title, startsAt, endsAt, allDay, locationName, status, eventName, eventCoverUrl, userEventRole: role };
}

function decodeCalendarItems(value: unknown): CalendarItemsResponse | null {
  if (!isRecord(value)) return null;
  const items = decodeArray(value.items, decodeCalendarItem);
  const from = stringValue(value.from);
  const to = stringValue(value.to);
  return items && from && to ? { items, from, to } : null;
}

function decodeCalendarEventDetail(value: JsonRecord): CalendarEventDetail | null {
  const eventId = stringValue(value.eventId);
  const title = stringValue(value.title);
  const shortDescription = nullableStringValue(value.shortDescription);
  const description = nullableStringValue(value.description);
  const coverUrl = nullableStringValue(value.coverUrl);
  const startsAt = stringValue(value.startsAt);
  const endsAt = stringValue(value.endsAt);
  const locationName = nullableStringValue(value.locationName);
  const eventStatusValue = eventStatus(value.eventStatus);
  const userEventRole = eventMemberRole(value.userEventRole);
  const organizerName = stringValue(value.organizerName);
  const organizerSubtitle = nullableStringValue(value.organizerSubtitle);
  const relatedAssignedTaskCount = numberValue(value.relatedAssignedTaskCount);
  const relatedCompletedTaskCount = numberValue(value.relatedCompletedTaskCount);
  const permissions = decodeArray(value.permissions, eventPermission);
  if (!eventId || !title || shortDescription === undefined || description === undefined || coverUrl === undefined || !startsAt || !endsAt || locationName === undefined || !eventStatusValue || !userEventRole || !organizerName || organizerSubtitle === undefined || relatedAssignedTaskCount === null || relatedCompletedTaskCount === null || !permissions) return null;
  return { sourceType: 'EVENT', eventId, title, shortDescription, description, coverUrl, startsAt, endsAt, locationName, eventStatus: eventStatusValue, userEventRole, organizerName, organizerSubtitle, relatedAssignedTaskCount, relatedCompletedTaskCount, permissions };
}

function decodeCalendarTaskDetail(value: JsonRecord): CalendarTaskDetail | null {
  const taskId = stringValue(value.taskId);
  const eventId = stringValue(value.eventId);
  const title = stringValue(value.title);
  const description = nullableStringValue(value.description);
  const dueAt = stringValue(value.dueAt);
  const status = taskStatus(value.status);
  const priority = taskPriority(value.priority);
  const workflowStage = decodeStage(value.workflowStage);
  const department = value.department === null ? null : decodeDepartment(value.department);
  const eventName = stringValue(value.eventName);
  const eventCoverUrl = nullableStringValue(value.eventCoverUrl);
  const assignees = decodeArray(value.assignees, decodeAssignee);
  const permissions = decodeArray(value.permissions, eventPermission);
  if (!taskId || !eventId || !title || description === undefined || !dueAt || !status || !priority || !workflowStage || (department === null && value.department !== null) || !eventName || eventCoverUrl === undefined || !assignees || !permissions) return null;
  return { sourceType: 'TASK', taskId, eventId, title, description, dueAt, status, priority, workflowStage, department, eventName, eventCoverUrl, assignees, permissions };
}

function decodeCalendarItemDetail(value: unknown): CalendarItemDetail | null {
  if (!isRecord(value)) return null;
  const sourceType = calendarSourceType(value.sourceType);
  if (sourceType === 'EVENT') return decodeCalendarEventDetail(value);
  if (sourceType === 'TASK') return decodeCalendarTaskDetail(value);
  return null;
}

function decodePage<T>(decoder: Decoder<T>): Decoder<PaginatedResponse<T>> {
  return (value) => {
    if (!isRecord(value)) return null;
    const items = decodeArray(value.items, decoder);
    const page = numberValue(value.page);
    const pageSize = numberValue(value.pageSize);
    const total = numberValue(value.total);
    const totalPages = numberValue(value.totalPages);
    if (!items || page === null || pageSize === null || total === null || totalPages === null) return null;
    return { items, page, pageSize, total, totalPages };
  };
}

function decodeNotificationPayload(value: unknown): Notification['payload'] | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  const payload: Record<string, string | number | boolean | null> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'string' && typeof item !== 'number' && typeof item !== 'boolean' && item !== null) return undefined;
    payload[key] = item;
  }
  return payload;
}

function decodeNotification(value: unknown): Notification | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const type = notificationType(value.type);
  const title = stringValue(value.title);
  const body = stringValue(value.body);
  const eventId = nullableStringValue(value.eventId);
  const taskId = nullableStringValue(value.taskId);
  const actionPath = stringValue(value.actionPath);
  const payload = decodeNotificationPayload(value.payload);
  const readAt = nullableStringValue(value.readAt);
  const createdAt = stringValue(value.createdAt);
  if (!id || !type || !title || !body || eventId === undefined || taskId === undefined || !actionPath || payload === undefined || readAt === undefined || !createdAt) return null;
  return { id, type, title, body, eventId, taskId, actionPath, payload, readAt, createdAt };
}

function decodeUnreadCount(value: unknown): number | null {
  if (!isRecord(value)) return null;
  const unreadCount = numberValue(value.unreadCount);
  return unreadCount === null || unreadCount < 0 ? null : unreadCount;
}

function decodeNotificationList(value: unknown): NotificationListResponse | null {
  const page = decodePage(decodeNotification)(value);
  const unreadCount = decodeUnreadCount(value);
  if (!page || unreadCount === null) return null;
  return { ...page, unreadCount };
}

function decodeNotificationPreference(value: unknown): NotificationPreference | null {
  if (!isRecord(value)) return null;
  const inAppEnabled = booleanValue(value.inAppEnabled);
  const soundEnabled = booleanValue(value.soundEnabled);
  const desktopEnabled = booleanValue(value.desktopEnabled);
  if (inAppEnabled === null || soundEnabled === null || desktopEnabled === null) return null;
  return { inAppEnabled, soundEnabled, desktopEnabled };
}

function decodePermissionGrant(value: unknown): DelegatedPermissionGrant | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const eventId = stringValue(value.eventId);
  const granteeEventMemberId = stringValue(value.granteeEventMemberId);
  const permission = delegatedTaskPermission(value.permission);
  const grantedByEventMemberId = stringValue(value.grantedByEventMemberId);
  const grantedAt = stringValue(value.grantedAt);
  const expiresAt = nullableStringValue(value.expiresAt);
  const revokedAt = nullableStringValue(value.revokedAt);
  const revokedByEventMemberId = nullableStringValue(value.revokedByEventMemberId);
  if (!id || !eventId || !granteeEventMemberId || !permission || !grantedByEventMemberId || !grantedAt || expiresAt === undefined || revokedAt === undefined || revokedByEventMemberId === undefined) return null;
  return { id, eventId, granteeEventMemberId, permission, grantedByEventMemberId, grantedAt, expiresAt, revokedAt, revokedByEventMemberId };
}

function decodeEventPermission(value: unknown): EventPermission | null {
  return eventPermission(value);
}

function decodeEffectivePermissions(value: unknown): EventMemberEffectivePermissions | null {
  if (!isRecord(value)) return null;
  const eventId = stringValue(value.eventId);
  const eventMemberId = stringValue(value.eventMemberId);
  const baseRolePermissions = decodeArray(value.baseRolePermissions, decodeEventPermission);
  const delegatedPermissions = decodeArray(value.delegatedPermissions, delegatedTaskPermission);
  const effectivePermissions = decodeArray(value.effectivePermissions, decodeEventPermission);
  const grants = decodeArray(value.grants, decodePermissionGrant);
  if (!eventId || !eventMemberId || !baseRolePermissions || !delegatedPermissions || !effectivePermissions || !grants) return null;
  return { eventId, eventMemberId, baseRolePermissions, delegatedPermissions, effectivePermissions, grants };
}

function decodeMarkNotificationRead(value: unknown): MarkNotificationReadResponse | null {
  if (!isRecord(value)) return null;
  const notification = decodeNotification(value.notification);
  const unreadCount = decodeUnreadCount(value);
  return notification && unreadCount !== null ? { notification, unreadCount } : null;
}

function decodeMarkAllNotificationsRead(value: unknown): MarkAllNotificationsReadResponse | null {
  if (!isRecord(value)) return null;
  const readAt = stringValue(value.readAt);
  const unreadCount = decodeUnreadCount(value);
  return readAt && unreadCount !== null ? { readAt, unreadCount } : null;
}

function decodeAuthUser(value: unknown): AuthUser | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const email = stringValue(value.email);
  const displayName = nullableStringValue(value.displayName);
  const systemRole = enumValue(value.systemRole, ['USER', 'SYSTEM_ADMIN']);
  const status = enumValue(value.status, ['INVITED', 'ACTIVE', 'SUSPENDED']);
  const mustChangePassword = booleanValue(value.mustChangePassword);
  if (!id || !email || displayName === undefined || !systemRole || !status || mustChangePassword === null || !Array.isArray(value.permissions)) return null;
  const permissions: AuthUser['permissions'] = [];
  for (const permission of value.permissions) if (permission === 'admin:access') permissions.push(permission);
  return { id, email, displayName, systemRole, status, mustChangePassword, permissions };
}

function decodeLogin(value: unknown): LoginResponse | null {
  if (!isRecord(value)) return null;
  const user = decodeAuthUser(value.user);
  return user ? { user } : null;
}

function decodeCsrf(value: unknown): CsrfResponse | null {
  if (!isRecord(value)) return null;
  const token = stringValue(value.token);
  return token ? { token } : null;
}

function decodeSystemStatus(value: unknown): SystemStatusResult | null {
  if (!isRecord(value) || !isRecord(value.dependencies)) return null;
  const status = value.status;
  const service = stringValue(value.service);
  const timestamp = stringValue(value.timestamp);
  const postgres = enumValue(value.dependencies.postgres, ['up', 'down']);
  const redis = enumValue(value.dependencies.redis, ['up', 'down']);
  const objectStorage = enumValue(value.dependencies.objectStorage, ['up', 'down']);
  if ((status !== 'ok' && status !== 'error') || service !== 'eventflow-api' || !timestamp || !postgres || !redis || !objectStorage) return null;
  return { status, service, timestamp, dependencies: { postgres, redis, objectStorage } };
}

function queryString(query: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string' && value !== '') params.set(key, value);
    if (typeof value === 'number' || typeof value === 'boolean') params.set(key, String(value));
    if (Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === 'string')) params.set(key, value.join(','));
  }
  const result = params.toString();
  return result ? `?${result}` : '';
}

function errorCode(value: unknown): string {
  if (!isRecord(value)) return 'API_REQUEST_FAILED';
  if (isRecord(value.error)) {
    const code = stringValue(value.error.code);
    if (code) return code;
  }
  const code = stringValue(value.code);
  return code ?? 'API_REQUEST_FAILED';
}

async function responsePayload(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${apiBaseUrl}/api/v1${path}`, {
    // API JSON is session- and permission-scoped. A browser 304 has no body,
    // which also breaks the strict response decoders below, so never reuse a
    // cached representation across role/grant changes.
    cache: 'no-store',
    ...init,
    credentials: 'include',
    headers: { accept: 'application/json', ...init.headers },
  });
}

async function request<T>(path: string, decoder: Decoder<T>, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, init);
  const payload = await responsePayload(response);
  if (!response.ok) throw new ApiRequestError(response.status, errorCode(payload));
  const decoded = decoder(payload);
  if (decoded === null) throw new ApiRequestError(502, 'API_RESPONSE_INVALID');
  return decoded;
}

async function mutation<T>(path: string, decoder: Decoder<T>, init: RequestInit): Promise<T> {
  const csrfToken = await getCsrfToken();
  return request(path, decoder, { ...init, headers: { ...init.headers, 'x-csrf-token': csrfToken } });
}

async function emptyMutation(path: string, init: RequestInit): Promise<void> {
  const csrfToken = await getCsrfToken();
  const response = await apiFetch(path, { ...init, headers: { ...init.headers, 'x-csrf-token': csrfToken } });
  const payload = await responsePayload(response);
  if (!response.ok) throw new ApiRequestError(response.status, errorCode(payload));
}

export async function getCsrfToken(): Promise<string> {
  const response = await apiFetch('/auth/csrf');
  const payload = await responsePayload(response);
  if (!response.ok) throw new ApiRequestError(response.status, errorCode(payload));
  const decoded = decodeCsrf(payload);
  if (!decoded) throw new ApiRequestError(502, 'API_RESPONSE_INVALID');
  return decoded.token;
}

export function login(requestBody: LoginRequest, csrfToken: string): Promise<LoginResponse> {
  return request('/auth/login', decodeLogin, { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify(requestBody) });
}

export function getCurrentUser(): Promise<AuthUser> {
  return request('/auth/me', decodeAuthUser);
}

export function logout(): Promise<void> {
  return emptyMutation('/auth/logout', { method: 'POST' });
}

export async function getSystemStatus(): Promise<SystemStatusResult> {
  const response = await fetch('/api/system-status', { cache: 'no-store' });
  const payload = await responsePayload(response);
  const decoded = decodeSystemStatus(payload);
  if (!decoded) throw new ApiRequestError(response.status, 'API_RESPONSE_INVALID');
  return decoded;
}

export function getMyEvents(query: MyEventsQuery = {}): Promise<MyEventsResponse> {
  return request(`/me/events${queryString(query)}`, decodeMyEvents);
}

export function getCalendarItems(query: CalendarItemsQuery): Promise<CalendarItemsResponse> {
  return request(`/calendar/items${queryString(query)}`, decodeCalendarItems);
}

export function getCalendarItemDetail(sourceType: CalendarSourceType, sourceId: string): Promise<CalendarItemDetail> {
  return request(`/calendar/items/${encodeURIComponent(sourceType)}/${encodeURIComponent(sourceId)}`, decodeCalendarItemDetail);
}

export function createEvent(requestBody: CreateEventRequest): Promise<EventDetail> {
  return mutation('/events', decodeEventDetail, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(requestBody) });
}

export function getEvent(eventId: string): Promise<EventDetail> {
  return request(`/events/${encodeURIComponent(eventId)}`, decodeEventDetail);
}

export function getEventProgress(eventId: string): Promise<EventProgressResponse> {
  return request(`/events/${encodeURIComponent(eventId)}/progress`, decodeEventProgress);
}

export function getEventWorkflow(eventId: string): Promise<EventWorkflowSummary> {
  return request(`/events/${encodeURIComponent(eventId)}/workflow`, decodeWorkflow);
}

export function initializeEventWorkflow(
  eventId: string,
  requestBody: WorkflowInitializationRequest,
): Promise<WorkflowInitializationResponse> {
  return mutation(
    `/events/${encodeURIComponent(eventId)}/workflow/initialize`,
    decodeWorkflowInitialization,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(requestBody) },
  );
}

export function getWorkflowStageTasks(
  eventId: string,
  stageId: string,
  query: WorkflowStageTasksQuery = {},
): Promise<PaginatedResponse<TaskListItem>> {
  return request(
    `/events/${encodeURIComponent(eventId)}/workflow/stages/${encodeURIComponent(stageId)}/tasks${queryString(query)}`,
    decodePage(decodeTaskListItem),
  );
}

export function updateEvent(eventId: string, requestBody: UpdateEventRequest): Promise<EventDetail> {
  return mutation(`/events/${encodeURIComponent(eventId)}`, decodeEventDetail, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(requestBody) });
}

export function archiveEvent(eventId: string): Promise<EventDetail> {
  return mutation(`/events/${encodeURIComponent(eventId)}/archive`, decodeEventDetail, { method: 'POST' });
}

export function getEventMembership(eventId: string): Promise<EventMembership> {
  return request(`/events/${encodeURIComponent(eventId)}/membership/me`, decodeMembership);
}

export function getMyEventPermissions(eventId: string): Promise<EventMemberEffectivePermissions> {
  return request(`/events/${encodeURIComponent(eventId)}/membership/me/permissions`, decodeEffectivePermissions);
}

export function getEventMemberPermissions(eventId: string, memberId: string): Promise<EventMemberEffectivePermissions> {
  return request(`/events/${encodeURIComponent(eventId)}/members/${encodeURIComponent(memberId)}/permissions`, decodeEffectivePermissions);
}

export function updateEventMemberDelegatedTaskPermissions(
  eventId: string,
  memberId: string,
  requestBody: UpdateDelegatedTaskPermissionsRequest,
): Promise<EventMemberEffectivePermissions> {
  return mutation(
    `/events/${encodeURIComponent(eventId)}/members/${encodeURIComponent(memberId)}/permissions`,
    decodeEffectivePermissions,
    { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(requestBody) },
  );
}

export function getNotifications(query: NotificationsQuery = {}): Promise<NotificationListResponse> {
  return request(`/notifications${queryString(query)}`, decodeNotificationList);
}

export function getUnreadNotificationCount(): Promise<number> {
  return request('/notifications/unread-count', decodeUnreadCount);
}

export function markNotificationRead(notificationId: string): Promise<MarkNotificationReadResponse> {
  return mutation(`/notifications/${encodeURIComponent(notificationId)}/read`, decodeMarkNotificationRead, { method: 'PATCH' });
}

export function markAllNotificationsRead(): Promise<MarkAllNotificationsReadResponse> {
  return mutation('/notifications/read-all', decodeMarkAllNotificationsRead, { method: 'POST' });
}

export function getNotificationPreferences(): Promise<NotificationPreference> {
  return request('/notifications/preferences', decodeNotificationPreference);
}

export function updateNotificationPreferences(requestBody: UpdateNotificationPreferenceRequest): Promise<NotificationPreference> {
  return mutation('/notifications/preferences', decodeNotificationPreference, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(requestBody) });
}

export function getEventMembers(eventId: string, query: MembersQuery = {}): Promise<PaginatedResponse<EventMemberSummary>> {
  return request(`/events/${encodeURIComponent(eventId)}/members${queryString(query)}`, decodePage(decodeEventMember));
}

export function addEventMember(eventId: string, requestBody: AddEventMemberRequest): Promise<EventMemberSummary> {
  return mutation(`/events/${encodeURIComponent(eventId)}/members`, decodeEventMember, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(requestBody) });
}

export function updateEventMember(eventId: string, memberId: string, requestBody: UpdateEventMemberRequest): Promise<EventMemberSummary> {
  return mutation(`/events/${encodeURIComponent(eventId)}/members/${encodeURIComponent(memberId)}`, decodeEventMember, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(requestBody) });
}

export function removeEventMember(eventId: string, memberId: string): Promise<void> {
  return emptyMutation(`/events/${encodeURIComponent(eventId)}/members/${encodeURIComponent(memberId)}`, { method: 'DELETE' });
}

export function getEventTasks(eventId: string, query: EventTasksQuery = {}): Promise<PaginatedResponse<TaskListItem>> {
  return request(`/events/${encodeURIComponent(eventId)}/tasks${queryString(query)}`, decodePage(decodeTaskListItem));
}

export function getMyTasks(query: MyTasksQuery = {}): Promise<PaginatedResponse<TaskListItem>> {
  return request(`/me/tasks${queryString(query)}`, decodePage(decodeTaskListItem));
}

export function createTask(eventId: string, requestBody: CreateTaskRequest): Promise<TaskDetail> {
  return mutation(`/events/${encodeURIComponent(eventId)}/tasks`, decodeTaskDetail, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(requestBody) });
}

export function getTask(taskId: string): Promise<TaskDetail> {
  return request(`/tasks/${encodeURIComponent(taskId)}`, decodeTaskDetail);
}

export function updateTask(taskId: string, requestBody: UpdateTaskRequest): Promise<TaskDetail> {
  return mutation(`/tasks/${encodeURIComponent(taskId)}`, decodeTaskDetail, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(requestBody) });
}

export function updateTaskStatus(taskId: string, requestBody: UpdateTaskStatusRequest): Promise<UpdateTaskStatusResponse> {
  return mutation(`/tasks/${encodeURIComponent(taskId)}/status`, decodeUpdateTaskStatusResponse, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(requestBody) });
}

export function replaceTaskAssignees(taskId: string, requestBody: ReplaceTaskAssigneesRequest): Promise<TaskDetail> {
  return mutation(`/tasks/${encodeURIComponent(taskId)}/assignees`, decodeTaskDetail, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(requestBody) });
}

export function archiveTask(taskId: string): Promise<void> {
  return emptyMutation(`/tasks/${encodeURIComponent(taskId)}/archive`, { method: 'POST' });
}

export function uploadTaskAttachment(taskId: string, file: File): Promise<TaskAttachment> {
  const formData = new FormData();
  formData.append('file', file);
  return mutation(`/tasks/${encodeURIComponent(taskId)}/attachments`, decodeAttachment, { method: 'POST', body: formData });
}

export function deleteTaskAttachment(taskId: string, attachmentId: string): Promise<void> {
  return emptyMutation(`/tasks/${encodeURIComponent(taskId)}/attachments/${encodeURIComponent(attachmentId)}`, { method: 'DELETE' });
}

export function attachmentDownloadHref(taskId: string, attachment: TaskAttachment): string {
  const expectedPath = `/api/v1/tasks/${encodeURIComponent(taskId)}/attachments/${encodeURIComponent(attachment.id)}/download`;
  const path = attachment.downloadPath.startsWith('/api/v1/') ? attachment.downloadPath : expectedPath;
  return `${apiBaseUrl}${path}`;
}
