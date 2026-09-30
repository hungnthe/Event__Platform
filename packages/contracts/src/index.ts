export type DependencyState = 'up' | 'down';

export interface HealthDependencies {
  postgres: DependencyState;
  redis: DependencyState;
  objectStorage: DependencyState;
}

export interface ReadinessResponse {
  status: 'ok';
  service: 'eventflow-api';
  timestamp: string;
  dependencies: HealthDependencies;
}

export interface ReadinessFailureResponse {
  status: 'error';
  service: 'eventflow-api';
  timestamp: string;
  dependencies: HealthDependencies;
}

export type SystemRole = 'USER' | 'SYSTEM_ADMIN';
export type UserStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED';
export type Permission = 'admin:access';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  systemRole: SystemRole;
  status: UserStatus;
  mustChangePassword: boolean;
  permissions: Permission[];
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface LoginResponse {
  user: AuthUser;
}

export interface CsrfResponse {
  token: string;
}

export type EventStatus = 'DRAFT' | 'UPCOMING' | 'ONGOING' | 'ENDED' | 'ARCHIVED';
export type EventMemberRole = 'OWNER' | 'COORDINATOR' | 'DEPARTMENT_LEAD' | 'MEMBER' | 'VOLUNTEER' | 'GUEST';
export type EventMemberStatus = 'ACTIVE' | 'REMOVED';
export type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'IN_REVIEW' | 'DONE' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskOrigin = 'WORKFLOW_TEMPLATE' | 'USER_CREATED';
export type TaskCreationMode = 'PERSONAL' | 'TEAM';
export type WorkflowStageCode = 'DESIGN' | 'PREPARATION' | 'EXECUTION' | 'FEEDBACK';

export type EventPermission =
  | 'event:view'
  | 'event:update'
  | 'event:archive'
  | 'event:delegate-task-permissions'
  | 'member:view'
  | 'member:add'
  | 'member:update-role'
  | 'member:remove'
  | 'task:view:assigned'
  | 'task:view:all'
  | 'task:create:self'
  | 'task:create'
  | 'task:update:any'
  | 'task:update:department'
  | 'task:move-stage'
  | 'task:assign'
  | 'task:update-status:assigned'
  | 'task:update-status:any'
  | 'task:archive'
  | 'task:archive:own'
  | 'workflow:initialize'
  | 'attachment:upload:assigned'
  | 'attachment:upload:any'
  | 'attachment:delete:own'
  | 'attachment:delete:any';

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PersonalTaskProgress {
  assignedTaskCount: number;
  completedAssignedTaskCount: number;
  percentage: number;
}

export interface EventSummary {
  id: string;
  name: string;
  description: string | null;
  locationName: string | null;
  startsAt: string;
  endsAt: string;
  status: EventStatus;
  coverUrl: string | null;
}

export interface MyEventCard extends EventSummary, PersonalTaskProgress {
  eventRole: EventMemberRole;
  remainingTimeLabel: string | null;
}

export interface MyEventsResponse extends PaginatedResponse<MyEventCard> {
  statusCounts: Record<'ONGOING' | 'UPCOMING' | 'ENDED', number>;
}

export interface DepartmentSummary {
  id: string;
  name: string;
  description: string | null;
}

export interface WorkflowStageSummary {
  id: string;
  code: string;
  name: string;
  order: number;
}

export interface WorkflowStageProgress extends WorkflowStageSummary {
  code: WorkflowStageCode;
  label: string;
  summary: string;
  iconKey: 'sparkles' | 'clipboard' | 'play' | 'chart';
  activeTaskCount: number;
  completedTaskCount: number;
  percentage: number;
}

export interface WorkflowProgressSummary {
  activeTaskCount: number;
  completedTaskCount: number;
  percentage: number;
  overdueTaskCount: number;
  blockedTaskCount: number;
}

export interface WorkflowInitializationState {
  initialized: boolean;
  templateVersion: string | null;
  initializedAt: string | null;
}

export interface EventWorkflowSummary {
  event: Pick<EventSummary, 'id' | 'name' | 'description' | 'startsAt' | 'endsAt' | 'status'>;
  initialization: WorkflowInitializationState;
  stages: WorkflowStageProgress[];
  progress: WorkflowProgressSummary;
  permissions: EventPermission[];
  role: EventMemberRole;
}

export type WorkflowAssignmentStrategy = 'CURRENT_USER' | 'DEPARTMENT_LEADS';

export interface WorkflowInitializationRequest {
  templateVersion: 'BASIC_EVENT_WORKFLOW_V1';
  assignmentStrategy: WorkflowAssignmentStrategy;
}

