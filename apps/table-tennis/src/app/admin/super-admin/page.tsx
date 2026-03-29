import Link from "next/link";
import { getAuthorizedAdminMember, isSuperAdminNickname } from "@/lib/admin-access";
import { addJstDays, nowInJst, toDateTimeLocalValue } from "@/lib/date-format";
import { LocalDateTime } from "@/components/local-date-time";
import { prisma } from "@/lib/prisma";
import styles from "../admin-dashboard.module.css";

export const dynamic = "force-dynamic";

type SuperAdminPageProps = {
  searchParams: Promise<{
    error?: string;
    ok?: string;
  }>;
};

export default async function SuperAdminPage({ searchParams }: SuperAdminPageProps) {
  const params = await searchParams;
  const adminMember = await getAuthorizedAdminMember();

  if (!adminMember) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>管理画面へのアクセス権限がありません</h1>
          <p>役職が管理者・コーチ・マネージャーのユーザーのみ利用できます。</p>
          <Link className={styles.linkButton} href="/">
            トップへ戻る
          </Link>
        </section>
      </main>
    );
  }

  if (!isSuperAdminNickname(adminMember.nickname)) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>このページは admin ユーザーのみ閲覧できます</h1>
          <p>admin 専用機能を利用するには、ユーザー名が admin のアカウントでログインしてください。</p>
          <Link className={styles.linkButton} href="/admin">
            管理画面へ戻る
          </Link>
        </section>
      </main>
    );
  }

  const now = nowInJst();
  const nextWeek = addJstDays(now, 7);
  const defaultAnnouncementStart = toDateTimeLocalValue(now);
  const defaultAnnouncementEnd = toDateTimeLocalValue(nextWeek);

  const announcements = await prisma.adminAnnouncement.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      message: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
    },
  });

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>admin 専用画面</h1>
        <p>admin のみが利用できる機能をここに集約しています。</p>
        <div className={styles.topLinks}>
          <Link className={styles.linkButton} href="/admin">
            管理画面へ戻る
          </Link>
        </div>
      </header>

      {params.error ? <p className={styles.error}>エラー: {params.error}</p> : null}
      {params.ok ? <p className={styles.ok}>保存しました: {params.ok}</p> : null}

      <section className={styles.card}>
        <h2>通達メッセージ管理</h2>
        <p className={styles.meta}>指定期間中だけメイン画面上部に赤色ウィンドウで表示されます。</p>
        <form action="/api/admin-announcements" method="post" className={styles.form}>
          <input type="hidden" name="redirectTo" value="/admin/super-admin" />
          <label>
            通達メッセージ
            <textarea name="message" rows={3} maxLength={500} required placeholder="例: 明日の練習は体育館が使えないため、グラウンド集合です。" />
          </label>
          <label>
            表示開始日時
            <input type="datetime-local" name="startsAt" defaultValue={defaultAnnouncementStart} required />
          </label>
          <label>
            表示終了日時
            <input type="datetime-local" name="endsAt" defaultValue={defaultAnnouncementEnd} required />
          </label>
          <button type="submit">通達を登録</button>
        </form>

        <div className={styles.memberTableWrap}>
          <table className={styles.memberTable}>
            <thead>
              <tr>
                <th>通達内容</th>
                <th>表示期間</th>
                <th>登録日時</th>
                <th>削除</th>
              </tr>
            </thead>
            <tbody>
              {announcements.map((announcement) => (
                <tr key={announcement.id}>
                  <td>{announcement.message}</td>
                  <td><LocalDateTime value={announcement.startsAt} /> 〜 <LocalDateTime value={announcement.endsAt} /></td>
                  <td><LocalDateTime value={announcement.createdAt} /></td>
                  <td>
                    <form action="/api/admin-announcements" method="post" className={styles.inlineForm}>
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="redirectTo" value="/admin/super-admin" />
                      <input type="hidden" name="announcementId" value={announcement.id} />
                      <button type="submit" className={styles.dangerButton}>削除</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {announcements.length === 0 ? (
            <p className={styles.notice} style={{ padding: "16px" }}>登録済みの通達はありません。</p>
          ) : null}
        </div>
      </section>

      <section className={styles.card}>
        <h2>リリースノート管理</h2>
        <p className={styles.meta}>アプリのバージョン情報と変更内容を管理します。</p>
        <div className={styles.inlineActions}>
          <Link className={styles.linkButton} href="/admin/release-notes">
            リリースノート管理へ
          </Link>
        </div>
      </section>

      <section className={styles.card}>
        <h2>フィードバック確認</h2>
        <p className={styles.meta}>メイン画面から送信された意見・要望を確認できます。</p>
        <div className={styles.inlineActions}>
          <Link className={styles.linkButton} href="/admin/feedback">
            フィードバック一覧へ
          </Link>
        </div>
      </section>

      <section className={styles.card}>
        <h2>予定の全削除</h2>
        <p className={styles.meta}>すべての出席予定データを削除します。admin ユーザーのみ実行できます。元に戻せません。</p>
        <form action="/api/admin-data/cleanup" method="post" className={styles.form}>
          <input type="hidden" name="intent" value="delete-all-schedules-and-match-scores" />
          <input type="hidden" name="redirectTo" value="/admin/super-admin" />
          <label>
            確認キーワード
            <input
              type="text"
              name="confirmText"
              placeholder="全削除"
              required
            />
          </label>
          <label>
            実行パスワード
            <input
              type="password"
              name="executionPassword"
              placeholder="devdev"
              required
            />
          </label>
          <button type="submit" className={styles.dangerButton}>予定と試合スコアを全削除する</button>
        </form>
      </section>
    </main>
  );
}
