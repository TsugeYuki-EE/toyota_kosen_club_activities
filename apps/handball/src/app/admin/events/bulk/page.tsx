import Link from "next/link";
import { getAuthorizedAdminMember } from "@/lib/admin-access";
import { nowInJst, toDateTimeLocalValue } from "@/lib/date-format";
import styles from "../events-management.module.css";
import { BulkDatePicker } from "../bulk-date-picker";

export const dynamic = "force-dynamic";

export default async function BulkEventCreatePage() {
  const adminMember = await getAuthorizedAdminMember();

  if (!adminMember) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>複数予定作成へのアクセス権限がありません</h1>
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
        <h1>複数予定作成</h1>
        <p>カレンダーから複数日を選択し、同じ時刻でまとめて作成できます。</p>
        <div className={styles.topLinks}>
          <Link className={styles.linkButton} href="/admin/events">
            予定管理へ戻る
          </Link>
          <Link className={styles.secondaryLink} href="/admin/events/single">
            単体予定作成へ
          </Link>
        </div>
      </header>

      <section className={styles.card}>
        <h2>入力フォーム</h2>
        <BulkDatePicker defaultDate={defaultDate} />
      </section>
    </main>
  );
}
