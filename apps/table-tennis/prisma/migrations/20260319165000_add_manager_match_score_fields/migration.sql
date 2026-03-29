-- AlterTable
ALTER TABLE "MatchRecord"
ADD COLUMN "attendanceEventId" TEXT;

-- AlterTable
ALTER TABLE "PlayerMatchScore"
ADD COLUMN "shotAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "isGoalkeeper" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "MatchRecord_attendanceEventId_idx" ON "MatchRecord"("attendanceEventId");

-- AddForeignKey
ALTER TABLE "MatchRecord"
ADD CONSTRAINT "MatchRecord_attendanceEventId_fkey"
FOREIGN KEY ("attendanceEventId") REFERENCES "AttendanceEvent"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
