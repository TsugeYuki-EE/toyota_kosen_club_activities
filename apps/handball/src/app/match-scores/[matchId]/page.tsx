import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionMember } from "@/lib/member-session";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/date-format";
import styles from "../match-scores.module.css";

export const dynamic = "force-dynamic";

type MatchIncidentRow = {
  id: string;
  matchId: string;
  period: "FIRST_HALF" | "SECOND_HALF";
  team: "OUR" | "OPPONENT";
  kind: "TWO_MIN" | "YELLOW";
  minute: number;
  playerName: string | null;
};

function formatRate(goals: number, attempts: number): string {
  if (attempts <= 0) {
    return "-";
  }

  return `${((goals / attempts) * 100).toFixed(1)}%`;
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const member = await getSessionMember();

  if (!member) {
    redirect("/auth");
  }

  const { matchId } = await params;

  const match = await prisma.matchRecord.findUnique({
    where: { id: matchId },
    include: {
      periodScores: {
        orderBy: { period: "asc" },
      },
      periodPlayerStats: {
        include: {
          member: {
            select: {
              id: true,
              name: true,
              nickname: true,
            },
          },
        },
        orderBy: [
          { period: "asc" },
          { goals: "desc" },
          { shotAttempts: "desc" },
        ],
      },
      playerScores: {
        include: {
          member: {
            select: {
              id: true,
              name: true,
              nickname: true,
            },
          },
        },
        orderBy: [
          { goals: "desc" },
          { shotAttempts: "desc" },
        ],
      },
    },
  });

  if (!match) {
    redirect("/match-scores");
  }

  const normalizedMatch = {
    ...match,
    periodScores: match.periodScores.map((row) => {
      const raw = row as Record<string, unknown>;
      return {
        ...row,
        quickCount: Number(raw.quickCount ?? 0),
        quickSuccessCount: Number(raw.quickSuccessCount ?? 0),
        leftCount: Number(raw.leftCount ?? 0),
        leftSuccessCount: Number(raw.leftSuccessCount ?? 0),
        centerCount: Number(raw.centerCount ?? 0),
        centerSuccessCount: Number(raw.centerSuccessCount ?? 0),
        pivotCount: Number(raw.pivotCount ?? 0),
        pivotSuccessCount: Number(raw.pivotSuccessCount ?? 0),
        reboundCount: Number(raw.reboundCount ?? 0),
        reboundSuccessCount: Number(raw.reboundSuccessCount ?? 0),
        sevenMeterCount: Number(raw.sevenMeterCount ?? 0),
        sevenMeterSuccessCount: Number(raw.sevenMeterSuccessCount ?? 0),
      };
    }),
  };

  // Get incidents
  const incidentTableExistsRows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'MatchPeriodIncident'
    ) AS "exists"
  `;
  const incidentTableExists = Boolean(incidentTableExistsRows[0]?.exists);
  const incidents: MatchIncidentRow[] = incidentTableExists
    ? await prisma.$queryRaw`
      SELECT "id", "matchId", "period", "team", "kind", "minute", "playerName"
      FROM "MatchPeriodIncident"
      WHERE "matchId" = ${matchId}
      ORDER BY "period" ASC, "minute" ASC, "savedAt" ASC
    `
    : [];

  const ownIncidents = incidents.filter((i) => i.team === "OUR");
  const opponentIncidents = incidents.filter((i) => i.team === "OPPONENT");

  const firstHalf = normalizedMatch.periodScores.find((p) => p.period === "FIRST_HALF");
  const secondHalf = normalizedMatch.periodScores.find((p) => p.period === "SECOND_HALF");

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>{`豊田高専 vs ${match.opponent}`}</h1>
        <p>{formatDateTime(new Date(match.matchDate))}</p>
      </header>

      <nav className={styles.nav}>
        <Link href="/match-scores" className={styles.secondaryLink}>
          試合スコア一覧へ戻る
        </Link>
      </nav>

      {/* 全体結果 */}
      <section className={styles.card}>
        <h2>全体結果</h2>
        <div style={{ fontSize: "36px", fontWeight: "800", color: "#173246", textAlign: "center", margin: "16px 0" }}>
          {match.ourScore} - {match.theirScore}
        </div>
      </section>

      {/* 前半・後半分けた結果 */}
      <section className={styles.card}>
        <h2>前後半の結果</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div style={{ border: "1px solid #d8e3ea", borderRadius: "8px", padding: "12px" }}>
            <h3 style={{ color: "#234a62", marginBottom: "12px" }}>前半</h3>
            {firstHalf ? (
              <>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "#173246", marginBottom: "8px" }}>
                  {firstHalf.ourScore} - {firstHalf.theirScore}
                </div>
              </>
            ) : (
              <p style={{ color: "#5a7588" }}>未登録</p>
            )}
          </div>

          <div style={{ border: "1px solid #d8e3ea", borderRadius: "8px", padding: "12px" }}>
            <h3 style={{ color: "#234a62", marginBottom: "12px" }}>後半</h3>
            {secondHalf ? (
              <>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "#173246", marginBottom: "8px" }}>
                  {secondHalf.ourScore} - {secondHalf.theirScore}
                </div>
              </>
            ) : (
              <p style={{ color: "#5a7588" }}>未登録</p>
            )}
          </div>
        </div>
      </section>

      {/* 退場・警告情報 */}
      <section className={styles.card}>
        <h2>退場・警告情報</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <h3 style={{ color: "#234a62", marginBottom: "8px" }}>自チーム</h3>
            {ownIncidents.length === 0 ? (
              <p style={{ color: "#5a7588" }}>記録なし</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "6px" }}>
                {ownIncidents.map((incident) => (
                  <li key={incident.id} style={{ fontSize: "14px", color: "#35556b", padding: "6px 8px", border: "1px solid #d8e3ea", borderRadius: "4px" }}>
                    {incident.period === "FIRST_HALF" ? "前半" : "後半"} {incident.minute}分 / {incident.kind === "YELLOW" ? "イエロー" : "2分退場"}
                    {incident.playerName && ` / ${incident.playerName}`}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 style={{ color: "#234a62", marginBottom: "8px" }}>相手チーム</h3>
            {opponentIncidents.length === 0 ? (
              <p style={{ color: "#5a7588" }}>記録なし</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "6px" }}>
                {opponentIncidents.map((incident) => (
                  <li key={incident.id} style={{ fontSize: "14px", color: "#35556b", padding: "6px 8px", border: "1px solid #d8e3ea", borderRadius: "4px" }}>
                    {incident.period === "FIRST_HALF" ? "前半" : "後半"} {incident.minute}分 / {incident.kind}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* チーム項目 - 前半 */}
      {firstHalf ? (
        <section className={styles.card}>
          <h2>チーム項目（前半）</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>種類</th>
                  <th>試行</th>
                  <th>成功</th>
                  <th>成功率</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>速</td>
                  <td>{firstHalf.quickCount}</td>
                  <td>{firstHalf.quickSuccessCount}</td>
                  <td>{formatRate(firstHalf.quickSuccessCount, firstHalf.quickCount)}</td>
                </tr>
                <tr>
                  <td>L</td>
                  <td>{firstHalf.leftCount}</td>
                  <td>{firstHalf.leftSuccessCount}</td>
                  <td>{formatRate(firstHalf.leftSuccessCount, firstHalf.leftCount)}</td>
                </tr>
                <tr>
                  <td>C</td>
                  <td>{firstHalf.centerCount}</td>
                  <td>{firstHalf.centerSuccessCount}</td>
                  <td>{formatRate(firstHalf.centerSuccessCount, firstHalf.centerCount)}</td>
                </tr>
                <tr>
                  <td>P</td>
                  <td>{firstHalf.pivotCount}</td>
                  <td>{firstHalf.pivotSuccessCount}</td>
                  <td>{formatRate(firstHalf.pivotSuccessCount, firstHalf.pivotCount)}</td>
                </tr>
                <tr>
                  <td>Re</td>
                  <td>{firstHalf.reboundCount}</td>
                  <td>{firstHalf.reboundSuccessCount}</td>
                  <td>{formatRate(firstHalf.reboundSuccessCount, firstHalf.reboundCount)}</td>
                </tr>
                <tr>
                  <td>7</td>
                  <td>{firstHalf.sevenMeterCount}</td>
                  <td>{firstHalf.sevenMeterSuccessCount}</td>
                  <td>{formatRate(firstHalf.sevenMeterSuccessCount, firstHalf.sevenMeterCount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* チーム項目 - 後半 */}
      {secondHalf ? (
        <section className={styles.card}>
          <h2>チーム項目（後半）</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>種類</th>
                  <th>試行</th>
                  <th>成功</th>
                  <th>成功率</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>速</td>
                  <td>{secondHalf.quickCount}</td>
                  <td>{secondHalf.quickSuccessCount}</td>
                  <td>{formatRate(secondHalf.quickSuccessCount, secondHalf.quickCount)}</td>
                </tr>
                <tr>
                  <td>L</td>
                  <td>{secondHalf.leftCount}</td>
                  <td>{secondHalf.leftSuccessCount}</td>
                  <td>{formatRate(secondHalf.leftSuccessCount, secondHalf.leftCount)}</td>
                </tr>
                <tr>
                  <td>C</td>
                  <td>{secondHalf.centerCount}</td>
                  <td>{secondHalf.centerSuccessCount}</td>
                  <td>{formatRate(secondHalf.centerSuccessCount, secondHalf.centerCount)}</td>
                </tr>
                <tr>
                  <td>P</td>
                  <td>{secondHalf.pivotCount}</td>
                  <td>{secondHalf.pivotSuccessCount}</td>
                  <td>{formatRate(secondHalf.pivotSuccessCount, secondHalf.pivotCount)}</td>
                </tr>
                <tr>
                  <td>Re</td>
                  <td>{secondHalf.reboundCount}</td>
                  <td>{secondHalf.reboundSuccessCount}</td>
                  <td>{formatRate(secondHalf.reboundSuccessCount, secondHalf.reboundCount)}</td>
                </tr>
                <tr>
                  <td>7</td>
                  <td>{secondHalf.sevenMeterCount}</td>
                  <td>{secondHalf.sevenMeterSuccessCount}</td>
                  <td>{formatRate(secondHalf.sevenMeterSuccessCount, secondHalf.sevenMeterCount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* 選手別スコア - 全体 */}
      <section className={styles.card}>
        <h2>選手別スコア（全体）</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>部員</th>
                <th>シュート本数</th>
                <th>得点</th>
                <th>得点率</th>
              </tr>
            </thead>
            <tbody>
              {match.playerScores.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "#5a7588", padding: "16px" }}>
                    未登録
                  </td>
                </tr>
              ) : (
                match.playerScores.map((score) => {
                  const name = score.member.nickname || score.member.name;
                  return (
                    <tr key={score.id}>
                      <td>{name}</td>
                      <td>{score.shotAttempts}</td>
                      <td>{score.goals}</td>
                      <td>{formatRate(score.goals, score.shotAttempts)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 選手別スコア - 前半 */}
      {normalizedMatch.periodPlayerStats.some((p) => p.period === "FIRST_HALF") ? (
        <section className={styles.card}>
          <h2>選手別スコア（前半）</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>部員</th>
                  <th>シュート本数</th>
                  <th>得点</th>
                  <th>得点率</th>
                </tr>
              </thead>
              <tbody>
                {normalizedMatch.periodPlayerStats
                  .filter((p) => p.period === "FIRST_HALF")
                  .map((score) => {
                    const name = score.member.nickname || score.member.name;
                    return (
                      <tr key={score.id}>
                        <td>{name}</td>
                        <td>{score.shotAttempts}</td>
                        <td>{score.goals}</td>
                        <td>{formatRate(score.goals, score.shotAttempts)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* 選手別スコア - 後半 */}
      {normalizedMatch.periodPlayerStats.some((p) => p.period === "SECOND_HALF") ? (
        <section className={styles.card}>
          <h2>選手別スコア（後半）</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>部員</th>
                  <th>シュート本数</th>
                  <th>得点</th>
                  <th>得点率</th>
                </tr>
              </thead>
              <tbody>
                {normalizedMatch.periodPlayerStats
                  .filter((p) => p.period === "SECOND_HALF")
                  .map((score) => {
                    const name = score.member.nickname || score.member.name;
                    return (
                      <tr key={score.id}>
                        <td>{name}</td>
                        <td>{score.shotAttempts}</td>
                        <td>{score.goals}</td>
                        <td>{formatRate(score.goals, score.shotAttempts)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