export interface WorkflowInitializationResponse {
  initialized: boolean;
  createdTaskCount: number;
  existingTaskCount: number;
  templateVersion: 'BASIC_EVENT_WORKFLOW_V1';
  workflow: EventWorkflowSummary;
}

export interface EventMemberSummary {
  id: string;
  userId: string;
  displayName: string | null;
  email: string;
  role: EventMemberRole;
  status: EventMemberStatus;
  department: DepartmentSummary | null;
  joinedAt: string;
}

export interface EventMembership extends PersonalTaskProgress {
  id: string;
  eventId: string;
  role: EventMemberRole;
  department: DepartmentSummary | null;
  permissions: EventPermission[];
}

export interface EventDetail extends EventSummary {
  createdAt: string;
  updatedAt: string;
  departments: DepartmentSummary[];
  workflowStages: WorkflowStageSummary[];
  membership: EventMembership;
  progress: EventProgressResponse;
}

export type EventOverview = EventDetail;

export interface ProgressCount {
  completed: number;
  total: number;
  percentage: number;
}

export interface StageProgress extends ProgressCount {
  workflowStageId: string;
  code: string;
  name: string;
  order: number;
}

export interface EventProgressResponse {
  eventId: string;
  overall: ProgressCount;
  stages: StageProgress[];
  currentUser: ProgressCount;
}

export interface TaskAssigneeSummary {
  eventMemberId: string;
  userId: string;
  displayName: string | null;
  email: string;
  role: EventMemberRole;
  department: DepartmentSummary | null;
}

export interface TaskAttachment {
  id: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: Pick<TaskAssigneeSummary, 'userId' | 'displayName' | 'email'>;
  createdAt: string;
  downloadPath: string;
}

export interface TaskCapabilities {
  canView: boolean;
  canUpdate: boolean;
  canMoveStage: boolean;
  canAssign: boolean;
  canArchive: boolean;
  canUploadAttachment: boolean;
  allowedStatusTransitions: TaskStatus[];
}

export interface TaskListItem {
  id: string;
  eventId: string;
  eventName: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  origin: TaskOrigin;
  templateKey: string | null;
  dueAt: string;
  completedAt: string | null;
  workflowStage: WorkflowStageSummary;
  department: DepartmentSummary | null;
  assignees: TaskAssigneeSummary[];
  isOverdue: boolean;
  capabilities: TaskCapabilities;
}

export interface TaskDetail extends TaskListItem {
  assignedBy: Pick<TaskAssigneeSummary, 'userId' | 'displayName' | 'email' | 'role'>;
  createdAt: string;
  updatedAt: string;
  attachments: TaskAttachment[];
}

/** Read-only calendar sources; Event and Task remain the database source of truth. */
export type CalendarSourceType = 'EVENT' | 'TASK';

/** Semantic presentation categories mapped to UI tokens by the web client. */
export type CalendarCategory = 'EVENT' | 'TASK' | 'MEETING_INTERNAL' | 'VOLUNTEER' | 'OTHER';

export interface CalendarItem {
  /** Stable client-only identity such as event:{uuid} or task:{uuid}. */
  id: string;
  sourceType: CalendarSourceType;
  sourceId: string;
  eventId: string;
  taskId: string | null;
  category: CalendarCategory;
  title: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  locationName: string | null;
  status: EventStatus | TaskStatus;
  eventName: string | null;
  /** This is intentionally a protected/public-safe URL, never an object key. */
  eventCoverUrl: string | null;
  userEventRole: EventMemberRole | null;
}

export interface CalendarItemsResponse {
  items: CalendarItem[];
  from: string;
  to: string;
}

export interface CalendarEventDetail {
  sourceType: 'EVENT';
  eventId: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  coverUrl: string | null;
  startsAt: string;
  endsAt: string;
  locationName: string | null;
  eventStatus: EventStatus;
  userEventRole: EventMemberRole;
  organizerName: string;
  organizerSubtitle: string | null;
  relatedAssignedTaskCount: number;
  relatedCompletedTaskCount: number;
  permissions: EventPermission[];
}

export interface CalendarTaskDetail {
  sourceType: 'TASK';
  taskId: string;
  eventId: string;
  title: string;
  description: string | null;
  dueAt: string;
  status: TaskStatus;
  priority: TaskPriority;
  workflowStage: WorkflowStageSummary;
  department: DepartmentSummary | null;
  eventName: string;
  eventCoverUrl: string | null;
  assignees: TaskAssigneeSummary[];
  permissions: EventPermission[];
}

export type CalendarItemDetail = CalendarEventDetail | CalendarTaskDetail;

