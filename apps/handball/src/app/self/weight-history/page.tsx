import Link from "next/link";
import { redirect } from "next/navigation";
import { WeightHistoryChart } from "@/components/weight-history-chart";
import { getSessionMember } from "@/lib/member-session";
import { prisma } from "@/lib/prisma";
import styles from "../self-pages.module.css";

type WeightHistoryPageProps = {
  searchParams: Promise<{ ok?: string; error?: string; month?: string }>;
};

function buildBackHref(month?: string): string {
  return month && /^\d{4}-\d{2}$/.test(month) ? `/?month=${month}` : "/";
}

export default async function SelfWeightHistoryPage({ searchParams }: WeightHistoryPageProps) {
  const params = await searchParams;
  const member = await getSessionMember();

  if (!member) {
    redirect("/auth");
  }

  const weightRecords = await prisma.weightRecord.findMany({
    where: { memberId: member.id },
    orderBy: { submittedAt: "asc" },
    take: 24,
  });

  const backHref = buildBackHref(params.month);
  const redirectTo = params.month && /^\d{4}-\d{2}$/.test(params.month)
    ? `/self/weight-history?month=${params.month}`
    : "/self/weight-history";

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <Link href={backHref} className={styles.backLink}>カレンダーに戻る</Link>
          <h1>体重推移</h1>
        </header>

        {params.ok ? <p className={styles.message}>保存しました: {params.ok}</p> : null}
        {params.error ? <p className={styles.error}>エラー: {params.error}</p> : null}

        <section className={styles.card}>
          <WeightHistoryChart
            records={weightRecords}
            graphTitle="体重推移グラフ"
            actionHeader="操作"
            renderAction={(record) => (
              <form action="/api/self-weight" method="post" className={styles.inlineForm}>
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name="recordId" value={record.id} />
                <button className={styles.dangerSmall} type="submit">削除</button>
              </form>
            )}
          />
        </section>
      </main>
    </div>
  );
}
