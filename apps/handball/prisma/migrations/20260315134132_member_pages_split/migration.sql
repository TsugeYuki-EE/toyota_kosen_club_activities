-- CreateTable
CREATE TABLE "PracticeMenu" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "practiceDate" TIMESTAMP(3) NOT NULL,
    "menuText" TEXT NOT NULL,
    "detail" TEXT,
    "createdByMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PracticeMenu_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerMatchScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerMatchScore_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerMatchScore_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "MatchRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerMatchScore_memberId_matchId_key" ON "PlayerMatchScore"("memberId", "matchId");
