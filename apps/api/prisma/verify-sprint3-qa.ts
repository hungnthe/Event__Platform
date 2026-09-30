import { randomUUID } from 'node:crypto';
import { io, type Socket } from 'socket.io-client';

const apiBaseUrl = (process.env.EVENTFLOW_QA_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const webOrigin = process.env.EVENTFLOW_QA_WEB_ORIGIN ?? 'http://localhost:3000';
const password = process.env.EVENTFLOW_QA_PASSWORD;
const eventId = process.env.EVENTFLOW_QA_EVENT_ID;

interface SessionClient {
  cookie: string;
  csrfToken: string;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function cookieHeader(setCookies: string[]): string {
  return setCookies.map((value) => value.split(';', 1)[0]).filter(Boolean).join('; ');
}

async function requestJson<T>(path: string, client?: SessionClient, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('origin', webOrigin);
  headers.set('accept', 'application/json');
  if (client) headers.set('cookie', client.cookie);
  const response = await fetch(`${apiBaseUrl}/api/v1${path}`, { ...init, headers });
  const body = await response.json().catch(() => null) as T & { error?: { code?: string; message?: string } };
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path} failed (${response.status}): ${body?.error?.code ?? 'UNKNOWN'}`);
  return body;
}

async function login(email: string): Promise<SessionClient> {
  const csrfResponse = await fetch(`${apiBaseUrl}/api/v1/auth/csrf`, { headers: { origin: webOrigin, accept: 'application/json' } });
  assert(csrfResponse.ok, `Could not obtain CSRF token for ${email}.`);
  const csrf = await csrfResponse.json() as { token?: string };
  const csrfCookies = csrfResponse.headers.getSetCookie();
  assert(csrf.token && csrfCookies.length > 0, `CSRF response incomplete for ${email}.`);
  const csrfToken = csrf.token;
  const csrfCookie = cookieHeader(csrfCookies);
  const loginResponse = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { origin: webOrigin, accept: 'application/json', 'content-type': 'application/json', cookie: csrfCookie, 'x-csrf-token': csrfToken },
    body: JSON.stringify({ email, password, rememberMe: false }),
  });
  assert(loginResponse.ok, `Could not log in ${email}.`);
  const mergedCookie = cookieHeader([...csrfCookies, ...loginResponse.headers.getSetCookie()]);
  assert(mergedCookie.includes('eventflow_session='), `No session cookie was issued for ${email}.`);
  return { cookie: mergedCookie, csrfToken };
}

async function mutation<T>(path: string, client: SessionClient, method: 'POST' | 'PUT' | 'PATCH', body?: unknown): Promise<T> {
  return requestJson<T>(path, client, {
    method,
    headers: { 'content-type': 'application/json', 'x-csrf-token': client.csrfToken },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function waitForSocket(socket: Socket): Promise<{ notification: { id: string; actionPath: string; taskId: string | null }; unreadCount: number }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for notification.created.')), 10_000);
    socket.once('notification.created', (payload: unknown) => {
      clearTimeout(timeout);
      const value = payload as { notification?: { id?: string; actionPath?: string; taskId?: string | null }; unreadCount?: number };
      if (!value.notification?.id || !value.notification.actionPath || value.unreadCount === undefined) {
        reject(new Error('notification.created payload was incomplete.'));
        return;
      }
      resolve({
        notification: { id: value.notification.id, actionPath: value.notification.actionPath, taskId: value.notification.taskId ?? null },
        unreadCount: value.unreadCount,
      });
    });
  });
}

async function main(): Promise<void> {
  if (!password || password.length < 12) throw new Error('Set EVENTFLOW_QA_PASSWORD before running this local verification.');
  if (!eventId) throw new Error('Set EVENTFLOW_QA_EVENT_ID from the local QA seed output.');

  const [owner, assigner, member] = await Promise.all([
    login('qa.owner@eventflow.local'),
    login('qa.assigner@eventflow.local'),
    login('qa.member@eventflow.local'),
  ]);
  const members = await requestJson<{ items: Array<{ id: string; email: string }> }>(`/events/${eventId}/members`, owner);
  const assignerMember = members.items.find((item) => item.email === 'qa.assigner@eventflow.local');
  const memberMember = members.items.find((item) => item.email === 'qa.member@eventflow.local');
  assert(assignerMember && memberMember, 'QA event did not contain the B/C memberships.');

  await mutation(`/events/${eventId}/members/${assignerMember.id}/permissions`, owner, 'PUT', {
    permissions: ['TASK_CREATE', 'TASK_ASSIGN'],
    expiresAt: null,
  });
  const effective = await requestJson<{ effectivePermissions: string[] }>(`/events/${eventId}/membership/me/permissions`, assigner);
  assert(effective.effectivePermissions.includes('task:create') && effective.effectivePermissions.includes('task:assign'), 'B did not receive TASK_CREATE + TASK_ASSIGN.');

  const event = await requestJson<{ workflowStages: Array<{ id: string }> }>(`/events/${eventId}`, assigner);
  const stage = event.workflowStages[0];
  assert(stage, 'QA event has no workflow stage.');
  const baseline = await requestJson<{ unreadCount: number }>('/notifications/unread-count', member);
  const socket = io(`${apiBaseUrl}/notifications`, {
    transports: ['polling', 'websocket'],
    withCredentials: true,
    extraHeaders: { cookie: member.cookie, origin: webOrigin },
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out connecting C notification socket.')), 10_000);
      socket.once('notifications.ready', () => { clearTimeout(timeout); resolve(); });
      socket.once('connect_error', (error: Error) => { clearTimeout(timeout); reject(error); });
    });
    const notificationPromise = waitForSocket(socket);
    const task = await mutation<{ id: string }>(`/events/${eventId}/tasks`, assigner, 'POST', {
      title: `QA realtime assignment ${randomUUID()}`,
      description: 'Local-only acceptance verification.',
      workflowStageId: stage.id,
      assigneeEventMemberIds: [memberMember.id],
      priority: 'HIGH',
      dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    const created = await notificationPromise;
    assert(created.notification.taskId === task.id, 'Socket notification did not reference the newly created task.');
    assert(created.notification.actionPath === `/app/events/${eventId}/tasks/${task.id}`, 'Notification action path was not the expected internal task route.');
    assert(created.unreadCount === baseline.unreadCount + 1, 'Socket unread count did not increase exactly once.');

    const center = await requestJson<{ items: Array<{ id: string }>; unreadCount: number }>('/notifications?unreadOnly=true', member);
    assert(center.items.some((item) => item.id === created.notification.id), 'Notification center did not contain the assignment notification.');
    const taskDetail = await requestJson<{ id: string }>(`/tasks/${task.id}`, member);
    assert(taskDetail.id === task.id, 'C could not open the assigned task route.');
    const marked = await mutation<{ unreadCount: number }>(`/notifications/${created.notification.id}/read`, member, 'PATCH');
    assert(marked.unreadCount === baseline.unreadCount, 'Marking read did not restore the previous unread count.');
    console.info('Sprint 3 QA API/socket flow passed.');
  } finally {
    socket.disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Sprint 3 QA verification failed.');
  process.exitCode = 1;
});
