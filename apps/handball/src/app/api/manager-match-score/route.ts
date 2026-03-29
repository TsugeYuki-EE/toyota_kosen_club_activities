import { NextRequest, NextResponse } from "next/server";
import { AttendanceEventType, Prisma } from "@prisma/client";
import { getAuthorizedAdminMember } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";

type MatchPeriod = "FIRST_HALF" | "SECOND_HALF";

type InitPayload = {
  intent: "init";
  attendanceEventId: string;
  selectedMemberIds: string[];
  goalkeeperMemberIds: string[];
};

type SavePeriodPayload = {
  intent: "savePeriod";
  attendanceEventId: string;
  period: MatchPeriod;
  ourScore: number;
  theirScore: number;
  teamStats: {
    quickAttempts: number;
    quickSuccesses: number;
    leftAttempts: number;
    leftSuccesses: number;
    centerAttempts: number;
    centerSuccesses: number;
    pivotAttempts: number;
    pivotSuccesses: number;
    reboundAttempts: number;
    reboundSuccesses: number;
    sevenMeterAttempts: number;
    sevenMeterSuccesses: number;
  };
  playerStats: Array<{
    memberId: string;
    shotAttempts: number;
    goals: number;
    isGoalkeeper: boolean;
  }>;
  incidents?: Array<{
    team: "OUR" | "OPPONENT";
    kind: "TWO_MIN" | "YELLOW";
    minute: number;
    playerName: string | null;
  }>;
};

type SaveDraftPayload = {
  intent: "saveDraft";
  attendanceEventId: string;
  draft: unknown;
};

type ClearDraftPayload = {
  intent: "clearDraft";
  attendanceEventId: string;
};

type DeleteMatchPayload = {
  intent: "deleteMatch";
  attendanceEventId: string;
};

type Payload = InitPayload | SavePeriodPayload | DeleteMatchPayload | SaveDraftPayload | ClearDraftPayload;

type MatchRow = {
  id: string;
  opponent: string;
  matchDate: Date;
  ourScore: number;
  theirScore: number;
};

type PlayerScoreRow = {
  id: string;
  memberId: string;
  goals: number;
  shotAttempts: number;
  isGoalkeeper: boolean;
};

type PeriodScoreRow = {
  period: MatchPeriod;
  ourScore: number;
  theirScore: number;
  quickCount: number;
  quickSuccessCount: number;
  leftCount: number;
  leftSuccessCount: number;
  centerCount: number;
  centerSuccessCount: number;
  pivotCount: number;
  pivotSuccessCount: number;
  reboundCount: number;
  reboundSuccessCount: number;
  sevenMeterCount: number;
  sevenMeterSuccessCount: number;
};

type PeriodPlayerRow = {
  period: MatchPeriod;
  memberId: string;
  goals: number;
  shotAttempts: number;
  isGoalkeeper: boolean;
};

type PeriodIncidentRow = {
  id: string;
  period: MatchPeriod;
  team: "OUR" | "OPPONENT";
  kind: "TWO_MIN" | "YELLOW";
  minute: number;
  playerName: string | null;
};

type MatchScoreDraftRow = {
  draftJson: unknown;
  updatedAt: Date;
};

type LegacyPeriodScoreRow = {
  period: MatchPeriod;
  ourScore: number;
  theirScore: number;
};

type QueryClient = Prisma.TransactionClient | typeof prisma;

let hasTeamStatsColumnsCache: boolean | null = null;
let hasTeamStatsSuccessColumnsCache: boolean | null = null;
let hasPeriodIncidentTableCache: boolean | null = null;
let hasMatchScoreDraftTableCache: boolean | null = null;

// キャッシュをリセット（新しい migration 適用時等）
export function resetTableCache() {
  hasPeriodIncidentTableCache = null;
  hasMatchScoreDraftTableCache = null;
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return value < 0 ? 0 : Math.floor(value);
}

