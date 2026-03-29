import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LocalDateTime } from "@/components/local-date-time";
import { getSessionMember } from "@/lib/member-session";
import styles from "@/app/member-page-shared.module.css";

// 送信結果や最新得点を即時表示するページです。
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ ok?: string; error?: string }>;
};

// 個人得点を入力するページです。
export default async function PlayerScoreInputPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const member = await getSessionMember();

  if (!member) {
    redirect("/auth");
  }

  const [matches, recentScores] = await Promise.all([
    prisma.matchRecord.findMany({ orderBy: { matchDate: "desc" }, take: 30 }),
    prisma.playerMatchScore.findMany({
      include: { member: true, match: true },
      orderBy: { submittedAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>自分の試合得点を入力</h1>
        <p>{member.nickname} として入力します。どの試合で何点取ったかを送信してください。</p>
      </header>

      <nav className={styles.nav}>
        <Link href="/" className={styles.secondaryLink}>メイン画面へ戻る</Link>
      </nav>

      {params.ok ? <p className={styles.message}>個人得点を保存しました。</p> : null}
      {params.error ? <p className={styles.error}>エラー: {params.error}</p> : null}

      <section className={styles.grid}>
        <article className={styles.card}>
          <h2>入力フォーム</h2>
          <form action="/api/player-scores" method="post" className={styles.form}>
            <input type="hidden" name="redirectTo" value="/player-scores/new" />
            <label>
              試合
              <select name="matchId" required>
                <option value="">選択してください</option>
                {matches.map((match) => (
                  <option key={match.id} value={match.id}>
                    {`vs ${match.opponent}`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              自分の得点
              <input type="number" name="goals" min="0" defaultValue="0" required />
            </label>
            <label>
              コメント
              <textarea name="note" rows={3} />
            </label>
            <button type="submit" className={styles.button}>保存する</button>
          </form>
        </article>

        <article className={styles.card}>
          <h2>最近の個人得点入力</h2>
          <ul className={styles.list}>
            {recentScores.map((score) => (
              <li key={score.id}>
                <div className={styles.itemTitle}>{score.member.name}</div>
                <div>vs {score.match.opponent} / {score.goals}点</div>
                <div className={styles.meta}><LocalDateTime value={score.submittedAt} /></div>
              </li>
            ))}
            {recentScores.length === 0 ? <li className={styles.empty}>まだ入力はありません。</li> : null}
          </ul>
        </article>
      </section>
    </main>
  );
}
