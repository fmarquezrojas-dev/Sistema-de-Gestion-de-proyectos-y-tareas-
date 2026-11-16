ALTER TABLE "tasks" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "activity_logs"
  ADD COLUMN "previousVersion" INTEGER,
  ADD COLUMN "resultingVersion" INTEGER,
  ADD COLUMN "changes" JSONB,
  ADD COLUMN "actorName" TEXT,
  ADD COLUMN "reason" TEXT;
CREATE INDEX "activity_logs_taskId_createdAt_id_idx" ON "activity_logs"("taskId", "createdAt", "id");