async function hasTeamStatsColumns(db: QueryClient): Promise<boolean> {
  if (hasTeamStatsColumnsCache !== null) {
    return hasTeamStatsColumnsCache;
  }

  const rows = await db.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'MatchPeriodScore'
        AND column_name = 'quickCount'
    ) AS "exists"
  `;

  hasTeamStatsColumnsCache = Boolean(rows[0]?.exists);
  return hasTeamStatsColumnsCache;
}

async function fetchPeriodScores(db: QueryClient, matchId: string): Promise<PeriodScoreRow[]> {
  const hasAttempts = await hasTeamStatsColumns(db);
  const hasSuccesses = await hasTeamStatsSuccessColumns(db);

  if (hasAttempts && hasSuccesses) {
    return db.$queryRaw<PeriodScoreRow[]>`
      SELECT "period", "ourScore", "theirScore", "quickCount", "quickSuccessCount", "leftCount", "leftSuccessCount", "centerCount", "centerSuccessCount", "pivotCount", "pivotSuccessCount", "reboundCount", "reboundSuccessCount", "sevenMeterCount", "sevenMeterSuccessCount"
      FROM "MatchPeriodScore"
      WHERE "matchId" = ${matchId}
    `;
  }

  if (hasAttempts) {
    const attemptOnlyRows = await db.$queryRaw<Array<{
      period: MatchPeriod;
      ourScore: number;
      theirScore: number;
      quickCount: number;
      leftCount: number;
      centerCount: number;
      pivotCount: number;
      reboundCount: number;
      sevenMeterCount: number;
    }>>`
      SELECT "period", "ourScore", "theirScore", "quickCount", "leftCount", "centerCount", "pivotCount", "reboundCount", "sevenMeterCount"
      FROM "MatchPeriodScore"
      WHERE "matchId" = ${matchId}
    `;

    return attemptOnlyRows.map((row) => ({
      ...row,
      quickSuccessCount: 0,
      leftSuccessCount: 0,
      centerSuccessCount: 0,
      pivotSuccessCount: 0,
      reboundSuccessCount: 0,
      sevenMeterSuccessCount: 0,
    }));
  }

  const legacyRows = await db.$queryRaw<LegacyPeriodScoreRow[]>`
    SELECT "period", "ourScore", "theirScore"
    FROM "MatchPeriodScore"
    WHERE "matchId" = ${matchId}
  `;

  return legacyRows.map((row) => ({
    ...row,
    quickCount: 0,
    quickSuccessCount: 0,
    leftCount: 0,
    leftSuccessCount: 0,
    centerCount: 0,
    centerSuccessCount: 0,
    pivotCount: 0,
    pivotSuccessCount: 0,
    reboundCount: 0,
    reboundSuccessCount: 0,
    sevenMeterCount: 0,
    sevenMeterSuccessCount: 0,
  }));
}

async function fetchPeriodIncidents(db: QueryClient, matchId: string): Promise<PeriodIncidentRow[]> {
  const tableExists = await hasPeriodIncidentTable(db);
  if (!tableExists) {
    return [];
  }

  return db.$queryRaw<PeriodIncidentRow[]>`
    SELECT "id", "period", "team", "kind", "minute", "playerName"
    FROM "MatchPeriodIncident"
    WHERE "matchId" = ${matchId}
    ORDER BY "period" ASC, "minute" ASC, "savedAt" ASC
  `;
}

async function hasPeriodIncidentTable(db: QueryClient): Promise<boolean> {
  if (hasPeriodIncidentTableCache !== null) {
    return hasPeriodIncidentTableCache;
  }

  try {
    const rows = await db.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'MatchPeriodIncident'
      ) AS "exists"
    `;

    hasPeriodIncidentTableCache = Boolean(rows[0]?.exists);
    console.log("[hasPeriodIncidentTable] Cache set to:", hasPeriodIncidentTableCache);
    return hasPeriodIncidentTableCache;
  } catch (error) {
    console.error("[hasPeriodIncidentTable] Error checking table:", error);
    return false;
  }
}

