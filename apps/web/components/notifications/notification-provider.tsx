'use client';

import {
  NOTIFICATION_SOCKET_EVENTS,
  type EventProgressUpdatedSocketPayload,
  type Notification as EventNotification,
  type NotificationCreatedSocketPayload,
  type NotificationPreference,
  type NotificationReadSocketPayload,
  type NotificationsReadAllSocketPayload,
  type NotificationsUnreadCountSocketPayload,
  type UpdateNotificationPreferenceRequest,
} from '@eventflow/contracts';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthenticatedUser } from '../authenticated-app';
import { useDataRefresh } from '../data-refresh-provider';
import {
  apiBaseUrl,
  getNotificationPreferences,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from '../../lib/api-client';
import { isSafeInternalActionPath, markAllNotificationsReadInList, markNotificationReadInList, mergeNotifications } from '../../lib/notifications/notification-state';

export type RealtimeConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
export type DesktopPermissionState = NotificationPermission | 'unsupported';

interface NotificationContextValue {
  notifications: EventNotification[];
  unreadCount: number;
  preferences: NotificationPreference | null;
  connectionState: RealtimeConnectionState;
  desktopPermission: DesktopPermissionState;
  audioUnlocked: boolean;
  toasts: EventNotification[];
  refreshNotificationCenter: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  openNotification: (notification: EventNotification) => Promise<void>;
  dismissToast: (notificationId: string) => void;
  updatePreferences: (request: UpdateNotificationPreferenceRequest) => Promise<void>;
  unlockAudio: () => Promise<boolean>;
  requestDesktopNotifications: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);
const soundClaimPrefix = 'eventflow:notification-sound:';
const soundClaimLifetimeMs = 15_000;

function createTabId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function currentDesktopPermission(): DesktopPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return window.Notification.permission;
}

function socketEndpoint(): string {
  const base = process.env.NEXT_PUBLIC_WS_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? apiBaseUrl;
  const namespaceValue = process.env.NEXT_PUBLIC_WS_NAMESPACE ?? '/notifications';
  const namespace = namespaceValue.startsWith('/') ? namespaceValue : '/notifications';
  return `${base.replace(/\/$/, '')}${namespace}`;
}

function parseSoundClaim(value: string | null): { tabId: string; expiresAt: number } | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return null;
    const tabId = typeof parsed.tabId === 'string' ? parsed.tabId : null;
    const expiresAt = typeof parsed.expiresAt === 'number' ? parsed.expiresAt : null;
    return tabId && expiresAt !== null ? { tabId, expiresAt } : null;
  } catch {
    return null;
  }
}

function isSocketPayloadForUser(payload: { version: number }, expectedVersion = 1): boolean {
  return payload.version === expectedVersion;
}

