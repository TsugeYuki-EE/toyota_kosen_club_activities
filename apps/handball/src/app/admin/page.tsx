import Link from "next/link";
import { headers } from "next/headers";
import { getAuthorizedAdminMember, isSuperAdminNickname } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { sortMembersByGradeAscending } from "@/lib/member-sort";
import { AdminMemberTable } from "./admin-member-table";
import styles from "./admin-dashboard.module.css";

const PRODUCTION_APP_FALLBACK_URL = "https://toyota-handball-notes.onrender.com";

function isLocalOnlyOrigin(value: string): boolean {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(value);
}

// 管理画面は最新の登録結果を即座に反映します。
export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams: Promise<{
    error?: string;
    ok?: string;
    newToken?: string;
  }>;
};

// 管理者向けの集約ダッシュボードです。
export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const adminMember = await getAuthorizedAdminMember();
  const headerStore = await headers();

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

  const canManageRoles = true;
  const canManageSuperAdminFeatures = isSuperAdminNickname(adminMember.nickname);

  const membersRaw = await prisma.member.findMany({
    select: {
      id: true,
      name: true,
      nickname: true,
      grade: true,
      role: true,
    },
  });

  const members = sortMembersByGradeAscending(membersRaw);

  const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL || process.env.RENDER_EXTERNAL_URL || "";
  const forwardedProto = headerStore.get("x-forwarded-proto") || "https";
  const forwardedHost = headerStore.get("x-forwarded-host") || headerStore.get("host") || "localhost:3000";
  const appBaseUrl = configuredBaseUrl && !(process.env.NODE_ENV === "production" && isLocalOnlyOrigin(configuredBaseUrl))
    ? configuredBaseUrl.replace(/\/$/, "")
    : process.env.NODE_ENV === "production"
      ? PRODUCTION_APP_FALLBACK_URL
      : `${forwardedProto}://${forwardedHost}`;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>ハンドボール部 管理画面</h1>
        <p>部員/マネージャー/コーチ向けの入力データを一元管理します。</p>
        <div className={styles.topLinks}>
          <Link className={styles.linkButton} href="/">
            メイン画面へ
          </Link>
          <Link className={styles.secondaryLink} href="/">
            部員ホームへ
          </Link>
        </div>
      </header>

      {params.error ? <p className={styles.error}>エラー: {params.error}</p> : null}
      {params.ok ? <p className={styles.ok}>保存しました: {params.ok}</p> : null}
      {params.newToken ? (
        <section className={styles.notice}>
          <p>新しい入力リンクを作成しました。</p>
          <code>{`${appBaseUrl}/l/${params.newToken}`}</code>
        </section>
      ) : null}

      <section className={styles.card}>
        <h2>予定管理</h2>
        <p className={styles.meta}>単体予定作成、複数予定作成、予定削除をまとめて管理します。</p>
        <div className={styles.inlineActions}>
          <Link className={styles.linkButton} href="/admin/events">
            予定管理へ
          </Link>
        </div>
      </section>

      <section className={styles.card}>
        <h2>マネージャーウィンドウ</h2>
        <p className={styles.meta}>部員一覧に加えて、出席率・累計得点・最新体重を表形式で確認できます。</p>
        <div className={styles.inlineActions}>
          <Link className={styles.linkButton} href="/admin/manager">
            マネージャー画面へ
          </Link>
        </div>
      </section>

      {canManageSuperAdminFeatures && (
        <section className={styles.card}>
          <h2>admin 専用機能</h2>
          <p className={styles.meta}>admin ユーザー専用の管理機能は、専用ページに集約しています。</p>
          <div className={styles.inlineActions}>
            <Link className={styles.linkButton} href="/admin/super-admin">
              admin用画面に遷移
            </Link>
          </div>
        </section>
      )}

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2>部員一覧</h2>
            <p className={styles.meta}>ニックネーム、学年、役職を編集できます。</p>
          </div>
        </div>

        <AdminMemberTable members={members} canManageRoles={canManageRoles} />
      </section>

    </main>
  );
}
