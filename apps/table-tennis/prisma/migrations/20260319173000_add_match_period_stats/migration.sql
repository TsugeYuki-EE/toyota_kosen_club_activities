-- CreateEnum
CREATE TYPE "MatchPeriod" AS ENUM ('FIRST_HALF', 'SECOND_HALF');

-- CreateTable
CREATE TABLE "MatchPeriodScore" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "period" "MatchPeriod" NOT NULL,
    "ourScore" INTEGER NOT NULL DEFAULT 0,
    "theirScore" INTEGER NOT NULL DEFAULT 0,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchPeriodScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerMatchPeriodStat" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "period" "MatchPeriod" NOT NULL,
    "shotAttempts" INTEGER NOT NULL DEFAULT 0,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "isGoalkeeper" BOOLEAN NOT NULL DEFAULT false,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerMatchPeriodStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchPeriodScore_matchId_period_key" ON "MatchPeriodScore"("matchId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerMatchPeriodStat_matchId_memberId_period_key" ON "PlayerMatchPeriodStat"("matchId", "memberId", "period");

-- CreateIndex
CREATE INDEX "PlayerMatchPeriodStat_matchId_period_idx" ON "PlayerMatchPeriodStat"("matchId", "period");

-- AddForeignKey
ALTER TABLE "MatchPeriodScore" ADD CONSTRAINT "MatchPeriodScore_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "MatchRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerMatchPeriodStat" ADD CONSTRAINT "PlayerMatchPeriodStat_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "MatchRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerMatchPeriodStat" ADD CONSTRAINT "PlayerMatchPeriodStat_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
