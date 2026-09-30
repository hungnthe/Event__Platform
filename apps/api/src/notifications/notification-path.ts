import { DomainException } from '../common/domain.exception';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Notification action URLs are deliberately constrained to first-party app
 * paths. The frontend treats them as navigation values, so this keeps a
 * persisted notification from becoming an open redirect.
 */
export function assertInternalActionPath(value: string): string {
  const candidate = value.trim();
  const invalid = candidate.length === 0
    || !candidate.startsWith('/app/')
    || candidate.startsWith('//')
    || candidate.includes('\\')
    || hasControlCharacters(candidate)
    || /^[a-z][a-z0-9+.-]*:/i.test(candidate);

  if (invalid) {
    throw new DomainException(400, 'NOTIFICATION_ACTION_INVALID', 'Đường dẫn thao tác thông báo không hợp lệ.');
  }

  const parsed = new URL(candidate, 'https://eventflow.invalid');
  if (parsed.origin !== 'https://eventflow.invalid' || !parsed.pathname.startsWith('/app/')) {
    throw new DomainException(400, 'NOTIFICATION_ACTION_INVALID', 'Đường dẫn thao tác thông báo không hợp lệ.');
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function buildTaskActionPath(eventId: string, taskId: string): string {
  if (!UUID_PATTERN.test(eventId) || !UUID_PATTERN.test(taskId)) {
    throw new DomainException(400, 'NOTIFICATION_ACTION_INVALID', 'Đường dẫn công việc không hợp lệ.');
  }
  return `/app/events/${eventId}/tasks/${taskId}`;
}

function hasControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return (code >= 0 && code <= 31) || code === 127;
  });
}