export interface CreateEventRequest {
  name: string;
  description?: string;
  locationName?: string;
  startsAt: string;
  endsAt: string;
  status?: EventStatus;
  calendarCategory?: Extract<CalendarCategory, 'EVENT' | 'VOLUNTEER' | 'OTHER'>;
}

export interface UpdateEventRequest {
  name?: string;
  description?: string | null;
  locationName?: string | null;
  startsAt?: string;
  endsAt?: string;
  status?: EventStatus;
  calendarCategory?: Extract<CalendarCategory, 'EVENT' | 'VOLUNTEER' | 'OTHER'>;
}

export interface AddEventMemberRequest {
  userId?: string;
  email?: string;
  role: EventMemberRole;
  departmentId?: string | null;
}

export interface UpdateEventMemberRequest {
  role?: EventMemberRole;
  departmentId?: string | null;
}

export interface CreateTaskRequest {
  title: string;
  description?: string | null;
  workflowStageId: string;
  departmentId?: string | null;
  assigneeEventMemberIds?: string[];
  creationMode?: TaskCreationMode;
  priority?: TaskPriority;
  dueAt: string;
  calendarCategory?: Extract<CalendarCategory, 'TASK' | 'MEETING_INTERNAL' | 'VOLUNTEER' | 'OTHER'>;
}

export interface WorkflowTaskFilters {
  search?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  origin?: TaskOrigin;
  assigneeEventMemberId?: string;
  mineOnly?: boolean;
  page?: number;
  pageSize?: number;
  sort?: 'dueAt:asc' | 'dueAt:desc' | 'createdAt:desc' | 'priority:desc';
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string | null;
  workflowStageId?: string;
  departmentId?: string | null;
  priority?: TaskPriority;
  dueAt?: string;
  calendarCategory?: Extract<CalendarCategory, 'TASK' | 'MEETING_INTERNAL' | 'VOLUNTEER' | 'OTHER'>;
}

export interface UpdateTaskStatusRequest {
  status: TaskStatus;
}

export interface UpdateTaskStatusResponse {
  task: TaskDetail;
  progress: EventProgressResponse;
}

export interface ReplaceTaskAssigneesRequest {
  eventMemberIds: string[];
}

/**
 * Explicit, event-scoped task-management permissions. These are deliberately
 * separate from platform SystemRole and from the application's normalized
 * EventPermission values.
 */
export type EventDelegatedPermission =
  | 'TASK_VIEW_ALL'
  | 'TASK_CREATE'
  | 'TASK_UPDATE_ANY'
  | 'TASK_ASSIGN'
  | 'TASK_UPDATE_STATUS_ANY'
  | 'TASK_ARCHIVE';

export interface DelegatedPermissionGrant {
  id: string;
  eventId: string;
  granteeEventMemberId: string;
  permission: EventDelegatedPermission;
  grantedByEventMemberId: string;
  grantedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedByEventMemberId: string | null;
}

/**
 * Role-derived values use the existing normalized EventPermission strings.
 * Explicit delegated values retain their domain enum so the UI can show their
 * provenance separately from role inheritance.
 */
export interface EventMemberEffectivePermissions {
  eventId: string;
  eventMemberId: string;
  baseRolePermissions: EventPermission[];
  delegatedPermissions: EventDelegatedPermission[];
  effectivePermissions: EventPermission[];
  grants: DelegatedPermissionGrant[];
}

export interface UpdateDelegatedTaskPermissionsRequest {
  permissions: EventDelegatedPermission[];
  expiresAt: string | null;
}

export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_REASSIGNED'
  | 'TASK_UNASSIGNED'
  | 'EVENT_PERMISSION_GRANTED'
  | 'EVENT_PERMISSION_REVOKED';

/** Public, recipient-safe notification projection. */
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  eventId: string | null;
  taskId: string | null;
  actionPath: string;
  payload: Record<string, string | number | boolean | null> | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResponse extends PaginatedResponse<Notification> {
  unreadCount: number;
}

