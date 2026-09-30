CREATE TYPE "TaskOrigin" AS ENUM ('WORKFLOW_TEMPLATE', 'USER_CREATED');

ALTER TABLE "Event"
  ADD COLUMN "workflowTemplateVersion" TEXT,
  ADD COLUMN "workflowInitializedAt" TIMESTAMP(3);

ALTER TABLE "Task"
  ADD COLUMN "origin" "TaskOrigin" NOT NULL DEFAULT 'USER_CREATED',
  ADD COLUMN "templateKey" TEXT;

CREATE UNIQUE INDEX "Task_eventId_templateKey_key" ON "Task"("eventId", "templateKey");
CREATE INDEX "Task_eventId_workflowStageId_idx" ON "Task"("eventId", "workflowStageId");
CREATE INDEX "Task_eventId_origin_idx" ON "Task"("eventId", "origin");
CREATE INDEX "Task_workflowStageId_status_idx" ON "Task"("workflowStageId", "status");
