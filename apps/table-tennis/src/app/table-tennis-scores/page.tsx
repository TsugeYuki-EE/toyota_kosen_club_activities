import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionMember } from "@/lib/member-session";
import { prisma } from "@/lib/prisma";
import { LocalDateTime } from "@/components/local-date-time";
import styles from "@/app/home-dashboard.module.css";

export const dynamic = "force-dynamic";

export default async function TableTennisScoresPage() {
  const member = await getSessionMember();

  if (!member) {
    redirect("/auth");
  }

  const sheets = await prisma.tableTennisScoreSheet.findMany({
    where: { memberId: member.id },
    include: { entries: { orderBy: { setNumber: "asc" } } },
    orderBy: { matchDate: "desc" },
  });

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>試合結果入力</h1>
        <p>5セット分の試合結果とコメントを入力できます。</p>
      </header>

      <nav className={styles.nav}>
        <Link href="/" className={styles.secondaryLink}>ホームへ戻る</Link>
        <Link href="/table-tennis-scores/new" className={styles.button}>新しい試合結果</Link>
      </nav>

      <section className={styles.grid}>
        <article className={styles.card}>
          <h2>過去の試合結果</h2>
          {sheets.length === 0 ? (
            <p className={styles.empty}>まだ試合結果が登録されていません。</p>
          ) : (
            <ul className={styles.list}>
              {sheets.map((sheet) => (
                <li key={sheet.id} className={styles.item}>
                  <div className={styles.meta}>
                    <span>対戦: {sheet.opponent}</span>
                    <span>日時: <LocalDateTime value={sheet.matchDate} /></span>
                  </div>
                  {sheet.comment ? <p className={styles.content}>{sheet.comment}</p> : null}
                  <ul className={styles.entryList}>
                    {sheet.entries.map((entry) => (
                      <li key={entry.id} className={styles.entryItem}>
                        <span className={styles.setLabel}>第{entry.setNumber}セット</span>
                        <span className={styles.score}>
                          {entry.ourScore} - {entry.theirScore}
                          {entry.winner ? ` (${entry.winner === "OUR" ? "勝ち" : "負け"})` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Link href={`/table-tennis-scores/${sheet.id}`} className={styles.secondaryLink}>
                    詳細を見る
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </main>
  );
}