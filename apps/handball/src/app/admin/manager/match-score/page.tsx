import Link from "next/link";
import { AttendanceEventType } from "@prisma/client";
import { getAuthorizedAdminMember } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { sortMembersByGradeAscending } from "@/lib/member-sort";
import { MatchScoreClient } from "@/app/admin/manager/match-score-client";
import styles from "../match-score.module.css";

export const dynamic = "force-dynamic";

function dayDistance(from: Date, to: Date): number {
  const oneDayMs = 24 * 60 * 60 * 1000;
  return Math.abs(Math.round((to.getTime() - from.getTime()) / oneDayMs));
}

export default async function ManagerMatchScorePage() {
  const adminMember = await getAuthorizedAdminMember();

  if (!adminMember) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>管理画面へのアクセス権限がありません</h1>
          <p>役職が管理者・コーチ・マネージャーのユーザーのみ利用できます。</p>
          <Link className={styles.linkButton} href="/">
            トップへ戻る
          </Link>
        </section>
      </main>
    );
  }

  const [events, membersRaw] = await Promise.all([
    prisma.attendanceEvent.findMany({
      where: { eventType: AttendanceEventType.MATCH },
      select: {
        id: true,
        title: true,
        matchOpponent: true,
        scheduledAt: true,
      },
    }),
    prisma.member.findMany({
      select: {
        id: true,
        name: true,
        nickname: true,
        grade: true,
      },
    }),
  ]);
  const members = sortMembersByGradeAscending(membersRaw);

  const now = new Date();
  const matchOptions = events
    .map((event) => ({
      id: event.id,
      title: event.title,
      opponent: event.matchOpponent,
      scheduledAtMs: event.scheduledAt.getTime(),
      distanceDays: dayDistance(now, event.scheduledAt),
    }))
    .sort((a, b) => {
      if (a.distanceDays !== b.distanceDays) {
        return a.distanceDays - b.distanceDays;
      }
      return a.scheduledAtMs - b.scheduledAtMs;
    });

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>試合スコア入力</h1>
        <p>試合を選択し、参加メンバーとキーパーを決めたあと、専用の入力ページへ移動します。</p>
        <div className={styles.topLinks}>
          <Link className={styles.linkButton} href="/admin/manager">
            マネージャーウィンドウへ戻る
          </Link>
          <Link className={styles.secondaryLink} href="/admin">
            管理画面へ戻る
          </Link>
        </div>
      </header>

      {matchOptions.length === 0 ? (
        <section className={styles.card}>
          <p className={styles.meta}>試合イベントがありません。先に管理画面で出席イベント(試合)を作成してください。</p>
        </section>
      ) : (
        <MatchScoreClient matchOptions={matchOptions} members={members} mode="setup" />
      )}
    </main>
  );
}
