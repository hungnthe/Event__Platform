import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EventProgressUpdatedOutboxPayload, NotificationCreatedOutboxPayload, ProgressCount, StageProgress } from '@eventflow/contracts';
import { OutboxEvent, OutboxStatus, Prisma } from '@prisma/client';
import { Logger } from 'nestjs-pino';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeOutboxError } from './notification-content';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';

const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 60_000;

@Injectable()
export class OutboxDispatcher implements OnModuleInit, OnModuleDestroy {
  private interval: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly gateway: NotificationsGateway,
    private readonly config: ConfigService,
    private readonly logger: Logger,
  ) {}

  onModuleInit(): void {
    if (!this.config.getOrThrow<boolean>('NOTIFICATION_OUTBOX_ENABLED')) return;
    const pollInterval = this.config.getOrThrow<number>('NOTIFICATION_OUTBOX_POLL_INTERVAL_MS');
    this.interval = setInterval(() => void this.dispatchBatch(), pollInterval);
    this.interval.unref();
    void this.dispatchBatch();
  }

  onModuleDestroy(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  async dispatchBatch(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const staleBefore = new Date(now.getTime() - this.config.getOrThrow<number>('NOTIFICATION_OUTBOX_LOCK_TIMEOUT_MS'));
      const batchSize = this.config.getOrThrow<number>('NOTIFICATION_OUTBOX_BATCH_SIZE');
      const candidates = await this.prisma.outboxEvent.findMany({
        where: {
          OR: [
            { status: OutboxStatus.PENDING, availableAt: { lte: now } },
            { status: OutboxStatus.PROCESSING, lockedAt: { lt: staleBefore } },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: batchSize,
        select: { id: true },
      });
      for (const candidate of candidates) {
        await this.processOne(candidate.id, now, staleBefore);
      }
    } catch (error: unknown) {
      this.logger.error({ event: 'notification.outbox_dispatch_failed', requestId: null, reason: sanitizeOutboxError(error) }, 'Notification outbox dispatch failed');
    } finally {
      this.running = false;
    }
  }

  private async processOne(id: string, now: Date, staleBefore: Date): Promise<void> {
    const claim = await this.prisma.outboxEvent.updateMany({
      where: {
        id,
        OR: [
          { status: OutboxStatus.PENDING, availableAt: { lte: now } },
          { status: OutboxStatus.PROCESSING, lockedAt: { lt: staleBefore } },
        ],
      },
      data: { status: OutboxStatus.PROCESSING, lockedAt: now, attempts: { increment: 1 }, lastError: null },
    });
    if (claim.count === 0) return;

    const event = await this.prisma.outboxEvent.findUnique({ where: { id } });
    if (!event || event.status !== OutboxStatus.PROCESSING || !event.lockedAt || event.lockedAt.getTime() !== now.getTime()) return;

    try {
      await this.publish(event);
      const processedAt = new Date();
      await this.prisma.$transaction(async (transaction) => {
        const completed = await transaction.outboxEvent.updateMany({
          where: { id: event.id, status: OutboxStatus.PROCESSING, lockedAt: now },
          data: { status: OutboxStatus.PUBLISHED, processedAt, lockedAt: null, lastError: null },
        });
        if (completed.count === 0) return;
        const payload = parseNotificationPayload(event.payload);
        if (payload) {
          await transaction.notification.updateMany({
            where: { id: payload.notificationId, recipientUserId: payload.recipientUserId, realtimePublishedAt: null },
            data: { realtimePublishedAt: processedAt },
          });
        }
      });
      this.logger.log({ event: 'notification.outbox_published', outboxEventId: event.id, requestId: null }, 'Notification outbox event published');
    } catch (error: unknown) {
      await this.reschedule(event, now, error);
    }
  }

  private async publish(event: OutboxEvent): Promise<void> {
    if (event.eventType === 'NOTIFICATION_CREATED') {
      const payload = parseNotificationPayload(event.payload);
      if (!payload) throw new Error('Invalid notification outbox payload.');
      const notification = await this.prisma.notification.findFirst({
        where: { id: payload.notificationId, recipientUserId: payload.recipientUserId },
      });
      if (!notification) throw new Error('Notification record is unavailable.');
      const unreadCount = await this.prisma.notification.count({
        where: { recipientUserId: payload.recipientUserId, readAt: null },
      });
      this.gateway.emitCreated(payload.recipientUserId, this.notifications.toPublic(notification), unreadCount);
      return;
    }
    if (event.eventType === 'EVENT_PROGRESS_UPDATED') {
      const payload = parseProgressPayload(event.payload);
      if (!payload) throw new Error('Invalid event progress outbox payload.');
      const members = await this.prisma.eventMember.findMany({
        where: { eventId: payload.recipientEventId, status: 'ACTIVE', user: { status: 'ACTIVE' } },
        select: { userId: true },
      });
      this.gateway.emitEventProgress(members.map((member) => member.userId), payload);
      return;
    }
    throw new Error('Unsupported outbox event type.');
  }

  private async reschedule(event: OutboxEvent, lockedAt: Date, error: unknown): Promise<void> {
    const maximumAttempts = this.config.getOrThrow<number>('NOTIFICATION_OUTBOX_MAX_ATTEMPTS');
    const lastError = sanitizeOutboxError(error);
    const failed = event.attempts >= maximumAttempts;
    const availableAt = failed ? event.availableAt : new Date(Date.now() + this.retryDelay(event.attempts));
    await this.prisma.outboxEvent.updateMany({
      where: { id: event.id, status: OutboxStatus.PROCESSING, lockedAt },
      data: {
        status: failed ? OutboxStatus.FAILED : OutboxStatus.PENDING,
        availableAt,
        lockedAt: null,
        lastError,
        ...(failed ? { processedAt: new Date() } : {}),
      },
    });
    this.logger.warn({
      event: failed ? 'notification.outbox_failed' : 'notification.outbox_retry',
      outboxEventId: event.id,
      requestId: null,
      attempts: event.attempts,
      reason: lastError,
    }, failed ? 'Notification outbox event failed permanently' : 'Notification outbox event will retry');
  }

  private retryDelay(attempts: number): number {
    return Math.min(RETRY_BASE_DELAY_MS * (2 ** Math.max(0, attempts - 1)), RETRY_MAX_DELAY_MS);
  }
}

function parseNotificationPayload(payload: Prisma.JsonValue): NotificationCreatedOutboxPayload | null {
  if (!isRecord(payload)) return null;
  if (payload.version !== 1 || typeof payload.notificationId !== 'string' || typeof payload.recipientUserId !== 'string') return null;
  return { version: 1, notificationId: payload.notificationId, recipientUserId: payload.recipientUserId };
}

function isRecord(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseProgressCount(value: Prisma.JsonValue | undefined): ProgressCount | null {
  if (!value || !isRecord(value)) return null;
  const { completed, total, percentage } = value;
  if (typeof completed !== 'number' || typeof total !== 'number' || typeof percentage !== 'number') return null;
  return { completed, total, percentage };
}

function parseStageProgress(value: Prisma.JsonValue | undefined): StageProgress | null {
  if (!value || !isRecord(value)) return null;
  const progress = parseProgressCount(value);
  if (!progress) return null;
  const { workflowStageId, code, name, order } = value;
  if (typeof workflowStageId !== 'string' || typeof code !== 'string' || typeof name !== 'string' || typeof order !== 'number') return null;
  return { workflowStageId, code, name, order, ...progress };
}

function parseProgressPayload(payload: Prisma.JsonValue): EventProgressUpdatedOutboxPayload | null {
  if (!isRecord(payload)) return null;
  const overall = parseProgressCount(payload.overall);
  const stage = parseStageProgress(payload.stage);
  const { version, eventId, recipientEventId, changedTaskId, updatedAt } = payload;
  if (version !== 1 || typeof eventId !== 'string' || typeof recipientEventId !== 'string'
    || typeof changedTaskId !== 'string' || typeof updatedAt !== 'string' || !overall || !stage) return null;
  return { version: 1, eventId, recipientEventId, changedTaskId, overall, stage, updatedAt };
}