export interface NotificationListQuery {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
  type?: NotificationType;
  eventId?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface UnreadNotificationCountResponse {
  unreadCount: number;
}

export interface NotificationPreference {
  inAppEnabled: boolean;
  soundEnabled: boolean;
  desktopEnabled: boolean;
}

export interface UpdateNotificationPreferenceRequest {
  soundEnabled?: boolean;
  desktopEnabled?: boolean;
}

export interface MarkNotificationReadResponse {
  notification: Notification;
  unreadCount: number;
}

export interface MarkAllNotificationsReadResponse {
  readAt: string;
  unreadCount: number;
}

export const NOTIFICATION_SOCKET_EVENTS = {
  READY: 'notifications.ready',
  CREATED: 'notification.created',
  READ: 'notification.read',
  READ_ALL: 'notifications.read-all',
  UNREAD_COUNT: 'notifications.unread-count',
  SESSION_REVOKED: 'session.revoked',
  EVENT_PROGRESS_UPDATED: 'event.progress.updated',
} as const;

export type NotificationSocketEvent =
  (typeof NOTIFICATION_SOCKET_EVENTS)[keyof typeof NOTIFICATION_SOCKET_EVENTS];

export interface NotificationsReadySocketPayload {
  version: 1;
  connectedAt: string;
  userId: string;
}

export interface NotificationCreatedSocketPayload {
  version: 1;
  notification: Notification;
  unreadCount: number;
}

export interface NotificationReadSocketPayload {
  version: 1;
  notificationId: string;
  readAt: string;
  unreadCount: number;
}

export interface NotificationsReadAllSocketPayload {
  version: 1;
  readAt: string;
  unreadCount: number;
}

export interface NotificationsUnreadCountSocketPayload {
  version: 1;
  unreadCount: number;
}

export interface SessionRevokedSocketPayload {
  version: 1;
  reason: 'SESSION_REVOKED';
}

export interface EventProgressUpdatedSocketPayload {
  version: 1;
  eventId: string;
  changedTaskId: string;
  overall: ProgressCount;
  stage: StageProgress;
  updatedAt: string;
}

export type NotificationSocketPayload =
  | NotificationsReadySocketPayload
  | NotificationCreatedSocketPayload
  | NotificationReadSocketPayload
  | NotificationsReadAllSocketPayload
  | NotificationsUnreadCountSocketPayload
  | SessionRevokedSocketPayload
  | EventProgressUpdatedSocketPayload;

/** Socket.IO event map for the authenticated /notifications namespace. */
export interface NotificationSocketServerEvents {
  'notifications.ready': (payload: NotificationsReadySocketPayload) => void;
  'notification.created': (payload: NotificationCreatedSocketPayload) => void;
  'notification.read': (payload: NotificationReadSocketPayload) => void;
  'notifications.read-all': (payload: NotificationsReadAllSocketPayload) => void;
  'notifications.unread-count': (payload: NotificationsUnreadCountSocketPayload) => void;
  'session.revoked': (payload: SessionRevokedSocketPayload) => void;
  'event.progress.updated': (payload: EventProgressUpdatedSocketPayload) => void;
}

/**
 * Internal event data intentionally excludes outbox status, connection data,
 * credentials, and the full notification payload. It is safe to share between
 * the transactional producer and realtime dispatcher.
 */
export interface NotificationCreatedOutboxPayload {
  version: 1;
  notificationId: string;
  recipientUserId: string;
}

export interface EventProgressUpdatedOutboxPayload extends EventProgressUpdatedSocketPayload {
  recipientEventId: string;
}

export type ApiErrorCode =
  | 'EVENT_NOT_FOUND'
  | 'EVENT_ACCESS_FORBIDDEN'
  | 'EVENT_INVALID_DATE_RANGE'
  | 'EVENT_MEMBER_ALREADY_EXISTS'
  | 'EVENT_MEMBER_TARGET_NOT_ACTIVE'
  | 'EVENT_MEMBER_ADD_FORBIDDEN'
  | 'EVENT_MEMBER_CROSS_EVENT_DEPARTMENT'
  | 'TASK_CREATE_FORBIDDEN'
  | 'EVENT_PERMISSION_DELEGATION_FORBIDDEN'
  | 'EVENT_PERMISSION_INVALID'
  | 'EVENT_PERMISSION_GRANTEE_INACTIVE'
  | 'EVENT_PERMISSION_CROSS_EVENT'
  | 'EVENT_PERMISSION_EXPIRY_INVALID'
  | 'TASK_ASSIGN_FORBIDDEN'
  | 'TASK_ASSIGNEE_INACTIVE'
  | 'TASK_ASSIGNEE_CROSS_EVENT'
  | 'TASK_STAGE_CROSS_EVENT'
  | 'TASK_STATUS_TRANSITION_INVALID'
  | 'TASK_STATUS_UPDATE_FORBIDDEN'
  | 'NOTIFICATION_NOT_FOUND'
  | 'NOTIFICATION_FORBIDDEN'
  | 'NOTIFICATION_ACTION_INVALID'
  | 'CALENDAR_RANGE_INVALID'
  | 'CALENDAR_RANGE_EXCESSIVE'
  | 'CALENDAR_ITEM_NOT_FOUND'
  | 'WEBSOCKET_UNAUTHORIZED'
  | 'WEBSOCKET_ORIGIN_FORBIDDEN'
  | 'OUTBOX_PUBLISH_FAILED';
