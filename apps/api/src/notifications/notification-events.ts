/**
 * Runtime event names for the CJS API process. The public typed declaration
 * lives in @eventflow/contracts; this local value avoids requiring that ESM
 * type-only package from ts-node at API startup.
 */
export const NOTIFICATION_SOCKET_EVENTS = {
  READY: 'notifications.ready',
  CREATED: 'notification.created',
  READ: 'notification.read',
  READ_ALL: 'notifications.read-all',
  UNREAD_COUNT: 'notifications.unread-count',
  SESSION_REVOKED: 'session.revoked',
  EVENT_PROGRESS_UPDATED: 'event.progress.updated',
} as const;
