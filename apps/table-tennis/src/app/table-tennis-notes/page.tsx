import Link from "next/link";
import { redirect } from "next/navigation";
import { FloatingMobileTabs } from "@/app/floating-mobile-tabs";
import { getSessionMember } from "@/lib/member-session";
import { prisma } from "@/lib/prisma";
import styles from "@/app/home-dashboard.module.css";

type PageProps = {
  searchParams: Promise<{ ok?: string; error?: string }>;
};

export const dynamic = "force-dynamic";

export default async function TableTennisNotesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const member = await getSessionMember();

  if (!member) {
    redirect("/auth");
  }

  const notes = await prisma.tableTennisNote.findMany({
    where: { memberId: member.id },
    orderBy: { noteDateKey: "desc" },
  });

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.card}>
          <h1>卓球ノート</h1>
          <p>練習や試合の気づきを日付ごとに記録できます。</p>
          <div style={{ marginTop: 12 }}>
            <Link href="/table-tennis-notes/today" className={styles.primary}>今日のノートを記入</Link>
          </div>
        </section>

        {sp.ok ? (
          <section className={styles.card} style={{ borderColor: "#2e7d32" }}>
            <p style={{ margin: 0, color: "#2e7d32" }}>
              {sp.ok === "updated" ? "ノートを更新しました。" : sp.ok === "deleted" ? "ノートを削除しました。" : "ノートを保存しました。"}
            </p>
          </section>
        ) : null}

        {sp.error ? (
          <section className={styles.card} style={{ borderColor: "#c62828" }}>
            <p style={{ margin: 0, color: "#c62828" }}>
              {sp.error === "invalid-date" ? "日付形式が不正です。" : sp.error === "invalid-input" ? "内容を入力してください。" : "保存に失敗しました。"}
            </p>
          </section>
        ) : null}

        <section className={styles.card}>
          <h2>ノート一覧</h2>
          {notes.length === 0 ? (
            <p className={styles.muted}>まだノートはありません。まずは今日のノートを書いてみましょう。</p>
          ) : (
            <ul className={styles.list}>
              {notes.map((note: { id: string; noteDateKey: string; content: string }) => (
                <li key={note.id} className={styles.listItem}>
                  <p><strong>{note.noteDateKey}</strong></p>
                  <p style={{ whiteSpace: "pre-wrap" }}>
                    {note.content.slice(0, 120)}{note.content.length > 120 ? "..." : ""}
                  </p>
                  <div>
                    <Link href={`/table-tennis-notes/${note.noteDateKey}`} className={styles.secondary}>見る / 編集</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <FloatingMobileTabs monthQuery="" />
      </main>
    </div>
  );
}
