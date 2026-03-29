import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionMember } from "@/lib/member-session";
import { prisma } from "@/lib/prisma";
import { MatchScoresView } from "./match-scores-view-client";
import styles from "./match-scores.module.css";

export const dynamic = "force-dynamic";

type PlayerSummary = {
  memberId: string;
  name: string;
  goals: number;
  shotAttempts: number;
};

function formatRate(goals: number, attempts: number): string {
  if (attempts <= 0) {
    return "-";
  }

  return `${((goals / attempts) * 100).toFixed(1)}%`;
}

export default async function MatchScoresPage() {
  const member = await getSessionMember();

  if (!member) {
    redirect("/auth");
  }

  // テーブル表示用の基本情報のみ取得
  const matches = await prisma.matchRecord.findMany({
    select: {
      id: true,
      opponent: true,
      ourScore: true,
      theirScore: true,
      matchDate: true,
    },
    orderBy: { matchDate: "desc" },
    take: 50,
  });

  // 部員別サマリー用の詳細データ取得
  const matchesForSummary = await prisma.matchRecord.findMany({
    select: {
      playerScores: {
        select: {
          memberId: true,
          goals: true,
          shotAttempts: true,
          member: {
            select: {
              name: true,
              nickname: true,
            },
          },
        },
      },
    },
    take: 50,
  });

  const summaryMap = new Map<string, PlayerSummary>();

  for (const match of matchesForSummary) {
    for (const score of match.playerScores) {
      const key = score.memberId;
      const label = score.member.nickname || score.member.name;
      const current = summaryMap.get(key) || {
        memberId: key,
        name: label,
        goals: 0,
        shotAttempts: 0,
      };

      current.goals += score.goals;
      current.shotAttempts += score.shotAttempts;
      summaryMap.set(key, current);
    }
  }

  const totalRows = [...summaryMap.values()].sort((a, b) => {
    if (b.goals !== a.goals) {
      return b.goals - a.goals;
    }

    return b.shotAttempts - a.shotAttempts;
  });

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>試合スコア</h1>
        <p>保存済み試合スコアと、部員ごとの得点率を確認できます。</p>
      </header>

      <nav className={styles.nav}>
        <Link href="/" className={styles.secondaryLink}>メイン画面へ戻る</Link>
      </nav>

      <section className={styles.card}>
        <h2>部員別サマリー</h2>
        <p className={styles.meta}>全試合の合計で、シュート本数・得点・得点率を表示します。</p>

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
              {totalRows.map((row) => (
                <tr key={row.memberId}>
                  <td>{row.name}</td>
                  <td>{row.shotAttempts}</td>
                  <td>{row.goals}</td>
                  <td>{formatRate(row.goals, row.shotAttempts)}</td>
                </tr>
              ))}
              {totalRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className={styles.empty}>まだ試合スコアはありません。</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.card}>
        <h2>試合別スコア</h2>
        <MatchScoresView matches={matches} />
      </section>
    </main>
  );
}