async function hasMatchScoreDraftTable(db: QueryClient): Promise<boolean> {
  if (hasMatchScoreDraftTableCache !== null) {
    return hasMatchScoreDraftTableCache;
  }

  try {
    const rows = await db.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'MatchScoreDraft'
      ) AS "exists"
    `;

    hasMatchScoreDraftTableCache = Boolean(rows[0]?.exists);
    console.log("[hasMatchScoreDraftTable] Cache set to:", hasMatchScoreDraftTableCache);
    return hasMatchScoreDraftTableCache;
  } catch (error) {
    console.error("[hasMatchScoreDraftTable] Error checking table:", error);
    return false;
  }
}

async function fetchMatchDraft(db: QueryClient, attendanceEventId: string): Promise<MatchScoreDraftRow | null> {
  const tableExists = await hasMatchScoreDraftTable(db);
  if (!tableExists) {
    return null;
  }

  const rows = await db.$queryRaw<MatchScoreDraftRow[]>`
    SELECT "draftJson", "updatedAt"
    FROM "MatchScoreDraft"
    WHERE "attendanceEventId" = ${attendanceEventId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

async function hasTeamStatsSuccessColumns(db: QueryClient): Promise<boolean> {
  if (hasTeamStatsSuccessColumnsCache !== null) {
    return hasTeamStatsSuccessColumnsCache;
  }

  const rows = await db.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'MatchPeriodScore'
        AND column_name = 'quickSuccessCount'
    ) AS "exists"
  `;

  hasTeamStatsSuccessColumnsCache = Boolean(rows[0]?.exists);
  return hasTeamStatsSuccessColumnsCache;
}

async function ensureMatchByAttendanceEvent(attendanceEventId: string) {
  const event = await prisma.attendanceEvent.findUnique({
    where: { id: attendanceEventId },
    select: {
      id: true,
      eventType: true,
      title: true,
      matchOpponent: true,
      scheduledAt: true,
    },
  });

  if (!event || event.eventType !== AttendanceEventType.MATCH) {
    return null;
  }

  const opponent = event.matchOpponent || event.title.replace(/^試合\s*:?\s*/, "") || "対戦相手未設定";

  const existing = await prisma.$queryRaw<MatchRow[]>`
    SELECT "id", "opponent", "matchDate", "ourScore", "theirScore"
    FROM "MatchRecord"
    WHERE "attendanceEventId" = ${event.id}
    ORDER BY "createdAt" ASC
    LIMIT 1
  `;

  let match: MatchRow;
  if (existing.length > 0) {
    await prisma.$executeRaw`
      UPDATE "MatchRecord"
      SET "opponent" = ${opponent}, "matchDate" = ${event.scheduledAt}
      WHERE "id" = ${existing[0].id}
    `;
    match = {
      ...existing[0],
      opponent,
      matchDate: event.scheduledAt,
    };
  } else {
    const created = await prisma.$queryRaw<MatchRow[]>`
      INSERT INTO "MatchRecord" (
        "id",
        "attendanceEventId",
        "opponent",
        "matchDate",
        "ourScore",
        "theirScore",
        "createdAt"
      )
      VALUES (
        ${crypto.randomUUID()},
        ${event.id},
        ${opponent},
        ${event.scheduledAt},
        0,
        0,
        NOW()
      )
      RETURNING "id", "opponent", "matchDate", "ourScore", "theirScore"
    `;
    match = created[0];
  }

  return { event, match };
}

async function findMatchByAttendanceEvent(attendanceEventId: string) {
  const event = await prisma.attendanceEvent.findUnique({
    where: { id: attendanceEventId },
    select: {
      id: true,
      eventType: true,
    },
  });

  if (!event || event.eventType !== AttendanceEventType.MATCH) {
    return null;
  }

  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "MatchRecord"
    WHERE "attendanceEventId" = ${event.id}
    ORDER BY "createdAt" ASC
    LIMIT 1
  `;

  if (existing.length === 0) {
    return { eventId: event.id, matchId: null };
  }

  return { eventId: event.id, matchId: existing[0].id };
}

async function buildState(attendanceEventId: string) {
  const ensured = await ensureMatchByAttendanceEvent(attendanceEventId);
  if (!ensured) {
    return null;
  }

  const [members, selectedRows, periodScores, periodPlayerRows, periodIncidentRows, draftRow] = await Promise.all([
    prisma.member.findMany({
      select: {
        id: true,
        name: true,
        nickname: true,
        grade: true,
      },
      orderBy: [{ grade: "asc" }, { nickname: "asc" }, { name: "asc" }],
    }),
    prisma.$queryRaw<PlayerScoreRow[]>`
      SELECT "id", "memberId", "goals", "shotAttempts", "isGoalkeeper"
      FROM "PlayerMatchScore"
      WHERE "matchId" = ${ensured.match.id}
      ORDER BY "submittedAt" ASC
    `,
    fetchPeriodScores(prisma, ensured.match.id),
    prisma.$queryRaw<PeriodPlayerRow[]>`
      SELECT "period", "memberId", "goals", "shotAttempts", "isGoalkeeper"
      FROM "PlayerMatchPeriodStat"
      WHERE "matchId" = ${ensured.match.id}
    `,
    fetchPeriodIncidents(prisma, ensured.match.id),
    fetchMatchDraft(prisma, ensured.event.id),
  ]);

  const firstHalf = periodScores.find((row) => row.period === "FIRST_HALF") || null;
  const secondHalf = periodScores.find((row) => row.period === "SECOND_HALF") || null;

  return {
    attendanceEvent: {
      id: ensured.event.id,
      title: ensured.event.title,
      scheduledAt: ensured.event.scheduledAt,
      opponent: ensured.match.opponent,
    },
    match: {
      id: ensured.match.id,
      ourScore: ensured.match.ourScore,
      theirScore: ensured.match.theirScore,
      matchDate: ensured.match.matchDate,
    },
    members,
    selectedPlayers: selectedRows,
    periodStatus: {
      firstHalfSaved: Boolean(firstHalf),
      secondHalfSaved: Boolean(secondHalf),
      firstHalfScore: firstHalf,
      secondHalfScore: secondHalf,
      periodPlayerRows,
      periodIncidentRows,
    },
    draft: draftRow
      ? {
        payload: draftRow.draftJson,
        updatedAt: draftRow.updatedAt,
      }
      : null,
  };
}

async function aggregateAndPersistMatchTotals(tx: Prisma.TransactionClient, matchId: string) {
  const scores = await fetchPeriodScores(tx, matchId);

  const totalOur = scores.reduce((sum, row) => sum + row.ourScore, 0);
  const totalTheir = scores.reduce((sum, row) => sum + row.theirScore, 0);

  await tx.$executeRaw`
    UPDATE "MatchRecord"
    SET "ourScore" = ${totalOur}, "theirScore" = ${totalTheir}
    WHERE "id" = ${matchId}
  `;

  const playerRows = await tx.$queryRaw<PeriodPlayerRow[]>`
    SELECT "period", "memberId", "goals", "shotAttempts", "isGoalkeeper"
    FROM "PlayerMatchPeriodStat"
    WHERE "matchId" = ${matchId}
  `;

  const aggregated = new Map<string, { goals: number; shotAttempts: number; isGoalkeeper: boolean; keeperPriority: number }>();

  for (const row of playerRows) {
    const current = aggregated.get(row.memberId) || {
      goals: 0,
      shotAttempts: 0,
      isGoalkeeper: false,
      keeperPriority: -1,
    };

    current.goals += row.goals;
    current.shotAttempts += row.shotAttempts;

    const priority = row.period === "SECOND_HALF" ? 2 : 1;
    if (row.isGoalkeeper && priority >= current.keeperPriority) {
      current.isGoalkeeper = true;
      current.keeperPriority = priority;
    }

    aggregated.set(row.memberId, current);
  }

  const memberIds = [...aggregated.keys()];

  if (memberIds.length > 0) {
    await tx.$executeRaw`
      DELETE FROM "PlayerMatchScore"
      WHERE "matchId" = ${matchId}
        AND "memberId" NOT IN (${Prisma.join(memberIds)})
    `;
  } else {
    await tx.$executeRaw`
      DELETE FROM "PlayerMatchScore"
      WHERE "matchId" = ${matchId}
    `;
  }

  for (const [memberId, value] of aggregated.entries()) {
    await tx.$executeRaw`
      INSERT INTO "PlayerMatchScore" (
        "id",
        "memberId",
        "matchId",
        "goals",
        "shotAttempts",
        "isGoalkeeper",
        "submittedAt"
      )
      VALUES (
        ${crypto.randomUUID()},
        ${memberId},
        ${matchId},
        ${value.goals},
        ${value.shotAttempts},
        ${value.isGoalkeeper},
        NOW()
      )
      ON CONFLICT ("memberId", "matchId")
      DO UPDATE SET
        "goals" = EXCLUDED."goals",
        "shotAttempts" = EXCLUDED."shotAttempts",
        "isGoalkeeper" = EXCLUDED."isGoalkeeper",
        "submittedAt" = EXCLUDED."submittedAt"
    `;
  }
}

export async function GET(request: NextRequest) {
  if (!(await getAuthorizedAdminMember())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const attendanceEventId = request.nextUrl.searchParams.get("attendanceEventId") || "";
  if (!attendanceEventId) {
    return badRequest("attendanceEventId が必要です");
  }

  const state = await buildState(attendanceEventId);
  if (!state) {
    return NextResponse.json({ error: "試合イベントが見つかりません" }, { status: 404 });
  }

  return NextResponse.json(state);
}

export async function POST(request: NextRequest) {
  if (!(await getAuthorizedAdminMember())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Payload;
  if (!body || typeof body !== "object" || !("intent" in body)) {
    return badRequest("リクエストが不正です");
  }

  if (body.intent === "init") {
    if (!body.attendanceEventId) {
      return badRequest("attendanceEventId が必要です");
    }
    if (!Array.isArray(body.selectedMemberIds) || body.selectedMemberIds.length === 0) {
      return badRequest("参加メンバーを1人以上選択してください");
    }
    if (!Array.isArray(body.goalkeeperMemberIds) || body.goalkeeperMemberIds.length === 0) {
      return badRequest("キーパーを1人以上選択してください");
    }

    const uniqueGoalkeeperIds = [...new Set(body.goalkeeperMemberIds)];
    const invalidGoalkeeper = uniqueGoalkeeperIds.some((memberId) => !body.selectedMemberIds.includes(memberId));
    if (invalidGoalkeeper) {
      return badRequest("キーパーは参加メンバーから選択してください");
    }

    const ensured = await ensureMatchByAttendanceEvent(body.attendanceEventId);
    if (!ensured) {
      return NextResponse.json({ error: "試合イベントが見つかりません" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        DELETE FROM "PlayerMatchScore"
        WHERE "matchId" = ${ensured.match.id}
          AND "memberId" NOT IN (${Prisma.join(body.selectedMemberIds)})
      `;

      for (const memberId of body.selectedMemberIds) {
        await tx.$executeRaw`
          INSERT INTO "PlayerMatchScore" (
            "id",
            "memberId",
            "matchId",
            "goals",
            "shotAttempts",
            "isGoalkeeper",
            "submittedAt"
          )
          VALUES (
            ${crypto.randomUUID()},
            ${memberId},
            ${ensured.match.id},
            0,
            0,
            ${uniqueGoalkeeperIds.includes(memberId)},
            NOW()
          )
          ON CONFLICT ("memberId", "matchId")
          DO UPDATE SET "isGoalkeeper" = EXCLUDED."isGoalkeeper"
        `;
      }
    });

    const state = await buildState(body.attendanceEventId);
    return NextResponse.json(state);
  }

  if (body.intent === "savePeriod") {
    if (!body.attendanceEventId) {
      return badRequest("attendanceEventId が必要です");
    }

    if (body.period !== "FIRST_HALF" && body.period !== "SECOND_HALF") {
      return badRequest("period が不正です");
    }

    if (!Array.isArray(body.playerStats) || body.playerStats.length === 0) {
      return badRequest("参加メンバーのデータが必要です");
    }

    if (!body.teamStats || typeof body.teamStats !== "object") {
      return badRequest("チームスタッツのデータが必要です");
    }

    const keeperCount = body.playerStats.filter((row) => row.isGoalkeeper).length;
    if (keeperCount < 1) {
      return badRequest("キーパーを1人以上選択してください");
    }

    const ensured = await ensureMatchByAttendanceEvent(body.attendanceEventId);
    if (!ensured) {
      return NextResponse.json({ error: "試合イベントが見つかりません" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      const hasAttempts = await hasTeamStatsColumns(tx);
      const hasSuccesses = await hasTeamStatsSuccessColumns(tx);

      if (hasAttempts && hasSuccesses) {
        await tx.$executeRaw`
          INSERT INTO "MatchPeriodScore" (
            "id",
            "matchId",
            "period",
            "ourScore",
            "theirScore",
            "quickCount",
            "quickSuccessCount",
            "leftCount",
            "leftSuccessCount",
            "centerCount",
            "centerSuccessCount",
            "pivotCount",
            "pivotSuccessCount",
            "reboundCount",
            "reboundSuccessCount",
            "sevenMeterCount",
            "sevenMeterSuccessCount",
            "savedAt"
          )
          VALUES (
            ${crypto.randomUUID()},
            ${ensured.match.id},
            ${body.period}::"MatchPeriod",
            ${clampNonNegative(body.ourScore)},
            ${clampNonNegative(body.theirScore)},
            ${clampNonNegative(body.teamStats.quickAttempts)},
            ${clampNonNegative(body.teamStats.quickSuccesses)},
            ${clampNonNegative(body.teamStats.leftAttempts)},
            ${clampNonNegative(body.teamStats.leftSuccesses)},
            ${clampNonNegative(body.teamStats.centerAttempts)},
            ${clampNonNegative(body.teamStats.centerSuccesses)},
            ${clampNonNegative(body.teamStats.pivotAttempts)},
            ${clampNonNegative(body.teamStats.pivotSuccesses)},
            ${clampNonNegative(body.teamStats.reboundAttempts)},
            ${clampNonNegative(body.teamStats.reboundSuccesses)},
            ${clampNonNegative(body.teamStats.sevenMeterAttempts)},
            ${clampNonNegative(body.teamStats.sevenMeterSuccesses)},
            NOW()
          )
          ON CONFLICT ("matchId", "period")
          DO UPDATE SET
            "ourScore" = EXCLUDED."ourScore",
            "theirScore" = EXCLUDED."theirScore",
            "quickCount" = EXCLUDED."quickCount",
            "quickSuccessCount" = EXCLUDED."quickSuccessCount",
            "leftCount" = EXCLUDED."leftCount",
            "leftSuccessCount" = EXCLUDED."leftSuccessCount",
            "centerCount" = EXCLUDED."centerCount",
            "centerSuccessCount" = EXCLUDED."centerSuccessCount",
            "pivotCount" = EXCLUDED."pivotCount",
            "pivotSuccessCount" = EXCLUDED."pivotSuccessCount",
            "reboundCount" = EXCLUDED."reboundCount",
            "reboundSuccessCount" = EXCLUDED."reboundSuccessCount",
            "sevenMeterCount" = EXCLUDED."sevenMeterCount",
            "sevenMeterSuccessCount" = EXCLUDED."sevenMeterSuccessCount",
            "savedAt" = EXCLUDED."savedAt"
        `;
      } else if (hasAttempts) {
        await tx.$executeRaw`
          INSERT INTO "MatchPeriodScore" (
            "id",
            "matchId",
            "period",
            "ourScore",
            "theirScore",
            "quickCount",
            "leftCount",
            "centerCount",
            "pivotCount",
            "reboundCount",
            "sevenMeterCount",
            "savedAt"
          )
          VALUES (
            ${crypto.randomUUID()},
            ${ensured.match.id},
            ${body.period}::"MatchPeriod",
            ${clampNonNegative(body.ourScore)},
            ${clampNonNegative(body.theirScore)},
            ${clampNonNegative(body.teamStats.quickAttempts)},
            ${clampNonNegative(body.teamStats.leftAttempts)},
            ${clampNonNegative(body.teamStats.centerAttempts)},
            ${clampNonNegative(body.teamStats.pivotAttempts)},
            ${clampNonNegative(body.teamStats.reboundAttempts)},
            ${clampNonNegative(body.teamStats.sevenMeterAttempts)},
            NOW()
          )
          ON CONFLICT ("matchId", "period")
          DO UPDATE SET
            "ourScore" = EXCLUDED."ourScore",
            "theirScore" = EXCLUDED."theirScore",
            "quickCount" = EXCLUDED."quickCount",
            "leftCount" = EXCLUDED."leftCount",
            "centerCount" = EXCLUDED."centerCount",
            "pivotCount" = EXCLUDED."pivotCount",
            "reboundCount" = EXCLUDED."reboundCount",
            "sevenMeterCount" = EXCLUDED."sevenMeterCount",
            "savedAt" = EXCLUDED."savedAt"
        `;
      } else {
        await tx.$executeRaw`
          INSERT INTO "MatchPeriodScore" (
            "id",
            "matchId",
            "period",
            "ourScore",
            "theirScore",
            "savedAt"
          )
          VALUES (
            ${crypto.randomUUID()},
            ${ensured.match.id},
            ${body.period}::"MatchPeriod",
            ${clampNonNegative(body.ourScore)},
            ${clampNonNegative(body.theirScore)},
            NOW()
          )
          ON CONFLICT ("matchId", "period")
          DO UPDATE SET
            "ourScore" = EXCLUDED."ourScore",
            "theirScore" = EXCLUDED."theirScore",
            "savedAt" = EXCLUDED."savedAt"
        `;
      }

      const memberIds = body.playerStats.map((row) => row.memberId);

      await tx.$executeRaw`
        DELETE FROM "PlayerMatchPeriodStat"
        WHERE "matchId" = ${ensured.match.id}
          AND "period" = ${body.period}::"MatchPeriod"
          AND "memberId" NOT IN (${Prisma.join(memberIds)})
      `;

      for (const row of body.playerStats) {
        await tx.$executeRaw`
          INSERT INTO "PlayerMatchPeriodStat" (
            "id",
            "matchId",
            "memberId",
            "period",
            "shotAttempts",
            "goals",
            "isGoalkeeper",
            "savedAt"
          )
          VALUES (
            ${crypto.randomUUID()},
            ${ensured.match.id},
            ${row.memberId},
            ${body.period}::"MatchPeriod",
            ${clampNonNegative(row.shotAttempts)},
            ${clampNonNegative(row.goals)},
            ${Boolean(row.isGoalkeeper)},
            NOW()
          )
          ON CONFLICT ("matchId", "memberId", "period")
          DO UPDATE SET
            "shotAttempts" = EXCLUDED."shotAttempts",
            "goals" = EXCLUDED."goals",
            "isGoalkeeper" = EXCLUDED."isGoalkeeper",
            "savedAt" = EXCLUDED."savedAt"
        `;
      }

      const incidentTableExists = await hasPeriodIncidentTable(tx);
      if (incidentTableExists) {
        const incidents = Array.isArray(body.incidents) ? body.incidents : [];

        console.log("[savePeriod] Attempting to save incidents:", {
          matchId: ensured.match.id,
          period: body.period,
          incidentCount: incidents.length,
          incidents: incidents.map(i => ({
            team: i.team,
            kind: i.kind,
            minute: i.minute,
            playerName: i.playerName
          }))
        });

        await tx.$executeRaw`
          DELETE FROM "MatchPeriodIncident"
          WHERE "matchId" = ${ensured.match.id}
            AND "period" = ${body.period}::"MatchPeriod"
        `;

        for (const incident of incidents) {
          const normalizedTeam = incident.team === "OPPONENT" ? "OPPONENT" : "OUR";
          const normalizedKind = incident.kind === "YELLOW" ? "YELLOW" : "TWO_MIN";
          const safeMinute = clampNonNegative(incident.minute);
          const safeName = normalizedTeam === "OUR"
            ? (incident.playerName || "").trim().slice(0, 64)
            : null;

          console.log("[savePeriod] Inserting incident:", {
            normalizedTeam,
            normalizedKind,
            safeMinute,
            safeName
          });

          await tx.$executeRaw`
            INSERT INTO "MatchPeriodIncident" (
              "id",
              "matchId",
              "period",
              "team",
              "kind",
              "minute",
              "playerName",
              "savedAt"
            )
            VALUES (
              ${crypto.randomUUID()},
              ${ensured.match.id},
              ${body.period}::"MatchPeriod",
              ${normalizedTeam},
              ${normalizedKind},
              ${safeMinute},
              ${safeName},
              NOW()
            )
          `;
        }
      }

      await aggregateAndPersistMatchTotals(tx, ensured.match.id);
    });

    const state = await buildState(body.attendanceEventId);
    return NextResponse.json(state);
  }

  if (body.intent === "saveDraft") {
    if (!body.attendanceEventId) {
      return badRequest("attendanceEventId が必要です");
    }

    const targetEvent = await prisma.attendanceEvent.findUnique({
      where: { id: body.attendanceEventId },
      select: {
        id: true,
        eventType: true,
      },
    });

    if (!targetEvent || targetEvent.eventType !== AttendanceEventType.MATCH) {
      return NextResponse.json({ error: "試合イベントが見つかりません" }, { status: 404 });
    }

    const tableExists = await hasMatchScoreDraftTable(prisma);
    if (!tableExists) {
      return NextResponse.json({ ok: false, skipped: true, reason: "MatchScoreDraft table not found" });
    }

    await prisma.$executeRaw`
      INSERT INTO "MatchScoreDraft" (
        "id",
        "attendanceEventId",
        "draftJson",
        "updatedAt"
      )
      VALUES (
        ${crypto.randomUUID()},
        ${targetEvent.id},
        ${JSON.stringify(body.draft)}::jsonb,
        NOW()
      )
      ON CONFLICT ("attendanceEventId")
      DO UPDATE SET
        "draftJson" = EXCLUDED."draftJson",
        "updatedAt" = EXCLUDED."updatedAt"
    `;

    return NextResponse.json({ ok: true });
  }

  if (body.intent === "clearDraft") {
    if (!body.attendanceEventId) {
      return badRequest("attendanceEventId が必要です");
    }

    const tableExists = await hasMatchScoreDraftTable(prisma);
    if (!tableExists) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    await prisma.$executeRaw`
      DELETE FROM "MatchScoreDraft"
      WHERE "attendanceEventId" = ${body.attendanceEventId}
    `;

    return NextResponse.json({ ok: true });
  }

  if (body.intent === "deleteMatch") {
    if (!body.attendanceEventId) {
      return badRequest("attendanceEventId が必要です");
    }

    const found = await findMatchByAttendanceEvent(body.attendanceEventId);
    if (!found) {
      return NextResponse.json({ error: "試合イベントが見つかりません" }, { status: 404 });
    }

    if (!found.matchId) {
      return NextResponse.json({ success: true, deleted: false });
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        DELETE FROM "MatchRecord"
        WHERE "id" = ${found.matchId}
      `;

      const draftTableExists = await hasMatchScoreDraftTable(tx);
      if (draftTableExists) {
        await tx.$executeRaw`
          DELETE FROM "MatchScoreDraft"
          WHERE "attendanceEventId" = ${found.eventId}
        `;
      }
    });

    return NextResponse.json({ success: true, deleted: true });
  }

  return badRequest("未対応の intent です");
}
