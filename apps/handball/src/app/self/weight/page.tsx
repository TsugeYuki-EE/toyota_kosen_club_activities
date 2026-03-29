import Link from "next/link";
import { redirect } from "next/navigation";
import { LocalDateTime } from "@/components/local-date-time";
import { getSessionMember } from "@/lib/member-session";
import { prisma } from "@/lib/prisma";
import styles from "../self-pages.module.css";

type WeightPageProps = {
  searchParams: Promise<{ ok?: string; error?: string; month?: string }>;
};

function buildBackHref(month?: string): string {
  return month && /^\d{4}-\d{2}$/.test(month) ? `/?month=${month}` : "/";
}

export default async function SelfWeightPage({ searchParams }: WeightPageProps) {
  const params = await searchParams;
  const member = await getSessionMember();

  if (!member) {
    redirect("/auth");
  }

  const latestWeight = await prisma.weightRecord.findFirst({
    where: { memberId: member.id },
    orderBy: { submittedAt: "desc" },
  });

  const backHref = buildBackHref(params.month);
  const redirectTo = params.month && /^\d{4}-\d{2}$/.test(params.month)
    ? `/self/weight?month=${params.month}`
    : "/self/weight";

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <Link href={backHref} className={styles.backLink}>カレンダーに戻る</Link>
          <h1>体重入力</h1>
        </header>

        {params.ok ? <p className={styles.message}>保存しました: {params.ok}</p> : null}
        {params.error ? <p className={styles.error}>エラー: {params.error}</p> : null}

        <section className={styles.card}>
          <form action="/api/self-weight" method="post" className={styles.form}>
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <input type="hidden" name="successRedirectTo" value={backHref} />
            <label>
              記録日時
              <span><LocalDateTime value={new Date()} /></span>
            </label>
            <label>
              体重 (kg)
              <input type="number" name="weightKg" min="1" step="0.1" placeholder="例: 68.4" required />
            </label>
            <button className={styles.primary} type="submit">送信する</button>
          </form>
          <p className={styles.muted}>
            最新記録: {latestWeight ? <>{latestWeight.weightKg}kg / <LocalDateTime value={latestWeight.submittedAt} /></> : "まだ記録がありません"}
          </p>
        </section>
      </main>
    </div>
  );
}
