import Link from "next/link";
import { getAuthorizedAdminMember } from "@/lib/admin-access";
import { nowInJst, toDateTimeLocalValue } from "@/lib/date-format";
import styles from "../../events-management.module.css";

export const dynamic = "force-dynamic";

const weekdayRows = [
  { key: "sun", label: "日", startTime: "09:15", endTime: "13:00" },
  { key: "mon", label: "月", startTime: "15:15", endTime: "18:00" },
  { key: "tue", label: "火", startTime: "16:30", endTime: "18:30" },
  { key: "wed", label: "水", startTime: "15:55", endTime: "18:30" },
  { key: "thu", label: "木", startTime: "16:30", endTime: "18:30" },
  { key: "fri", label: "金", startTime: "15:15", endTime: "18:00" },
  { key: "sat", label: "土", startTime: "09:15", endTime: "13:00" },
] as const;

export default async function BulkDefaultEventCreatePage() {
  const adminMember = await getAuthorizedAdminMember();

  if (!adminMember) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>デフォルト入力へのアクセス権限がありません</h1>
          <p>役職が管理者・コーチ・マネージャーのユーザーのみ利用できます。</p>
          <Link className={styles.linkButton} href="/admin/events">
            予定管理へ戻る
          </Link>
        </section>
      </main>
    );
  }

  const defaultDate = toDateTimeLocalValue(nowInJst()).slice(0, 10);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>デフォルト入力で一括作成</h1>
        <p>期間と曜日ごとの時刻を設定すると、祝日を除いて自動で予定を作成します。</p>
        <div className={styles.topLinks}>
          <Link className={styles.linkButton} href="/admin/events/bulk">
            複数予定作成へ戻る
          </Link>
          <Link className={styles.secondaryLink} href="/admin/events">
            予定管理へ戻る
          </Link>
        </div>
      </header>

      <section className={styles.card}>
        <h2>デフォルト設定</h2>
        <form action="/api/events/bulk/defaults" method="post" className={styles.form}>
          <input type="hidden" name="redirectTo" value="/admin/events" />

          <div className={styles.inlineRow}>
            <label>
              開始日
              <input type="date" name="startDate" defaultValue={defaultDate} required />
            </label>
            <label>
              終了日
              <input type="date" name="endDate" defaultValue={defaultDate} required />
            </label>
          </div>

          <div className={styles.weekdayTemplateWrap}>
            <p className={styles.meta}>曜日ごとに開始・終了時刻、または部活なしを設定してください。</p>
            <table className={styles.weekdayTemplateTable}>
              <thead>
                <tr>
                  <th>曜日</th>
                  <th>開始時刻</th>
                  <th>終了時刻 (任意)</th>
                  <th>部活なし</th>
                </tr>
              </thead>
              <tbody>
                {weekdayRows.map((row) => (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    <td>
                      <input type="time" name={`${row.key}StartTime`} step={300} defaultValue={row.startTime} />
                    </td>
                    <td>
                      <input type="time" name={`${row.key}EndTime`} step={300} defaultValue={row.endTime} />
                    </td>
                    <td>
                      <label className={styles.inlineCheckboxLabel}>
                        <input type="checkbox" name={`${row.key}Off`} value="1" />
                        なし
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button type="submit">デフォルト設定で予定作成</button>
        </form>
      </section>
    </main>
  );
}
