CREATE TYPE "EventDelegatedPermission" AS ENUM (
  'TASK_VIEW_ALL',
  'TASK_CREATE',
  'TASK_UPDATE_ANY',
  'TASK_ASSIGN',
  'TASK_UPDATE_STATUS_ANY',
  'TASK_ARCHIVE'
);

CREATE TYPE "NotificationType" AS ENUM (
  'TASK_ASSIGNED',
  'TASK_REASSIGNED',
  'TASK_UNASSIGNED',
  'EVENT_PERMISSION_GRANTED',
  'EVENT_PERMISSION_REVOKED'
);

CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');

ALTER TABLE "TaskAssignee" ADD COLUMN "assignmentEpisodeId" UUID;

-- Existing active assignments receive a stable episode before the column becomes required.
UPDATE "TaskAssignee"
SET "assignmentEpisodeId" = md5(
  "taskId"::text || ':' || "eventMemberId"::text || ':' || clock_timestamp()::text || ':' || random()::text
)::uuid;

ALTER TABLE "TaskAssignee" ALTER COLUMN "assignmentEpisodeId" SET NOT NULL;

CREATE TABLE "EventMemberPermissionGrant" (
  "id" UUID NOT NULL,
  "eventId" UUID NOT NULL,
  "granteeEventMemberId" UUID NOT NULL,
  "permission" "EventDelegatedPermission" NOT NULL,
  "grantedByEventMemberId" UUID NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokedByEventMemberId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventMemberPermissionGrant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventMemberPermissionGrant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "EventMemberPermissionGrant_granteeEventMemberId_fkey" FOREIGN KEY ("granteeEventMemberId") REFERENCES "EventMember"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "EventMemberPermissionGrant_grantedByEventMemberId_fkey" FOREIGN KEY ("grantedByEventMemberId") REFERENCES "EventMember"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "EventMemberPermissionGrant_revokedByEventMemberId_fkey" FOREIGN KEY ("revokedByEventMemberId") REFERENCES "EventMember"("id") ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE "Notification" (
  "id" UUID NOT NULL,
  "recipientUserId" UUID NOT NULL,
  "actorUserId" UUID,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "eventId" UUID,
  "taskId" UUID,
  "actionPath" TEXT NOT NULL,
  "deduplicationKey" TEXT NOT NULL,
  "payload" JSONB,
  "readAt" TIMESTAMP(3),
  "realtimePublishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Notification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "Notification_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "Notification_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "Notification_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE "NotificationPreference" (
  "userId" UUID NOT NULL,
  "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
  "soundEnabled" BOOLEAN NOT NULL DEFAULT true,
  "desktopEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE "OutboxEvent" (
  "id" UUID NOT NULL,
  "eventType" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" UUID NOT NULL,
  "payload" JSONB NOT NULL,
  "deduplicationKey" TEXT NOT NULL,
  "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaskAssignee_assignmentEpisodeId_key" ON "TaskAssignee"("assignmentEpisodeId");
CREATE UNIQUE INDEX "EventMemberPermissionGrant_eventId_granteeEventMemberId_permission_key"
  ON "EventMemberPermissionGrant"("eventId", "granteeEventMemberId", "permission");
CREATE UNIQUE INDEX "Notification_deduplicationKey_key" ON "Notification"("deduplicationKey");
CREATE UNIQUE INDEX "OutboxEvent_deduplicationKey_key" ON "OutboxEvent"("deduplicationKey");

CREATE INDEX "EventMemberPermissionGrant_eventId_idx" ON "EventMemberPermissionGrant"("eventId");
CREATE INDEX "EventMemberPermissionGrant_granteeEventMemberId_idx" ON "EventMemberPermissionGrant"("granteeEventMemberId");
CREATE INDEX "EventMemberPermissionGrant_permission_idx" ON "EventMemberPermissionGrant"("permission");
CREATE INDEX "EventMemberPermissionGrant_revokedAt_idx" ON "EventMemberPermissionGrant"("revokedAt");
CREATE INDEX "EventMemberPermissionGrant_expiresAt_idx" ON "EventMemberPermissionGrant"("expiresAt");
CREATE INDEX "Notification_recipientUserId_createdAt_idx" ON "Notification"("recipientUserId", "createdAt");
CREATE INDEX "Notification_recipientUserId_readAt_idx" ON "Notification"("recipientUserId", "readAt");
CREATE INDEX "Notification_eventId_idx" ON "Notification"("eventId");
CREATE INDEX "Notification_taskId_idx" ON "Notification"("taskId");
CREATE INDEX "Notification_type_idx" ON "Notification"("type");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");
CREATE INDEX "OutboxEvent_status_availableAt_idx" ON "OutboxEvent"("status", "availableAt");
CREATE INDEX "OutboxEvent_status_lockedAt_idx" ON "OutboxEvent"("status", "lockedAt");
CREATE INDEX "OutboxEvent_aggregateType_aggregateId_idx" ON "OutboxEvent"("aggregateType", "aggregateId");
