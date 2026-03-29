ALTER TABLE "AttendanceEvent"
    ADD COLUMN "eventType" TEXT NOT NULL DEFAULT 'PRACTICE',
    ADD COLUMN "matchOpponent" TEXT,
    ADD COLUMN "matchDetail" TEXT;
