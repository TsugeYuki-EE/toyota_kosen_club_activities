CREATE TABLE "MatchScoreDraft" (
  "id" TEXT NOT NULL,
  "attendanceEventId" TEXT NOT NULL,
  "draftJson" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MatchScoreDraft_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MatchScoreDraft_attendanceEventId_fkey" FOREIGN KEY ("attendanceEventId") REFERENCES "AttendanceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MatchScoreDraft_attendanceEventId_key"
  ON "MatchScoreDraft"("attendanceEventId");
