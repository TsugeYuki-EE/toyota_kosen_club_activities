import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthorizedAdminMember } from "@/lib/admin-access";
import { LocalDateTime } from "@/components/local-date-time";
import { prisma } from "@/lib/prisma";
import styles from "@/app/admin/member-detail-dashboard.module.css";

// 得点記録も常に最新で見られるよう動的描画にします。
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ memberId: string }>;
};

// 部員ごとの得点履歴ページです。
export default async function MemberScoresPage({ params }: PageProps) {
  const { memberId } = await params;
  const adminMember = await getAuthorizedAdminMember();

  if (!adminMember) {
    return <main className={styles.page}><section className={styles.card}><h1>アクセス権限が必要です</h1></section></main>;
  }

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: {
      playerScores: {
        include: { match: true },
        orderBy: { match: { matchDate: "desc" } },
      },
    },
  });

  if (!member) {
    notFound();
  }

  const totalGoals = member.playerScores.reduce((sum, score) => sum + score.goals, 0);
  const maxGoals = Math.max(...member.playerScores.map((item) => item.goals), 1);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>{member.name} の個人スコア</h1>
        <p>試合ごとの得点と累計得点を確認できます。</p>
      </header>

      <nav className={styles.nav}>
        <Link className={styles.secondaryLink} href={`/admin/members/${member.id}`}>部員概要へ</Link>
        <Link className={styles.primaryLink} href={`/admin/members/${member.id}/attendance`}>出席確認</Link>
        <Link className={styles.primaryLink} href={`/admin/members/${member.id}/weight`}>体重推移</Link>
      </nav>

      <section className={styles.metrics}>
        <article className={styles.metricCard}>
          <div className={styles.metricValue}>{totalGoals}</div>
          <div className={styles.metricLabel}>累計得点</div>
        </article>
        <article className={styles.metricCard}>
          <div className={styles.metricValue}>{member.playerScores.length}</div>
          <div className={styles.metricLabel}>記録試合数</div>
        </article>
      </section>

      <section className={styles.card}>
        <h2>得点グラフ</h2>
        <ul className={styles.barList}>
          {member.playerScores.map((score) => (
            <li key={score.id} className={styles.barRow}>
              <div className={styles.barHeader}>
                <span><LocalDateTime value={score.match.matchDate} /> / vs {score.match.opponent}</span>
                <span>{score.goals}点</span>
              </div>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ width: `${(score.goals / maxGoals) * 100}%` }} />
              </div>
            </li>
          ))}
          {member.playerScores.length === 0 ? <li className={styles.empty}>まだ得点記録はありません。</li> : null}
        </ul>
      </section>
    </main>
  );
}
