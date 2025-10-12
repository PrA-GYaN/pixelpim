-- CreateTable
CREATE TABLE "public"."ScheduledImport" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "cronExpression" TEXT NOT NULL,
    "csvUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRun" TIMESTAMP(3),
    "nextRun" TIMESTAMP(3),
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ImportExecutionLog" (
    "id" SERIAL NOT NULL,
    "scheduledImportId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "itemsProcessed" INTEGER NOT NULL DEFAULT 0,
    "itemsImported" INTEGER NOT NULL DEFAULT 0,
    "itemsFailed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "errorDetails" JSONB,
    "executionSummary" JSONB,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledImport_userId_status_idx" ON "public"."ScheduledImport"("userId", "status");

-- CreateIndex
CREATE INDEX "ScheduledImport_isActive_nextRun_idx" ON "public"."ScheduledImport"("isActive", "nextRun");

-- CreateIndex
CREATE INDEX "ImportExecutionLog_scheduledImportId_createdAt_idx" ON "public"."ImportExecutionLog"("scheduledImportId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportExecutionLog_userId_status_idx" ON "public"."ImportExecutionLog"("userId", "status");

-- CreateIndex
CREATE INDEX "ImportExecutionLog_startTime_idx" ON "public"."ImportExecutionLog"("startTime");

-- AddForeignKey
ALTER TABLE "public"."ScheduledImport" ADD CONSTRAINT "ScheduledImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImportExecutionLog" ADD CONSTRAINT "ImportExecutionLog_scheduledImportId_fkey" FOREIGN KEY ("scheduledImportId") REFERENCES "public"."ScheduledImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImportExecutionLog" ADD CONSTRAINT "ImportExecutionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
