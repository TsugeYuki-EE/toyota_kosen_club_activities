import Link from "next/link";
import { getAuthorizedAdminMember, isSuperAdminNickname } from "@/lib/admin-access";
import { toDateKey } from "@/lib/date-format";
import { prisma } from "@/lib/prisma";
import { sortMembersByGradeAscending } from "@/lib/member-sort";
import { ManagerMemberTable } from "./manager-member-table";
import styles from "../admin-dashboard.module.css";

export const dynamic = "force-dynamic";

type MemberRoleValue = "PLAYER" | "MANAGER" | "COACH" | "ADMIN";

export default async function AdminManagerPage() {
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

  const members = await prisma.member.findMany({
    select: {
      id: true,
      name: true,
      nickname: true,
      grade: true,
      role: true,
      attendances: {
        select: {
          status: true,
        },
      },
      playerScores: {
        select: {
          goals: true,
          shotAttempts: true,
        },
      },
      weights: {
        orderBy: {
          submittedAt: "desc",
        },
        take: 1,
        select: {
          weightKg: true,
          submittedAt: true,
        },
      },
    },
  });

  const goalRows = await prisma.$queryRaw<Array<{ id: string; yearlyGoal: string | null; monthlyGoal: string | null }>>`
    SELECT "id", "yearlyGoal", "monthlyGoal"
    FROM "Member"
  `;
  const goalMap = new Map(goalRows.map((row) => [row.id, row]));

  const todayKey = toDateKey(new Date());

  const rows = sortMembersByGradeAscending(members).map((member) => {
    const role: MemberRoleValue = isSuperAdminNickname(member.nickname)
      ? "ADMIN"
      : (member.role as MemberRoleValue);
    const validAttendances = member.attendances.filter((record) =>
      record.status === "ATTEND" || record.status === "LATE" || record.status === "ABSENT"
    );
    const attendCount = validAttendances.filter((record) => record.status === "ATTEND").length;
    const attendanceRate =
      validAttendances.length === 0 ? null : (attendCount / validAttendances.length) * 100;
    const totalGoals = member.playerScores.reduce((sum, score) => sum + score.goals, 0);
    const totalShotAttempts = member.playerScores.reduce((sum, score) => sum + score.shotAttempts, 0);
    const scoringRate = totalShotAttempts === 0 ? null : (totalGoals / totalShotAttempts) * 100;
    const latestWeight = member.weights[0] ?? null;
    const goal = goalMap.get(member.id);

    return {
      id: member.id,
      name: member.name,
      nickname: member.nickname,
      grade: member.grade,
      role,
      yearlyGoal: goal?.yearlyGoal ?? null,
      monthlyGoal: goal?.monthlyGoal ?? null,
      attendanceRate,
      scoringRate,
      latestWeightKg: latestWeight?.weightKg ?? null,
      isLatestWeightToday: latestWeight ? toDateKey(latestWeight.submittedAt) === todayKey : false,
    };
  });

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>マネージャーウィンドウ</h1>
        <p>部員情報に加えて、出席率・得点率・最新体重を確認できます。</p>
        <div className={styles.topLinks}>
          <Link className={styles.linkButton} href="/admin">
            管理画面へ戻る
          </Link>
          <Link className={styles.secondaryLink} href="/">
            メイン画面へ
          </Link>
        </div>
      </header>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2>部員一覧 (マネージャー確認用)</h2>
            <p className={styles.meta}>チェックボックスで表示列を切り替えられます。</p>
          </div>
        </div>

        <ManagerMemberTable members={rows} />

        <div className={styles.inlineActions}>
          <Link className={styles.linkButton} href="/admin/manager/weights">
            体重一括入力
          </Link>
          <Link className={styles.linkButton} href="/admin/manager/match-score">
            試合スコア入力
          </Link>
        </div>
      </section>
    </main>
  );
}
