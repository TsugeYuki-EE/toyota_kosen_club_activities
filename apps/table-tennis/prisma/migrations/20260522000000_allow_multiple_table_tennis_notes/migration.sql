-- Allow multiple table tennis notes per member and date.
DROP INDEX IF EXISTS "TableTennisNote_memberId_noteDateKey_key";

CREATE INDEX IF NOT EXISTS "TableTennisNote_memberId_createdAt_idx"
  ON "TableTennisNote"("memberId", "createdAt");
