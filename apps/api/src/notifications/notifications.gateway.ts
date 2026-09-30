import { OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type {
  Notification,
  NotificationSocketServerEvents,
  NotificationsReadAllSocketPayload,
  NotificationReadSocketPayload,
  EventProgressUpdatedSocketPayload,
} from '@eventflow/contracts';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Logger } from 'nestjs-pino';
import type { DefaultEventsMap, Namespace, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { SocketSessionRegistry } from '../infrastructure/socket-session-registry.service';
import { NOTIFICATION_SOCKET_EVENTS } from './notification-events';

interface SocketIdentity {
  userId: string;
  sessionId: string;
  expiresAt: Date;
}

type NotificationNamespace = Namespace<DefaultEventsMap, NotificationSocketServerEvents>;

/**
 * Authenticated Socket.IO namespace. It never accepts recipient identities or
 * room names from the client; the authenticated session determines both.
 */
@WebSocketGateway({ namespace: '/notifications', cors: false })
export class NotificationsGateway implements OnApplicationShutdown {
  @WebSocketServer()
  private server!: NotificationNamespace;

  private readonly identities = new Map<string, SocketIdentity>();
  private publisher: Redis | null = null;
  private subscriber: Redis | null = null;
  private adapterReady = false;
  private adapterInitialization: Promise<void> = Promise.resolve();

  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly registry: SocketSessionRegistry,
    private readonly logger: Logger,
  ) {}

  afterInit(server: NotificationNamespace): void {
    this.server = server;
    const configuredNamespace = this.config.getOrThrow<string>('WS_NAMESPACE');
    if (configuredNamespace !== server.name) {
      throw new Error('WebSocket namespace configuration does not match the EventFlow notification contract.');
    }
    this.adapterInitialization = this.config.getOrThrow<boolean>('WS_ENABLED')
      ? this.configureRedisAdapter(server)
      : Promise.resolve();
    this.registry.setRemoteDisconnecter((target) => this.disconnectRemote(target.kind, target.id, target.reason));
    server.use((socket, next) => {
      void this.authenticateHandshake(socket)
        .then(() => next())
        .catch((error: unknown) => {
          const code = error instanceof WebSocketAuthError ? error.code : 'WEBSOCKET_UNAUTHORIZED';
          this.logger.warn({ event: 'websocket.authentication_rejected', code }, 'WebSocket handshake rejected');
          next(new Error(code));
        });
    });
  }

  handleConnection(socket: Socket): void {
    const identity = this.identities.get(socket.id);
    if (!identity) {
      socket.disconnect(true);
      return;
    }
    void socket.join([this.roomFor(identity.userId), this.sessionRoomFor(identity.sessionId)]);
    this.registry.register(socket, identity.userId, identity.sessionId, identity.expiresAt);
    socket.emit(NOTIFICATION_SOCKET_EVENTS.READY, {
      version: 1,
      connectedAt: new Date().toISOString(),
      userId: identity.userId,
    });
    this.logger.log({ event: 'websocket.connected', connections: this.registry.connectionCount() }, 'WebSocket connected');
  }

  handleDisconnect(socket: Socket): void {
    this.identities.delete(socket.id);
    this.registry.unregister(socket.id);
    this.logger.log({ event: 'websocket.disconnected', connections: this.registry.connectionCount() }, 'WebSocket disconnected');
  }

  emitCreated(userId: string, notification: Notification, unreadCount: number): void {
    this.server.to(this.roomFor(userId)).emit(NOTIFICATION_SOCKET_EVENTS.CREATED, {
      version: 1,
      notification,
      unreadCount,
    });
  }

  emitRead(userId: string, notificationId: string, readAt: Date, unreadCount: number): void {
    const payload: NotificationReadSocketPayload = {
      version: 1,
      notificationId,
      readAt: readAt.toISOString(),
      unreadCount,
    };
    this.server.to(this.roomFor(userId)).emit(NOTIFICATION_SOCKET_EVENTS.READ, payload);
  }

  emitReadAll(userId: string, readAt: Date, unreadCount: number): void {
    const payload: NotificationsReadAllSocketPayload = { version: 1, readAt: readAt.toISOString(), unreadCount };
    this.server.to(this.roomFor(userId)).emit(NOTIFICATION_SOCKET_EVENTS.READ_ALL, payload);
  }

  emitUnreadCount(userId: string, unreadCount: number): void {
    this.server.to(this.roomFor(userId)).emit(NOTIFICATION_SOCKET_EVENTS.UNREAD_COUNT, { version: 1, unreadCount });
  }

  emitEventProgress(userIds: string[], payload: EventProgressUpdatedSocketPayload): void {
    for (const userId of new Set(userIds)) {
      this.server.to(this.roomFor(userId)).emit(NOTIFICATION_SOCKET_EVENTS.EVENT_PROGRESS_UPDATED, payload);
    }
  }

  isAdapterReady(): boolean {
    return this.adapterReady;
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([this.closeRedis(this.publisher), this.closeRedis(this.subscriber)]);
    this.publisher = null;
    this.subscriber = null;
    this.adapterReady = false;
  }

  private async authenticateHandshake(socket: Socket): Promise<void> {
    if (!this.config.getOrThrow<boolean>('WS_ENABLED')) {
      throw new WebSocketAuthError('WEBSOCKET_UNAUTHORIZED');
    }
    // A namespace adapter owns room membership. Gate the handshake until the
    // Redis adapter either initializes or explicitly falls back locally, so a
    // socket cannot join a room on an adapter that is swapped moments later.
    await this.adapterInitialization;
    this.assertAllowedOrigin(socket.handshake.headers.origin);
    const authenticated = await this.auth.authenticateSocket(socket.handshake.headers.cookie);
    this.identities.set(socket.id, {
      userId: authenticated.user.id,
      sessionId: authenticated.sessionId,
      expiresAt: authenticated.expiresAt,
    });
  }

  private assertAllowedOrigin(origin: string | undefined): void {
    if (!origin || !this.allowedOrigins().has(this.normalizeOrigin(origin))) {
      throw new WebSocketAuthError('WEBSOCKET_ORIGIN_FORBIDDEN');
    }
  }

  private allowedOrigins(): Set<string> {
    return new Set(
      this.config.getOrThrow<string>('WS_ALLOWED_ORIGINS')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
        .map((origin) => this.normalizeOrigin(origin)),
    );
  }

  private normalizeOrigin(origin: string): string {
    try {
      return new URL(origin).origin;
    } catch {
      throw new WebSocketAuthError('WEBSOCKET_ORIGIN_FORBIDDEN');
    }
  }

  private async configureRedisAdapter(server: NotificationNamespace): Promise<void> {
    const redisUrl = this.config.getOrThrow<string>('REDIS_URL');
    const publisher = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      connectTimeout: 1_500,
      retryStrategy: (attempt) => attempt >= 2 ? null : 150,
    });
    const subscriber = publisher.duplicate({
      lazyConnect: true,
      maxRetriesPerRequest: null,
      connectTimeout: 1_500,
      retryStrategy: (attempt) => attempt >= 2 ? null : 150,
    });
    publisher.on('error', (error: Error) => {
      this.logger.warn({ event: 'websocket.redis_publisher_error', reason: this.errorReason(error) }, 'Socket.IO Redis publisher error');
    });
    subscriber.on('error', (error: Error) => {
      this.logger.warn({ event: 'websocket.redis_subscriber_error', reason: this.errorReason(error) }, 'Socket.IO Redis subscriber error');
    });
    try {
      await this.connectClientsWithin([publisher, subscriber], 2_000);
      server.server.adapter(createAdapter(publisher, subscriber, {
        key: this.config.getOrThrow<string>('SOCKET_IO_REDIS_CHANNEL_PREFIX'),
      }));
      this.publisher = publisher;
      this.subscriber = subscriber;
      this.adapterReady = true;
      this.logger.log({ event: 'websocket.redis_adapter_ready' }, 'Socket.IO Redis adapter initialized');
    } catch (error: unknown) {
      await Promise.all([this.closeRedis(publisher), this.closeRedis(subscriber)]);
      this.logger.warn({ event: 'websocket.redis_adapter_unavailable', reason: this.errorReason(error) }, 'Socket.IO Redis adapter unavailable; using local delivery');
    }
  }

  private async closeRedis(client: Redis | null): Promise<void> {
    if (!client) return;
    if (client.status === 'ready') {
      await client.quit().catch(() => undefined);
      return;
    }
    client.disconnect();
  }

  private async connectClientsWithin(clients: Redis[], timeoutMs: number): Promise<void> {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<void>((_resolve, reject) => {
      timeout = setTimeout(() => reject(new Error('Socket.IO Redis adapter connection timed out.')), timeoutMs);
      timeout.unref();
    });
    try {
      await Promise.race([Promise.all(clients.map((client) => client.connect())).then(() => undefined), timeoutPromise]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private errorReason(error: unknown): string {
    return error instanceof Error ? error.message.replace(/[\r\n]/g, ' ').slice(0, 180) : 'unknown';
  }

  private roomFor(userId: string): string {
    return `user:${userId}`;
  }

  private sessionRoomFor(sessionId: string): string {
    return `session:${sessionId}`;
  }

  private disconnectRemote(kind: 'session' | 'user', id: string, reason: 'SESSION_REVOKED'): void {
    const room = kind === 'session' ? this.sessionRoomFor(id) : this.roomFor(id);
    this.server.to(room).emit(NOTIFICATION_SOCKET_EVENTS.SESSION_REVOKED, { version: 1, reason });
    this.server.in(room).disconnectSockets(true);
  }
}

class WebSocketAuthError extends Error {
  constructor(readonly code: 'WEBSOCKET_UNAUTHORIZED' | 'WEBSOCKET_ORIGIN_FORBIDDEN') {
    super(code);
  }
}
