-- Add table for per-member table tennis notes.
CREATE TABLE IF NOT EXISTS "TableTennisNote" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "noteDateKey" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TableTennisNote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TableTennisNote_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "TableTennisNote_memberId_noteDateKey_key"
  ON "TableTennisNote"("memberId", "noteDateKey");

CREATE INDEX IF NOT EXISTS "TableTennisNote_memberId_noteDateKey_idx"
  ON "TableTennisNote"("memberId", "noteDateKey");
