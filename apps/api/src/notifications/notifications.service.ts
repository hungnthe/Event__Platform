import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainException } from '../common/domain.exception';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import type { NotificationsQueryDto, UpdateNotificationPreferencesDto } from './dto/notifications.dto';
import { sanitizeNotificationText } from './notification-content';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

type NotificationRecord = Prisma.NotificationGetPayload<Record<string, never>>;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService, private readonly gateway: NotificationsGateway) {}

  async list(userId: string, query: NotificationsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const where: Prisma.NotificationWhereInput = {
      recipientUserId: userId,
      ...(query.unreadOnly ? { readAt: null } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.eventId ? { eventId: query.eventId } : {}),
    };
    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: query.sortDirection ?? 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { recipientUserId: userId, readAt: null } }),
    ]);
    return {
      items: items.map((notification) => this.toPublic(notification)),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      unreadCount,
    };
  }

  async unreadCount(userId: string): Promise<{ unreadCount: number }> {
    return { unreadCount: await this.prisma.notification.count({ where: { recipientUserId: userId, readAt: null } }) };
  }

  async markRead(userId: string, notificationId: string) {
    const result = await this.prisma.$transaction(async (transaction) => {
      const notification = await transaction.notification.findUnique({ where: { id: notificationId } });
      if (!notification) {
        throw new DomainException(HttpStatus.NOT_FOUND, 'NOTIFICATION_NOT_FOUND', 'Không tìm thấy thông báo.');
      }
      if (notification.recipientUserId !== userId) {
        throw new DomainException(HttpStatus.FORBIDDEN, 'NOTIFICATION_FORBIDDEN', 'Bạn không có quyền cập nhật thông báo này.');
      }
      if (!notification.readAt) {
        await transaction.notification.updateMany({
          where: { id: notification.id, recipientUserId: userId, readAt: null },
          data: { readAt: new Date() },
        });
      }
      const updated = await transaction.notification.findUnique({ where: { id: notification.id } });
      if (!updated || !updated.readAt) {
        throw new DomainException(HttpStatus.NOT_FOUND, 'NOTIFICATION_NOT_FOUND', 'Không tìm thấy thông báo.');
      }
      const unreadCount = await transaction.notification.count({ where: { recipientUserId: userId, readAt: null } });
      return { notification: updated, unreadCount, readAt: updated.readAt };
    });
    this.gateway.emitRead(userId, result.notification.id, result.readAt, result.unreadCount);
    return { notification: this.toPublic(result.notification), unreadCount: result.unreadCount };
  }

  async markAllRead(userId: string): Promise<{ readAt: string; unreadCount: number }> {
    const readAt = new Date();
    const result = await this.prisma.$transaction(async (transaction) => {
      await transaction.notification.updateMany({ where: { recipientUserId: userId, readAt: null }, data: { readAt } });
      const unreadCount = await transaction.notification.count({ where: { recipientUserId: userId, readAt: null } });
      return { unreadCount };
    });
    this.gateway.emitReadAll(userId, readAt, result.unreadCount);
    return { readAt: readAt.toISOString(), unreadCount: result.unreadCount };
  }

  async preferences(userId: string) {
    const preference = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    return this.toPreference(preference);
  }

  async updatePreferences(userId: string, dto: UpdateNotificationPreferencesDto) {
    const preference = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, soundEnabled: dto.soundEnabled ?? true, desktopEnabled: dto.desktopEnabled ?? false },
      update: {
        ...(dto.soundEnabled === undefined ? {} : { soundEnabled: dto.soundEnabled }),
        ...(dto.desktopEnabled === undefined ? {} : { desktopEnabled: dto.desktopEnabled }),
      },
    });
    return this.toPreference(preference);
  }

  toPublic(notification: NotificationRecord) {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      eventId: notification.eventId,
      taskId: notification.taskId,
      actionPath: notification.actionPath,
      payload: this.publicPayload(notification.payload),
      readAt: notification.readAt ? notification.readAt.toISOString() : null,
      createdAt: notification.createdAt.toISOString(),
    };
  }

  private toPreference(preference: { inAppEnabled: boolean; soundEnabled: boolean; desktopEnabled: boolean }) {
    return {
      inAppEnabled: preference.inAppEnabled,
      soundEnabled: preference.soundEnabled,
      desktopEnabled: preference.desktopEnabled,
    };
  }

  private publicPayload(value: Prisma.JsonValue | null): Record<string, string | number | boolean | null> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const sanitized: Record<string, string | number | boolean | null> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry === null || typeof entry === 'boolean') {
        sanitized[key] = entry;
      } else if (typeof entry === 'number' && Number.isFinite(entry)) {
        sanitized[key] = entry;
      } else if (typeof entry === 'string') {
        sanitized[key] = sanitizeNotificationText(entry, 180);
      }
    }
    return Object.keys(sanitized).length > 0 ? sanitized : null;
  }
}
