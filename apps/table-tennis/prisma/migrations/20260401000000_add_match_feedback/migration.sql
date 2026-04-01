-- CreateTable
CREATE TABLE "MatchFeedback" (
    "id" TEXT NOT NULL,
    "attendanceEventId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "feedback" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchFeedback_attendanceEventId_memberId_key" ON "MatchFeedback"("attendanceEventId", "memberId");

-- CreateIndex
CREATE INDEX "MatchFeedback_attendanceEventId_idx" ON "MatchFeedback"("attendanceEventId");

-- AddForeignKey
ALTER TABLE "MatchFeedback" ADD CONSTRAINT "MatchFeedback_attendanceEventId_fkey" FOREIGN KEY ("attendanceEventId") REFERENCES "AttendanceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchFeedback" ADD CONSTRAINT "MatchFeedback_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
