import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionMember } from "@/lib/member-session";
import styles from "./feedback.module.css";

export const dynamic = "force-dynamic";

type FeedbackPageProps = {
  searchParams: Promise<{
    ok?: string;
    error?: string;
  }>;
};

export default async function FeedbackPage({ searchParams }: FeedbackPageProps) {
  const params = await searchParams;
  const member = await getSessionMember();

  if (!member) {
    redirect("/auth");
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.card}>
          <h1>フィードバックを送る</h1>
          <p>使いづらい点、追加してほしい機能、改善案などを自由に入力してください。</p>

          {params.ok ? <p className={styles.message}>フィードバックを送信しました。ありがとうございました。</p> : null}
          {params.error ? <p className={styles.error}>エラー: {params.error}</p> : null}

          <form action="/api/feedback" method="post" className={styles.form}>
            <input type="hidden" name="redirectTo" value="/feedback" />
            <label>
              内容
              <textarea
                name="content"
                maxLength={1000}
                required
                placeholder="例: カレンダーの日付をタップしたとき、出席入力ページにもっと分かりやすく遷移してほしいです。"
              />
            </label>
            <button type="submit">送信する</button>
          </form>
        </section>

        <Link href="/" className={styles.backLink}>
          メイン画面へ戻る
        </Link>
      </main>
    </div>
  );
}
