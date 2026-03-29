import Link from "next/link";
import { AttendanceEventType } from "@prisma/client";
import { getAuthorizedAdminMember } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { sortMembersByGradeAscending } from "@/lib/member-sort";
import { MatchScoreClient } from "@/app/admin/manager/match-score-client";
import styles from "../../match-score.module.css";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ attendanceEventId?: string }>;
};

function dayDistance(from: Date, to: Date): number {
  const oneDayMs = 24 * 60 * 60 * 1000;
  return Math.abs(Math.round((to.getTime() - from.getTime()) / oneDayMs));
}

export default async function ManagerMatchScoreInputPage({ searchParams }: PageProps) {
  const params = await searchParams;
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

  if (!params.attendanceEventId) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>試合が選択されていません</h1>
          <p className={styles.meta}>先に試合スコア入力ページで試合とメンバーを設定してください。</p>
          <Link className={styles.linkButton} href="/admin/manager/match-score">
            試合選択ページへ戻る
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>試合スコア入力 (専用ページ)</h1>
        <p>このページはタブレット、またはスマホ横画面での入力を推奨します。</p>
        <div className={styles.topLinks}>
          <Link className={styles.linkButton} href="/admin/manager/match-score">
            試合選択ページへ戻る
          </Link>
          <Link className={styles.secondaryLink} href="/admin/manager">
            マネージャーウィンドウへ戻る
          </Link>
        </div>
      </header>

      <MatchScoreClient
        matchOptions={matchOptions}
        members={members}
        mode="input"
        initialAttendanceEventId={params.attendanceEventId}
      />
    </main>
  );
}
