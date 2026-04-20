CREATE TABLE "ClubTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "deadlineOn" TIMESTAMP(3) NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdByMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClubTask_isCompleted_deadlineOn_idx" ON "ClubTask"("isCompleted", "deadlineOn");

ALTER TABLE "ClubTask"
ADD CONSTRAINT "ClubTask_createdByMemberId_fkey"
FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
