ALTER TABLE "tasks" ADD COLUMN "assignmentVersion" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "notification_jobs" (
 "id" UUID NOT NULL PRIMARY KEY, "kind" TEXT NOT NULL,
 "taskId" INTEGER NOT NULL, "projectId" INTEGER NOT NULL, "recipientId" INTEGER NOT NULL,
 "assignmentVersion" INTEGER, "dueDate" TIMESTAMP(3), "dedupeKey" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'pending', "attempts" INTEGER NOT NULL DEFAULT 0,
 "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "claimToken" UUID, "leaseUntil" TIMESTAMP(3), "sendingAt" TIMESTAMP(3), "acceptedAt" TIMESTAMP(3),
 "result" TEXT, "diagnostic" TEXT, "resolutionReason" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "notification_status" CHECK ("status" IN ('pending','processing','sent','failed','unknown','cancelled')),
 CONSTRAINT "notification_kind" CHECK ("kind" IN ('assigned','due_soon','overdue'))
);
CREATE UNIQUE INDEX "notification_jobs_dedupeKey_key" ON "notification_jobs"("dedupeKey");
CREATE INDEX "notification_jobs_status_nextAttemptAt_id_idx" ON "notification_jobs"("status","nextAttemptAt","id");
