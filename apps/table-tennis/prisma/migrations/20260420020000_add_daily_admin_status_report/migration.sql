-- CreateTable
CREATE TABLE "DailyAdminStatusReport" (
    "id" TEXT NOT NULL,
    "reportDateKey" TEXT NOT NULL,
    "statusText" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyAdminStatusReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyAdminStatusReport_reportDateKey_key" ON "DailyAdminStatusReport"("reportDateKey");

-- CreateIndex
CREATE INDEX "DailyAdminStatusReport_sentAt_idx" ON "DailyAdminStatusReport"("sentAt");