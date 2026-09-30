import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { Readable } from 'node:stream';
import type { TaskAttachment as TaskAttachmentContract } from '@eventflow/contracts';
import { EventStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { DomainException } from '../common/domain.exception';
import { EventAccessService } from '../events/event-access.service';
import { ObjectStorageService } from '../infrastructure/object-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { type UploadedAttachmentFile, validateAttachmentFile } from './file-validation';

interface AttachmentDownload {
  attachment: TaskAttachmentContract;
  stream: Readable;
}

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly access: EventAccessService,
    private readonly audit: AuditService,
  ) {}

  async upload(taskId: string, userId: string, file: UploadedAttachmentFile): Promise<TaskAttachmentContract> {
    validateAttachmentFile(file);
    const task = await this.findTask(taskId);
    const membership = await this.access.requireTaskView(task, userId);
    this.assertAttachmentMutationAllowed(task);
    const permissions = (await this.access.effectivePermissionsFor(membership)).effectivePermissions;
    const isAssignee = task.assignees.some((assignee) => assignee.eventMemberId === membership.id);
    if (!permissions.includes('attachment:upload:any') && !(isAssignee && permissions.includes('attachment:upload:assigned'))) {
      throw new DomainException(HttpStatus.FORBIDDEN, 'ATTACHMENT_UPLOAD_DENIED', 'Bạn không có quyền thêm tệp cho công việc này.');
    }
    const objectKey = `events/${task.eventId}/tasks/${task.id}/attachments/${randomUUID()}`;
    const originalFileName = safeFileName(file.originalname);
    await this.storage.putPrivateObject(objectKey, file.buffer, file.mimetype);
    try {
      const attachment = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.taskAttachment.create({
          data: { taskId, uploadedById: userId, objectKey, originalFileName, mimeType: file.mimetype, sizeBytes: file.size },
          include: { uploadedBy: { select: { id: true, displayName: true, email: true } } },
        });
        await this.audit.record(transaction, { actorUserId: userId, action: 'TASK_ATTACHMENT_UPLOADED', targetType: 'TaskAttachment', targetId: created.id, metadata: { taskId, mimeType: file.mimetype, sizeBytes: file.size } });
        return created;
      });
      return this.toContract(attachment, taskId);
    } catch (error: unknown) {
      await this.storage.deletePrivateObject(objectKey).catch(() => undefined);
      throw error;
    }
  }

  async download(taskId: string, attachmentId: string, userId: string): Promise<AttachmentDownload> {
    const attachment = await this.prisma.taskAttachment.findFirst({
      where: { id: attachmentId, taskId },
      include: {
        uploadedBy: { select: { id: true, displayName: true, email: true } },
        task: { include: { assignees: { select: { eventMemberId: true } } } },
      },
    });
    if (!attachment) throw new NotFoundException({ error: { code: 'ATTACHMENT_NOT_FOUND', message: 'Không tìm thấy tệp đính kèm.' } });
    await this.access.requireTaskView(attachment.task, userId);
    return { attachment: this.toContract(attachment, taskId), stream: await this.storage.getPrivateObject(attachment.objectKey) };
  }

  async remove(taskId: string, attachmentId: string, userId: string): Promise<void> {
    const attachment = await this.prisma.taskAttachment.findFirst({
      where: { id: attachmentId, taskId },
      include: {
        task: {
          include: {
            event: { select: { archivedAt: true, status: true } },
            assignees: { select: { eventMemberId: true } },
          },
        },
      },
    });
    if (!attachment) throw new NotFoundException({ error: { code: 'ATTACHMENT_NOT_FOUND', message: 'Không tìm thấy tệp đính kèm.' } });
    const membership = await this.access.requireTaskView(attachment.task, userId);
    this.assertAttachmentMutationAllowed(attachment.task);
    const permissions = (await this.access.effectivePermissionsFor(membership)).effectivePermissions;
    if (attachment.uploadedById !== userId && !permissions.includes('attachment:delete:any')) {
      throw new DomainException(HttpStatus.FORBIDDEN, 'ATTACHMENT_DELETE_DENIED', 'Bạn không có quyền xóa tệp này.');
    }
    if (attachment.uploadedById === userId && !permissions.includes('attachment:delete:own') && !permissions.includes('attachment:delete:any')) {
      throw new DomainException(HttpStatus.FORBIDDEN, 'ATTACHMENT_DELETE_DENIED', 'Bạn không có quyền xóa tệp này.');
    }
    // A database rollback must not leave metadata pointing at an object that
    // has already been removed. Attachments are capped at 10 MB, so retaining
    // a buffer for this short compensation window is bounded and safe.
    const objectBody = await streamToBuffer(await this.storage.getPrivateObject(attachment.objectKey));
    let objectDeleted = false;
    let objectRestored = false;
    try {
      await this.prisma.$transaction(async (transaction) => {
        // Keep concurrent deletes from restoring an object after another
        // request successfully removed its metadata.
        const lockedRows = await transaction.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "TaskAttachment" WHERE "id" = CAST(${attachment.id} AS uuid) FOR UPDATE`,
        );
        if (lockedRows.length === 0) {
          throw new NotFoundException({ error: { code: 'ATTACHMENT_NOT_FOUND', message: 'Không tìm thấy tệp đính kèm.' } });
        }
        try {
          await this.storage.deletePrivateObject(attachment.objectKey);
          objectDeleted = true;
          await transaction.taskAttachment.delete({ where: { id: attachment.id } });
          await this.audit.record(transaction, { actorUserId: userId, action: 'TASK_ATTACHMENT_DELETED', targetType: 'TaskAttachment', targetId: attachment.id, metadata: { taskId } });
        } catch (error: unknown) {
          if (objectDeleted) {
            objectRestored = await this.restoreObject(attachment.objectKey, objectBody, attachment.mimeType);
          }
          throw error;
        }
      });
    } catch (error: unknown) {
      // A transaction commit can fail after the callback has returned. Lock the
      // metadata row before compensating so a concurrent successful delete wins.
      if (objectDeleted && !objectRestored) {
        await this.restoreObjectIfMetadataExists(attachment.id, attachment.objectKey, objectBody, attachment.mimeType);
      }
      throw error;
    }
  }

  private async findTask(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        event: { select: { archivedAt: true, status: true } },
        assignees: { select: { eventMemberId: true } },
      },
    });
    if (!task) throw new NotFoundException({ error: { code: 'TASK_NOT_FOUND', message: 'Không tìm thấy công việc.' } });
    return task;
  }

  private assertAttachmentMutationAllowed(task: { archivedAt: Date | null; event: { archivedAt: Date | null; status: EventStatus } }): void {
    if (task.archivedAt) {
      throw new DomainException(HttpStatus.CONFLICT, 'TASK_ARCHIVED', 'Không thể thay đổi tệp của công việc đã lưu trữ.');
    }
    if (task.event.archivedAt || task.event.status === EventStatus.ARCHIVED) {
      throw new DomainException(HttpStatus.CONFLICT, 'EVENT_ARCHIVED', 'Không thể thay đổi tệp của sự kiện đã lưu trữ.');
    }
  }

  private async restoreObject(objectKey: string, body: Buffer, mimeType: string): Promise<boolean> {
    try {
      await this.storage.putPrivateObject(objectKey, body, mimeType);
      return true;
    } catch {
      return false;
    }
  }

  private async restoreObjectIfMetadataExists(attachmentId: string, objectKey: string, body: Buffer, mimeType: string): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const lockedRows = await transaction.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "TaskAttachment" WHERE "id" = CAST(${attachmentId} AS uuid) FOR UPDATE`,
      );
      if (lockedRows.length > 0) await this.restoreObject(objectKey, body, mimeType);
    }).catch(() => undefined);
  }

  private toContract(attachment: { id: string; originalFileName: string; mimeType: string; sizeBytes: number; createdAt: Date; uploadedBy: { id: string; displayName: string | null; email: string } }, taskId: string): TaskAttachmentContract {
    return {
      id: attachment.id,
      originalFileName: attachment.originalFileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      uploadedBy: { userId: attachment.uploadedBy.id, displayName: attachment.uploadedBy.displayName, email: attachment.uploadedBy.email },
      createdAt: attachment.createdAt.toISOString(),
      downloadPath: `/api/v1/tasks/${taskId}/attachments/${attachment.id}/download`,
    };
  }
}

function safeFileName(value: string): string {
  const normalized = Array.from(basename(value)).filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127).join('').trim();
  return normalized.slice(0, 255) || 'attachment';
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
