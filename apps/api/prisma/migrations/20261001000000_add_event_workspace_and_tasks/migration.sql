CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'UPCOMING', 'ONGOING', 'ENDED', 'ARCHIVED');
CREATE TYPE "EventMemberRole" AS ENUM ('OWNER', 'COORDINATOR', 'DEPARTMENT_LEAD', 'MEMBER', 'VOLUNTEER', 'GUEST');
CREATE TYPE "EventMemberStatus" AS ENUM ('ACTIVE', 'REMOVED');
CREATE TYPE "TaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE', 'CANCELLED');
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

CREATE TABLE "Event" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "locationName" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
  "coverStorageKey" TEXT,
  "createdById" UUID NOT NULL,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Event_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE "Department" (
  "id" UUID NOT NULL,
  "eventId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Department_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Department_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE "WorkflowStage" (
  "id" UUID NOT NULL,
  "eventId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowStage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkflowStage_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE "EventMember" (
  "id" UUID NOT NULL,
  "eventId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "role" "EventMemberRole" NOT NULL,
  "status" "EventMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "departmentId" UUID,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventMember_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventMember_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "EventMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "EventMember_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE "Task" (
  "id" UUID NOT NULL,
  "eventId" UUID NOT NULL,
  "workflowStageId" UUID NOT NULL,
  "departmentId" UUID,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "TaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
  "dueAt" TIMESTAMP(3) NOT NULL,
  "createdById" UUID NOT NULL,
  "assignedById" UUID NOT NULL,
  "completedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Task_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Task_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "Task_workflowStageId_fkey" FOREIGN KEY ("workflowStageId") REFERENCES "WorkflowStage"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "Task_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "Task_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE "TaskAssignee" (
  "taskId" UUID NOT NULL,
  "eventMemberId" UUID NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("taskId", "eventMemberId"),
  CONSTRAINT "TaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "TaskAssignee_eventMemberId_fkey" FOREIGN KEY ("eventMemberId") REFERENCES "EventMember"("id") ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE "TaskAttachment" (
  "id" UUID NOT NULL,
  "taskId" UUID NOT NULL,
  "uploadedById" UUID NOT NULL,
  "objectKey" TEXT NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskAttachment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaskAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "TaskAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE "AuditLog" (
  "id" UUID NOT NULL,
  "actorUserId" UUID,
  "action" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "metadata" JSONB,
  "requestId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE UNIQUE INDEX "Department_eventId_name_key" ON "Department"("eventId", "name");
CREATE UNIQUE INDEX "WorkflowStage_eventId_code_key" ON "WorkflowStage"("eventId", "code");
CREATE UNIQUE INDEX "WorkflowStage_eventId_order_key" ON "WorkflowStage"("eventId", "order");
CREATE UNIQUE INDEX "EventMember_eventId_userId_key" ON "EventMember"("eventId", "userId");
CREATE UNIQUE INDEX "TaskAttachment_objectKey_key" ON "TaskAttachment"("objectKey");
CREATE INDEX "Event_createdById_idx" ON "Event"("createdById");
CREATE INDEX "Event_status_startsAt_idx" ON "Event"("status", "startsAt");
CREATE INDEX "Department_eventId_idx" ON "Department"("eventId");
CREATE INDEX "WorkflowStage_eventId_idx" ON "WorkflowStage"("eventId");
CREATE INDEX "EventMember_userId_status_idx" ON "EventMember"("userId", "status");
CREATE INDEX "EventMember_eventId_status_role_idx" ON "EventMember"("eventId", "status", "role");
CREATE INDEX "EventMember_departmentId_idx" ON "EventMember"("departmentId");
CREATE INDEX "Task_eventId_archivedAt_dueAt_idx" ON "Task"("eventId", "archivedAt", "dueAt");
CREATE INDEX "Task_eventId_status_idx" ON "Task"("eventId", "status");
CREATE INDEX "Task_workflowStageId_idx" ON "Task"("workflowStageId");
CREATE INDEX "Task_departmentId_idx" ON "Task"("departmentId");
CREATE INDEX "TaskAssignee_eventMemberId_idx" ON "TaskAssignee"("eventMemberId");
CREATE INDEX "TaskAttachment_taskId_idx" ON "TaskAttachment"("taskId");
CREATE INDEX "TaskAttachment_uploadedById_idx" ON "TaskAttachment"("uploadedById");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");
CREATE INDEX "AuditLog_targetId_idx" ON "AuditLog"("targetId");
