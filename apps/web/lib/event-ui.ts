import type { EventMemberRole, EventPermission, EventStatus, TaskPriority, TaskStatus } from '@eventflow/contracts';

export const taskStatuses: TaskStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE', 'CANCELLED'];
export const taskPriorities: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
export const eventMemberRoles: EventMemberRole[] = ['OWNER', 'COORDINATOR', 'DEPARTMENT_LEAD', 'MEMBER', 'VOLUNTEER', 'GUEST'];

export function roleLabel(role: EventMemberRole): string {
  switch (role) {
    case 'OWNER': return 'Chủ sự kiện';
    case 'COORDINATOR': return 'Điều phối viên';
    case 'DEPARTMENT_LEAD': return 'Trưởng bộ phận';
    case 'MEMBER': return 'Thành viên';
    case 'VOLUNTEER': return 'Tình nguyện viên';
    case 'GUEST': return 'Khách';
  }
}

export function roleDescription(role: EventMemberRole): string {
  switch (role) {
    case 'OWNER': return 'Quản lý toàn bộ sự kiện, thành viên, công việc và tài liệu.';
    case 'COORDINATOR': return 'Điều phối vận hành và quản lý công việc của sự kiện.';
    case 'DEPARTMENT_LEAD': return 'Quản lý công việc trong bộ phận được phân công.';
    case 'MEMBER': return 'Thực hiện các công việc được giao.';
    case 'VOLUNTEER': return 'Hỗ trợ các công việc được giao.';
    case 'GUEST': return 'Theo dõi sự kiện và các công việc được phép xem.';
  }
}

export function taskStatusLabel(status: TaskStatus): string {
  switch (status) {
    case 'NOT_STARTED': return 'Chưa bắt đầu';
    case 'IN_PROGRESS': return 'Đang thực hiện';
    case 'BLOCKED': return 'Đang bị chặn';
    case 'IN_REVIEW': return 'Chờ duyệt';
    case 'DONE': return 'Đã hoàn thành';
    case 'CANCELLED': return 'Đã hủy';
  }
}

export function priorityLabel(priority: TaskPriority): string {
  switch (priority) {
    case 'LOW': return 'Thấp';
    case 'MEDIUM': return 'Trung bình';
    case 'HIGH': return 'Cao';
    case 'URGENT': return 'Khẩn cấp';
  }
}

export function eventStatusLabel(status: EventStatus): string {
  switch (status) {
    case 'DRAFT': return 'Bản nháp';
    case 'UPCOMING': return 'Sắp diễn ra';
    case 'ONGOING': return 'Đang diễn ra';
    case 'ENDED': return 'Đã kết thúc';
    case 'ARCHIVED': return 'Đã lưu trữ';
  }
}

export function formatDate(value: string, includeTime = false): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa xác định';
  return new Intl.DateTimeFormat('vi-VN', includeTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(date);
}

export function formatDateRange(startsAt: string, endsAt: string): string {
  return `${formatDate(startsAt)} – ${formatDate(endsAt)}`;
}

export function dateTimeLocalValue(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function isoFromDateTimeLocal(value: string): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function clampProgress(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function initials(name: string | null, email: string): string {
  const source = (name || email).trim();
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0]?.slice(0, 2).toUpperCase() ?? '?';
  return `${words[0]?.[0] ?? ''}${words[words.length - 1]?.[0] ?? ''}`.toUpperCase();
}

export function hasPermission(permissions: EventPermission[], permission: EventPermission): boolean {
  return permissions.includes(permission);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.';
}

export function fileSizeLabel(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