export function NotificationProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { user } = useAuthenticatedUser();
  const { invalidate } = useDataRefresh();
  const router = useRouter();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<EventNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState<NotificationPreference | null>(null);
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>('connecting');
  const [desktopPermission, setDesktopPermission] = useState<DesktopPermissionState>(currentDesktopPermission);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [toasts, setToasts] = useState<EventNotification[]>([]);
  const notificationsRef = useRef<EventNotification[]>([]);
  const unreadCountRef = useRef(0);
  const preferencesRef = useRef<NotificationPreference | null>(null);
  const seenNotificationIdsRef = useRef(new Set<string>());
  const seenProgressEventsRef = useRef(new Set<string>());
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundChannelRef = useRef<BroadcastChannel | null>(null);
  const remoteSoundClaimsRef = useRef(new Set<string>());
  const tabIdRef = useRef(createTabId());
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => { notificationsRef.current = notifications; }, [notifications]);
  useEffect(() => { unreadCountRef.current = unreadCount; }, [unreadCount]);
  useEffect(() => { preferencesRef.current = preferences; }, [preferences]);

  const mergeFromServer = useCallback((items: EventNotification[]) => {
    for (const item of items) seenNotificationIdsRef.current.add(item.id);
    setNotifications((current) => items.reduce((next, item) => mergeNotifications(next, item), current));
  }, []);

  const reconcileMissedNotifications = useCallback(async () => {
    const [recentResult, unreadResult] = await Promise.allSettled([
      getNotifications({ page: 1, pageSize: 20, unreadOnly: true, sortDirection: 'desc' }),
      getUnreadNotificationCount(),
    ]);
    if (recentResult.status === 'fulfilled') {
      mergeFromServer(recentResult.value.items);
      if (unreadResult.status !== 'fulfilled') setUnreadCount(recentResult.value.unreadCount);
    }
    if (unreadResult.status === 'fulfilled') setUnreadCount(unreadResult.value);
  }, [mergeFromServer]);

  const refreshNotificationCenter = useCallback(async () => {
    const [list, count] = await Promise.all([
      getNotifications({ page: 1, pageSize: 30, sortDirection: 'desc' }),
      getUnreadNotificationCount(),
    ]);
    mergeFromServer(list.items);
    setUnreadCount(count);
  }, [mergeFromServer]);

  const unlockAudio = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !window.AudioContext) return false;
    try {
      const context = audioContextRef.current ?? new window.AudioContext();
      audioContextRef.current = context;
      if (context.state !== 'running') await context.resume();
      const unlocked = context.state === 'running';
      setAudioUnlocked(unlocked);
      return unlocked;
    } catch {
      setAudioUnlocked(false);
      return false;
    }
  }, []);

  const canClaimNotificationSound = useCallback((notificationId: string): boolean => {
    if (typeof window === 'undefined') return false;
    if (remoteSoundClaimsRef.current.has(notificationId)) return false;
    const key = `${soundClaimPrefix}${notificationId}`;
    const now = Date.now();
    try {
      const existing = parseSoundClaim(window.localStorage.getItem(key));
      if (existing && existing.expiresAt > now && existing.tabId !== tabIdRef.current) return false;
      const claim = { tabId: tabIdRef.current, expiresAt: now + soundClaimLifetimeMs };
      window.localStorage.setItem(key, JSON.stringify(claim));
      const verified = parseSoundClaim(window.localStorage.getItem(key));
      if (!verified || verified.tabId !== tabIdRef.current) return false;
      soundChannelRef.current?.postMessage({ kind: 'sound-claimed', notificationId });
      return true;
    } catch {
      // Storage may be disabled. BroadcastChannel still prevents most duplicate
      // audio; the local visual notification is never affected.
      soundChannelRef.current?.postMessage({ kind: 'sound-claimed', notificationId });
      return true;
    }
  }, []);

  const playChime = useCallback((notificationId: string) => {
    if (!preferencesRef.current?.soundEnabled || !audioContextRef.current || audioContextRef.current.state !== 'running') return;
    if (!canClaimNotificationSound(notificationId)) return;
    try {
      const context = audioContextRef.current;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(740, context.currentTime);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.11, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.19);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.2);
    } catch {
      // Browser audio policy or a transient audio failure must not suppress UI.
    }
  }, [canClaimNotificationSound]);

  const markAsRead = useCallback(async (notificationId: string): Promise<void> => {
    const original = notificationsRef.current;
    const originalUnreadCount = unreadCountRef.current;
    const existing = original.find((item) => item.id === notificationId);
    if (!existing || existing.readAt) return;
    const provisionalReadAt = new Date().toISOString();
    setNotifications((current) => markNotificationReadInList(current, notificationId, provisionalReadAt));
    setUnreadCount((current) => Math.max(0, current - 1));
    try {
      const result = await markNotificationRead(notificationId);
      mergeFromServer([result.notification]);
      setUnreadCount(result.unreadCount);
    } catch (error) {
      setNotifications(original);
      setUnreadCount(originalUnreadCount);
      throw error;
    }
  }, [mergeFromServer]);

  const markAllAsRead = useCallback(async (): Promise<void> => {
    const original = notificationsRef.current;
    const originalUnreadCount = unreadCountRef.current;
    const provisionalReadAt = new Date().toISOString();
    setNotifications((current) => markAllNotificationsReadInList(current, provisionalReadAt));
    setUnreadCount(0);
    try {
      const result = await markAllNotificationsRead();
      setNotifications((current) => markAllNotificationsReadInList(current, result.readAt));
      setUnreadCount(result.unreadCount);
    } catch (error) {
      setNotifications(original);
      setUnreadCount(originalUnreadCount);
      throw error;
    }
  }, []);

  const openNotification = useCallback(async (notification: EventNotification): Promise<void> => {
    if (!isSafeInternalActionPath(notification.actionPath)) return;
    try {
      await markAsRead(notification.id);
    } catch {
      // Navigation remains useful even when a temporary read mutation fails.
    }
    router.push(notification.actionPath);
  }, [markAsRead, router]);

  const showDesktopNotification = useCallback((notification: EventNotification) => {
    if (!preferencesRef.current?.desktopEnabled || currentDesktopPermission() !== 'granted') return;
    if (typeof document === 'undefined' || document.visibilityState !== 'hidden') return;
    try {
      const desktopNotification = new window.Notification(notification.title, {
        body: notification.body,
        tag: `eventflow-notification-${notification.id}`,
      });
      desktopNotification.onclick = () => {
        window.focus();
        void openNotification(notification);
      };
    } catch {
      // Notification permissions may change between the check and construction.
    }
  }, [openNotification]);

  const presentCreatedNotification = useCallback((notification: EventNotification, nextUnreadCount: number) => {
    const wasAlreadySeen = seenNotificationIdsRef.current.has(notification.id);
    seenNotificationIdsRef.current.add(notification.id);
    setNotifications((current) => mergeNotifications(current, notification));
    setUnreadCount(nextUnreadCount);
    invalidate(['my-events', 'my-tasks', `event-tasks:${notification.eventId ?? ''}`, 'calendar']);
    if (wasAlreadySeen) return;
    setToasts((current) => current.some((item) => item.id === notification.id) ? current : [notification, ...current].slice(0, 3));
    playChime(notification.id);
    showDesktopNotification(notification);
  }, [invalidate, playChime, showDesktopNotification]);

  const dismissToast = useCallback((notificationId: string) => {
    setToasts((current) => current.filter((item) => item.id !== notificationId));
  }, []);

  const updatePreferences = useCallback(async (request: UpdateNotificationPreferenceRequest): Promise<void> => {
    const saved = await updateNotificationPreferences(request);
    setPreferences(saved);
  }, []);

  const requestDesktopNotifications = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !window.Notification) {
      setDesktopPermission('unsupported');
      return false;
    }
    const current = window.Notification.permission;
    if (current === 'denied') {
      setDesktopPermission(current);
      return false;
    }
    const result = current === 'granted' ? current : await window.Notification.requestPermission();
    setDesktopPermission(result);
    if (result !== 'granted') return false;
    await updatePreferences({ desktopEnabled: true });
    return true;
  }, [updatePreferences]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return undefined;
    const channel = new BroadcastChannel('eventflow:notifications');
    soundChannelRef.current = channel;
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const data = event.data;
      if (!isRecord(data)) return;
      if (data.kind === 'sound-claimed' && typeof data.notificationId === 'string') remoteSoundClaimsRef.current.add(data.notificationId);
    };
    return () => {
      channel.close();
      if (soundChannelRef.current === channel) soundChannelRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onFirstUserGesture = () => { void unlockAudio(); };
    window.addEventListener('pointerdown', onFirstUserGesture, { once: true, passive: true });
    return () => window.removeEventListener('pointerdown', onFirstUserGesture);
  }, [unlockAudio]);

  useEffect(() => {
    void reconcileMissedNotifications();
    void getNotificationPreferences().then(setPreferences).catch(() => undefined);
  }, [reconcileMissedNotifications]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register('/service-worker.js').catch(() => undefined);
  }, []);

  useEffect(() => {
    const socket = io(socketEndpoint(), { autoConnect: false, withCredentials: true });
    socketRef.current = socket;
    const handleConnect = () => {
      setConnectionState('connected');
      void reconcileMissedNotifications();
    };
    const handleDisconnect = () => setConnectionState('disconnected');
    const handleConnectError = () => setConnectionState('disconnected');
    const handleReconnectAttempt = () => setConnectionState('reconnecting');
    const handleReady = (payload: { version: number; userId: string }) => {
      if (!isSocketPayloadForUser(payload) || payload.userId !== user.id) socket.disconnect();
    };
    const handleCreated = (payload: NotificationCreatedSocketPayload) => {
      if (!isSocketPayloadForUser(payload)) return;
      presentCreatedNotification(payload.notification, payload.unreadCount);
    };
    const handleRead = (payload: NotificationReadSocketPayload) => {
      if (!isSocketPayloadForUser(payload)) return;
      setNotifications((current) => markNotificationReadInList(current, payload.notificationId, payload.readAt));
      setUnreadCount(payload.unreadCount);
    };
    const handleReadAll = (payload: NotificationsReadAllSocketPayload) => {
      if (!isSocketPayloadForUser(payload)) return;
      setNotifications((current) => markAllNotificationsReadInList(current, payload.readAt));
      setUnreadCount(payload.unreadCount);
    };
    const handleUnreadCount = (payload: NotificationsUnreadCountSocketPayload) => {
      if (isSocketPayloadForUser(payload)) setUnreadCount(payload.unreadCount);
    };
    const handleEventProgressUpdated = (payload: EventProgressUpdatedSocketPayload) => {
      if (!isSocketPayloadForUser(payload)) return;
      const eventKey = `${payload.eventId}:${payload.changedTaskId}:${payload.updatedAt}`;
      if (seenProgressEventsRef.current.has(eventKey)) return;
      seenProgressEventsRef.current.add(eventKey);
      invalidate([
        `event:${payload.eventId}`,
        `event-tasks:${payload.eventId}`,
        `workflow:${payload.eventId}`,
        `task:${payload.changedTaskId}`,
        'my-events',
        'my-tasks',
      ]);
    };
    const handleSessionRevoked = () => {
      socket.disconnect();
      const returnTo = pathname?.startsWith('/app') ? pathname : '/app/events';
      router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      router.refresh();
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.io.on('reconnect_attempt', handleReconnectAttempt);
    socket.on(NOTIFICATION_SOCKET_EVENTS.READY, handleReady);
    socket.on(NOTIFICATION_SOCKET_EVENTS.CREATED, handleCreated);
    socket.on(NOTIFICATION_SOCKET_EVENTS.READ, handleRead);
    socket.on(NOTIFICATION_SOCKET_EVENTS.READ_ALL, handleReadAll);
    socket.on(NOTIFICATION_SOCKET_EVENTS.UNREAD_COUNT, handleUnreadCount);
    socket.on(NOTIFICATION_SOCKET_EVENTS.EVENT_PROGRESS_UPDATED, handleEventProgressUpdated);
    socket.on(NOTIFICATION_SOCKET_EVENTS.SESSION_REVOKED, handleSessionRevoked);
    socket.connect();

    return () => {
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [invalidate, pathname, presentCreatedNotification, reconcileMissedNotifications, router, user.id]);

  const value = useMemo<NotificationContextValue>(() => ({
    notifications,
    unreadCount,
    preferences,
    connectionState,
    desktopPermission,
    audioUnlocked,
    toasts,
    refreshNotificationCenter,
    markAsRead,
    markAllAsRead,
    openNotification,
    dismissToast,
    updatePreferences,
    unlockAudio,
    requestDesktopNotifications,
  }), [audioUnlocked, connectionState, desktopPermission, dismissToast, markAllAsRead, markAsRead, notifications, openNotification, preferences, refreshNotificationCenter, requestDesktopNotifications, toasts, unreadCount, unlockAudio, updatePreferences]);

  return <NotificationContext.Provider value={value}>{children}<NotificationToastRegion /></NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('NotificationProvider is required.');
  return context;
}

function NotificationToastRegion() {
  const { toasts, dismissToast, openNotification } = useNotifications();
  if (toasts.length === 0) return null;
  return <section aria-label="Thông báo mới" className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto grid max-w-md gap-3 lg:inset-x-auto lg:bottom-auto lg:right-6 lg:top-6">
    {toasts.map((notification) => <article key={notification.id} role="status" className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-xl">
      <div className="flex gap-3"><span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-50 text-indigo-700">🔔</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-950">{notification.title}</p><p className="mt-1 text-sm leading-5 text-slate-600">{notification.body}</p></div><button type="button" onClick={() => dismissToast(notification.id)} className="-mt-1 -mr-1 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-indigo-100" aria-label="Đóng thông báo">×</button></div>
      <div className="mt-3 flex justify-end"><button type="button" onClick={() => void openNotification(notification)} className="min-h-11 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-indigo-200">{notification.taskId ? 'Xem công việc' : 'Xem chi tiết'}</button></div>
    </article>)}
  </section>;
}
