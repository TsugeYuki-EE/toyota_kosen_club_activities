import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthorizedAdminMember } from "@/lib/admin-access";
import { WeightHistoryChart } from "@/components/weight-history-chart";
import { prisma } from "@/lib/prisma";
import styles from "@/app/admin/member-detail-dashboard.module.css";
import selfStyles from "@/app/self/self-pages.module.css";

// 体重推移を最新のまま表示します。
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ memberId: string }>;
};

// 部員ごとの体重推移ページです。
export default async function MemberWeightPage({ params }: PageProps) {
  const { memberId } = await params;
  const adminMember = await getAuthorizedAdminMember();

  if (!adminMember) {
    return (
      <div className={selfStyles.page}>
        <main className={selfStyles.main}>
          <section className={selfStyles.card}>
            <h1>アクセス権限が必要です</h1>
          </section>
        </main>
      </div>
    );
  }

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: {
      weights: { orderBy: { submittedAt: "asc" }, take: 12 },
    },
  });

  if (!member) {
    notFound();
  }

  return (
    <div className={selfStyles.page}>
      <main className={selfStyles.main}>
        <header className={selfStyles.header}>
          <h1>{member.name} の体重推移</h1>
          <p className={selfStyles.muted}>最新 12 件の体重記録を確認できます。</p>
        </header>

        <nav className={styles.nav}>
          <Link className={styles.secondaryLink} href={`/admin/members/${member.id}`}>部員概要へ</Link>
          <Link className={styles.primaryLink} href={`/admin/members/${member.id}/attendance`}>出席確認</Link>
          <Link className={styles.primaryLink} href={`/admin/members/${member.id}/scores`}>個人スコア</Link>
        </nav>

        <section className={selfStyles.card}>
          <WeightHistoryChart records={member.weights} graphTitle="体重推移グラフ" />
        </section>
      </main>
    </div>
  );
}
