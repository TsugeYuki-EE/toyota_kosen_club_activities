import Link from "next/link";
import { getAuthorizedAdminMember } from "@/lib/admin-access";
import { toDateKey } from "@/lib/date-format";
import { LocalDateTime } from "@/components/local-date-time";
import { prisma } from "@/lib/prisma";
import { sortMembersByGradeAscending } from "@/lib/member-sort";
import styles from "../../admin-dashboard.module.css";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    error?: string;
    ok?: string;
  }>;
};

export default async function ManagerWeightBulkPage({ searchParams }: PageProps) {
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

  const membersRaw = await prisma.member.findMany({
    select: {
      id: true,
      name: true,
      nickname: true,
      grade: true,
      role: true,
      weights: {
        orderBy: { submittedAt: "desc" },
        take: 1,
        select: {
          id: true,
          weightKg: true,
          submittedAt: true,
        },
      },
    },
  });

  const members = sortMembersByGradeAscending(membersRaw);
  const todayKey = toDateKey(new Date());

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>体重一括入力</h1>
        <p>部員ごとに体重を入力・保存し、最新データの削除も行えます。</p>
        <div className={styles.topLinks}>
          <Link className={styles.linkButton} href="/admin/manager">
            マネージャー画面へ戻る
          </Link>
          <Link className={styles.secondaryLink} href="/admin">
            管理画面へ戻る
          </Link>
        </div>
      </header>

      {params.error ? <p className={styles.error}>エラー: {params.error}</p> : null}
      {params.ok ? <p className={styles.ok}>保存しました: {params.ok}</p> : null}

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2>部員一覧 (体重入力用)</h2>
            <p className={styles.meta}>テキストボックスに体重を入力して保存してください。</p>
          </div>
        </div>

        <div className={styles.memberTableWrap}>
          <table className={styles.memberTable}>
            <thead>
              <tr>
                <th>ニックネーム</th>
                <th>学年</th>
                <th>最新体重</th>
                <th>入力</th>
                <th>保存</th>
                <th>最新削除</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const latest = member.weights[0] ?? null;
                const defaultWeight = latest ? latest.weightKg.toFixed(1) : "";
                const formId = `weight-form-${member.id}`;
                const isLatestWeightToday = latest ? toDateKey(latest.submittedAt) === todayKey : false;

                return (
                  <tr key={member.id}>
                    <td>
                      <Link className={styles.memberLink} href={`/admin/members/${member.id}`}>
                        {member.nickname || member.name}
                      </Link>
                    </td>
                    <td>{member.grade || "-"}</td>
                    <td>
                      {latest ? (
                        <span className={isLatestWeightToday ? styles.todayWeightHighlight : undefined}>
                          {latest.weightKg.toFixed(1)}kg (<LocalDateTime value={latest.submittedAt} />)
                        </span>
                      ) : "未登録"}
                    </td>
                    <td>
                      <form id={formId} action="/api/admin-weights" method="post" className={styles.inlineForm}>
                        <input type="hidden" name="intent" value="create" />
                        <input type="hidden" name="memberId" value={member.id} />
                        <input type="hidden" name="redirectTo" value="/admin/manager/weights" />
                        <input
                          className={styles.tableNumberInput}
                          type="number"
                          name="weightKg"
                          min="0"
                          step="0.1"
                          inputMode="decimal"
                          placeholder="例: 68.5"
                          defaultValue={defaultWeight}
                          required
                        />
                      </form>
                    </td>
                    <td>
                      <button type="submit" form={formId} className={styles.tableLinkButton}>保存</button>
                    </td>
                    <td>
                      <form action="/api/admin-weights" method="post" className={styles.inlineForm}>
                        <input type="hidden" name="intent" value="delete-latest" />
                        <input type="hidden" name="memberId" value={member.id} />
                        <input type="hidden" name="redirectTo" value="/admin/manager/weights" />
                        <button type="submit" className={styles.dangerButton} disabled={!latest}>最新データ削除</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {members.length === 0 ? (
                <tr>
                  <td colSpan={6}>部員データがありません。</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
