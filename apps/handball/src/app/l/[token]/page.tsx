import { InputType } from "@prisma/client";
import Link from "next/link";
import { LocalDateTime } from "@/components/local-date-time";
import { prisma } from "@/lib/prisma";
import styles from "./public-input-form.module.css";

// 共有リンクの有効期限や状態を毎回チェックするため動的描画にします。
export const dynamic = "force-dynamic";

type LinkInputPageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string }>;
};

// 共有リンクから出席または体重を入力する画面です。
export default async function LinkInputPage({ params, searchParams }: LinkInputPageProps) {
  const { token } = await params;
  const { done } = await searchParams;

  const inputToken = await prisma.inputToken.findUnique({
    where: { token },
    include: {
      member: true,
      event: true,
    },
  });

  if (!inputToken || !inputToken.isActive) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>リンクが無効です</h1>
          <p>入力リンクが存在しないか、無効化されています。</p>
          <Link href="/" className={styles.linkButton}>
            トップへ戻る
          </Link>
        </section>
      </main>
    );
  }

  if (inputToken.expiresAt < new Date()) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>リンクの有効期限が切れています</h1>
          <p>管理者に新しいリンクを発行してもらってください。</p>
          <Link href="/" className={styles.linkButton}>
            トップへ戻る
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1>入力フォーム</h1>
        <p>対象者: {inputToken.member.name}</p>
        <p>有効期限: <LocalDateTime value={inputToken.expiresAt} /></p>

        {done === "1" ? <p className={styles.ok}>送信が完了しました。必要なら再送信できます。</p> : null}

        {inputToken.type === InputType.ATTENDANCE ? (
          <form action="/api/public/attendance" method="post" className={styles.form}>
            <input type="hidden" name="token" value={token} />
            <p>イベント: {inputToken.event?.title || "未設定"}</p>
            {inputToken.event?.matchDetail || inputToken.event?.note ? (
              <div className={styles.infoBox}>
                <p className={styles.infoTitle}>提出前に確認</p>
                {inputToken.event?.matchDetail ? <p>試合詳細: {inputToken.event.matchDetail}</p> : null}
                {inputToken.event?.note ? <p>補足: {inputToken.event.note}</p> : null}
              </div>
            ) : null}
            <label>
              出席状況
              <select name="status" defaultValue="ATTEND" required>
                <option value="ATTEND">出席</option>
                <option value="LATE">遅刻</option>
                <option value="ABSENT">欠席</option>
              </select>
            </label>
            <label>
              補足
              <textarea name="comment" rows={3} />
            </label>
            <button type="submit">送信する</button>
          </form>
        ) : (
          <form action="/api/public/weight" method="post" className={styles.form}>
            <input type="hidden" name="token" value={token} />
            <label>
              体重 (kg)
              <input type="number" name="weightKg" min="1" step="0.1" required />
            </label>
            <label>
              補足
              <textarea name="note" rows={3} />
            </label>
            <button type="submit">送信する</button>
          </form>
        )}
      </section>
    </main>
  );
}
