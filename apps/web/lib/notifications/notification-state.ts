import type { Notification } from '@eventflow/contracts';

/** Keep a single newest-first projection when REST reconciliation and sockets overlap. */
export function mergeNotifications(current: Notification[], incoming: Notification): Notification[] {
  const withoutIncoming = current.filter((item) => item.id !== incoming.id);
  return [incoming, ...withoutIncoming].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

export function markNotificationReadInList(current: Notification[], notificationId: string, readAt: string): Notification[] {
  return current.map((item) => item.id === notificationId ? { ...item, readAt } : item);
}

export function markAllNotificationsReadInList(current: Notification[], readAt: string): Notification[] {
  return current.map((item) => item.readAt ? item : { ...item, readAt });
}

export function unreadBadgeLabel(unreadCount: number): string | null {
  if (unreadCount <= 0) return null;
  return unreadCount > 99 ? '99+' : String(unreadCount);
}

/**
 * Server-generated action paths are still checked at the presentation edge.
 * This makes a malformed response incapable of becoming an open redirect.
 */
export function isSafeInternalActionPath(value: string): boolean {
  if (!value.startsWith('/app/') || value.startsWith('//') || value.includes('\\')) return false;
  try {
    const parsed = new URL(value, 'https://eventflow.invalid');
    return parsed.origin === 'https://eventflow.invalid' && parsed.pathname.startsWith('/app/');
  } catch {
    return false;
  }
}
