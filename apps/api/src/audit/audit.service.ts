import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

export type AuditAction =
  | 'EVENT_CREATED'
  | 'EVENT_UPDATED'
  | 'EVENT_ARCHIVED'
  | 'EVENT_MEMBER_ADDED'
  | 'EVENT_MEMBER_ROLE_CHANGED'
  | 'EVENT_MEMBER_REMOVED'
  | 'EVENT_PERMISSION_GRANTED'
  | 'EVENT_PERMISSION_REVOKED'
  | 'EVENT_WORKFLOW_INITIALIZED'
  | 'EVENT_WORKFLOW_TEMPLATE_REPAIRED'
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_STAGE_CHANGED'
  | 'TASK_ASSIGNEES_CHANGED'
  | 'TASK_STATUS_CHANGED'
  | 'TASK_ARCHIVED'
  | 'TASK_ATTACHMENT_UPLOADED'
  | 'TASK_ATTACHMENT_DELETED';

interface AuditEntry {
  actorUserId: string | null;
  action: AuditAction;
  targetType: string;
  targetId: string;
  metadata?: Prisma.InputJsonValue;
}

type AuditClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class AuditService {
  async record(client: AuditClient, entry: AuditEntry): Promise<void> {
    await client.auditLog.create({
      data: {
        actorUserId: entry.actorUserId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        ...(entry.metadata === undefined ? {} : { metadata: entry.metadata }),
      },
    });
  }
}
