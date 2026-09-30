import { Injectable } from '@nestjs/common';
import { NotificationType, OutboxStatus, Prisma } from '@prisma/client';
import type { NotificationCreatedOutboxPayload } from '@eventflow/contracts';
import { assertInternalActionPath, buildTaskActionPath } from './notification-path';
import { sanitizeNotificationText, taskAssignedContent } from './notification-content';

export interface AssignmentNotificationRecipient {
  userId: string;
  assignmentEpisodeId: string;
}

export interface CreateTaskAssignmentNotificationsInput {
  eventId: string;
  eventName: string;
  taskId: string;
  taskTitle: string;
  actorUserId: string;
  actorDisplayName: string | null;
  recipients: AssignmentNotificationRecipient[];
}

export interface CreatePermissionNotificationInput {
  eventId: string;
  recipientUserId: string;
  actorUserId: string;
  eventName: string;
  granted: boolean;
  permissionLabel: string;
  /** Stable grant revision or audit id, never a clock-only value. */
  changeId: string;
}

/**
 * Transactional producer for durable user notifications and their outbox rows.
 * It intentionally does not send Socket.IO messages: callers use it inside the
 * same transaction as the business mutation, while OutboxDispatcher sends only
 * after PostgreSQL commits.
 */
@Injectable()
export class NotificationFactory {
  async createTaskAssignmentNotifications(
    transaction: Prisma.TransactionClient,
    input: CreateTaskAssignmentNotificationsInput,
  ): Promise<void> {
    const actionPath = buildTaskActionPath(input.eventId, input.taskId);
    const content = taskAssignedContent({
      actorName: input.actorDisplayName ?? 'Một thành viên',
      taskTitle: input.taskTitle,
      eventName: input.eventName,
    });
    const uniqueRecipients = this.uniqueRecipients(input.recipients, input.actorUserId);
    await Promise.all(uniqueRecipients.map(async (recipient) => {
      const deduplicationKey = `task-assigned:${input.taskId}:${recipient.userId}:${recipient.assignmentEpisodeId}`;
      await this.createWithOutbox(transaction, {
        recipientUserId: recipient.userId,
        actorUserId: input.actorUserId,
        type: NotificationType.TASK_ASSIGNED,
        title: content.title,
        body: content.body,
        eventId: input.eventId,
        taskId: input.taskId,
        actionPath,
        deduplicationKey,
        payload: { taskId: input.taskId, eventId: input.eventId },
      });
    }));
  }

  async createPermissionChangedNotification(
    transaction: Prisma.TransactionClient,
    input: CreatePermissionNotificationInput,
  ): Promise<void> {
    if (input.recipientUserId === input.actorUserId) return;
    const permission = sanitizeNotificationText(input.permissionLabel, 80);
    const eventName = sanitizeNotificationText(input.eventName, 180) || 'sự kiện';
    const type = input.granted ? NotificationType.EVENT_PERMISSION_GRANTED : NotificationType.EVENT_PERMISSION_REVOKED;
    const actionPath = assertInternalActionPath(`/app/events/${input.eventId}/members`);
    const title = input.granted ? 'Bạn được cấp quyền quản lý công việc' : 'Quyền quản lý công việc đã thay đổi';
    const body = input.granted
      ? `Bạn đã được cấp quyền ${permission} trong sự kiện “${eventName}”.`
      : `Quyền ${permission} của bạn trong sự kiện “${eventName}” đã được thu hồi.`;
    await this.createWithOutbox(transaction, {
      recipientUserId: input.recipientUserId,
      actorUserId: input.actorUserId,
      type,
      title,
      body,
      eventId: input.eventId,
      taskId: null,
      actionPath,
      deduplicationKey: `event-permission:${input.eventId}:${input.recipientUserId}:${permission}:${input.granted ? 'granted' : 'revoked'}:${input.changeId}`,
      payload: { eventId: input.eventId, permission, granted: input.granted },
    });
  }

  private async createWithOutbox(
    transaction: Prisma.TransactionClient,
    input: {
      recipientUserId: string;
      actorUserId: string | null;
      type: NotificationType;
      title: string;
      body: string;
      eventId: string | null;
      taskId: string | null;
      actionPath: string;
      deduplicationKey: string;
      payload: Prisma.InputJsonObject;
    },
  ): Promise<void> {
    const notification = await transaction.notification.upsert({
      where: { deduplicationKey: input.deduplicationKey },
      create: {
        recipientUserId: input.recipientUserId,
        actorUserId: input.actorUserId,
        type: input.type,
        title: sanitizeNotificationText(input.title, 180),
        body: sanitizeNotificationText(input.body, 600),
        eventId: input.eventId,
        taskId: input.taskId,
        actionPath: assertInternalActionPath(input.actionPath),
        deduplicationKey: input.deduplicationKey,
        payload: input.payload,
      },
      update: {},
    });
    const payload: Prisma.InputJsonObject = {
      version: 1,
      notificationId: notification.id,
      recipientUserId: notification.recipientUserId,
    } satisfies NotificationCreatedOutboxPayload;
    await transaction.outboxEvent.upsert({
      where: { deduplicationKey: `notification-created:${notification.id}` },
      create: {
        eventType: 'NOTIFICATION_CREATED',
        aggregateType: 'Notification',
        aggregateId: notification.id,
        payload,
        deduplicationKey: `notification-created:${notification.id}`,
        status: OutboxStatus.PENDING,
      },
      update: {},
    });
  }

  private uniqueRecipients(recipients: AssignmentNotificationRecipient[], actorUserId: string): AssignmentNotificationRecipient[] {
    const seen = new Set<string>();
    return recipients.filter((recipient) => {
      if (recipient.userId === actorUserId || seen.has(recipient.userId)) return false;
      seen.add(recipient.userId);
      return true;
    });
  }
}
