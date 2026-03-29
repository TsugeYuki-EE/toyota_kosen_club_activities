import Link from "next/link";
import { AttendanceEventType } from "@prisma/client";
import { getAuthorizedAdminMember } from "@/lib/admin-access";
import { nowInJst, toDateTimeLocalValue } from "@/lib/date-format";
import styles from "../events-management.module.css";

export const dynamic = "force-dynamic";

export default async function SingleEventCreatePage() {
  const adminMember = await getAuthorizedAdminMember();

  if (!adminMember) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>単体予定作成へのアクセス権限がありません</h1>
          <p>役職が管理者・コーチ・マネージャーのユーザーのみ利用できます。</p>
          <Link className={styles.linkButton} href="/admin/events">
            予定管理へ戻る
          </Link>
        </section>
      </main>
    );
  }

  const now = nowInJst();
  const defaultDate = toDateTimeLocalValue(now).slice(0, 10);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>単体予定作成</h1>
        <p>1件ずつ予定を作成します。時刻は5分単位で指定できます。</p>
        <div className={styles.topLinks}>
          <Link className={styles.linkButton} href="/admin/events">
            予定管理へ戻る
          </Link>
          <Link className={styles.secondaryLink} href="/admin/events/bulk">
            複数予定作成へ
          </Link>
        </div>
      </header>

      <section className={styles.card}>
        <h2>入力フォーム</h2>
        <form action="/api/events" method="post" className={styles.form}>
          <input type="hidden" name="redirectTo" value="/admin/events/single" />
          <label>
            種別
            <select name="eventType" defaultValue={AttendanceEventType.PRACTICE}>
              <option value={AttendanceEventType.PRACTICE}>練習</option>
              <option value={AttendanceEventType.MATCH}>試合</option>
            </select>
          </label>
          <label>
            日付
            <input type="date" name="eventDate" defaultValue={defaultDate} required />
          </label>
          <label>
            時刻 (5分単位)
            <input type="time" name="eventTime" step={300} defaultValue="19:00" required />
          </label>
          <label>
            対戦相手 (試合の場合)
            <input type="text" name="matchOpponent" placeholder="例: 豊田北高校" />
          </label>
          <label>
            試合詳細 (試合の場合)
            <textarea name="matchDetail" rows={2} placeholder="例: 会場、集合時刻、ユニフォーム情報" />
          </label>
          <label>
            補足
            <textarea name="note" rows={2} />
          </label>
          <button type="submit">単体予定を作成</button>
        </form>
      </section>
    </main>
  );
}
