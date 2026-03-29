CREATE TABLE "MatchPeriodIncident" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "period" "MatchPeriod" NOT NULL,
  "team" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "minute" INTEGER NOT NULL,
  "playerName" TEXT,
  "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MatchPeriodIncident_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MatchPeriodIncident_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "MatchRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MatchPeriodIncident_team_check" CHECK ("team" IN ('OUR', 'OPPONENT')),
  CONSTRAINT "MatchPeriodIncident_kind_check" CHECK ("kind" IN ('TWO_MIN', 'YELLOW'))
);

CREATE INDEX "MatchPeriodIncident_matchId_period_idx"
  ON "MatchPeriodIncident"("matchId", "period");
