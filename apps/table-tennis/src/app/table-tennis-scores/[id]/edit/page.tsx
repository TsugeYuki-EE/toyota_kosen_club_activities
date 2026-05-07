'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "@/app/home-dashboard.module.css";

export default function EditTableTennisScorePage({ params }: { params: Promise<{ id: string }> }) {
  const [sheet, setSheet] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [matchDate, setMatchDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { id } = await params;
        const res = await fetch(`/api/table-tennis-scores/${id}`);
        if (!res.ok) throw new Error('データ取得に失敗しました');
        const data = await res.json();
        setSheet(data.sheet);
        setEntries(data.sheet.entries);
        
        // Convert UTC Date to local datetime-local string
        const utcDate = new Date(data.sheet.matchDate);
        const localStr = new Date(utcDate.getTime() - utcDate.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setMatchDate(localStr);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [params]);

  if (loading) return <main className={styles.page}><p>読み込み中...</p></main>;
  if (error) return <main className={styles.page}><p className={styles.error}>エラー: {error}</p></main>;
  if (!sheet) return <main className={styles.page}><p>データが見つかりません</p></main>;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>試合結果を編集</h1>
        <p>以下の項目を編集して提出してください。</p>
      </header>

      <nav className={styles.nav}>
        <Link href={`/table-tennis-scores/${sheet.id}`} className={styles.secondaryLink}>詳細ページに戻る</Link>
        <Link href="/table-tennis-scores" className={styles.secondaryLink}>試合結果一覧へ戻る</Link>
      </nav>

      <section className={styles.grid}>
        <article className={styles.card}>
          <form onSubmit={async (e) => {
            e.preventDefault();
            
            const res = await fetch(`/api/table-tennis-scores/${sheet.id}/update`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sheetId: sheet.id,
                opponent: (e.currentTarget.elements.namedItem('opponent') as HTMLInputElement).value,
                matchDate: matchDate + "Z",
                comment: (e.currentTarget.elements.namedItem('comment') as HTMLTextAreaElement).value,
                entries,
              }),
            });
            
            if (res.ok) {
              window.location.href = '/table-tennis-scores';
            } else {
              const data = await res.json();
              alert(data.error || '更新に失敗しました');
            }
          }}>
            <div className={styles.formGroup}>
              <label className={styles.label}>対戦相手</label>
              <input
                type="text"
                className={styles.input}
                name="opponent"
                defaultValue={sheet.opponent}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>試合日時</label>
              <input
                type="datetime-local"
                className={styles.input}
                name="matchDate"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>コメント</label>
              <textarea
                className={styles.textarea}
                name="comment"
                rows={3}
              >{sheet.comment}</textarea>
            </div>

            <h3 className={styles.sectionTitle}>各セットのスコア</h3>

            {entries.map((entry: any) => (
              <div key={entry.id} className={styles.setCard}>
                <h4 className={styles.setLabel}>第{entry.setNumber}セット</h4>
                
                <div className={styles.scoreRow}>
                  <div className={styles.scoreInput}>
                    <label className={styles.label}>私たち</label>
                    <input
                      type="number"
                      className={styles.input}
                      name={`entry_${entry.id}_ourScore`}
                      value={entry.ourScore}
                      onChange={(e) => {
                        const newEntries = entries.map((item: any) => 
                          item.id === entry.id ? { ...item, ourScore: parseInt(e.target.value) || 0 } : item
                        );
                        setEntries(newEntries);
                      }}
                      min="0"
                      max="30"
                      placeholder="空でも可"
                    />
                  </div>
                  <span className={styles.scoreSeparator}>-</span>
                  <div className={styles.scoreInput}>
                    <label className={styles.label}>相手</label>
                    <input
                      type="number"
                      className={styles.input}
                      name={`entry_${entry.id}_theirScore`}
                      value={entry.theirScore}
                      onChange={(e) => {
                        const newEntries = entries.map((item: any) => 
                          item.id === entry.id ? { ...item, theirScore: parseInt(e.target.value) || 0 } : item
                        );
                        setEntries(newEntries);
                      }}
                      min="0"
                      max="30"
                      placeholder="空でも可"
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>セットコメント（任意）</label>
                  <input
                    type="text"
                    className={styles.input}
                    name={`entry_${entry.id}_comment`}
                    value={entry.comment || ""}
                    onChange={(e) => {
                      const newEntries = entries.map((item: any) => 
                        item.id === entry.id ? { ...item, comment: e.target.value } : item
                      );
                      setEntries(newEntries);
                    }}
                    placeholder="セットのコメント"
                  />
                </div>
              </div>
            ))}

            <button type="submit" className={styles.button}>
              更新
            </button>
          </form>

          <form action={`/table-tennis-scores/${sheet.id}/delete`} method="DELETE" className={styles.deleteForm} onSubmit={(e) => { e.preventDefault(); if (!confirm("本当に削除しますか？")) return; fetch(`/table-tennis-scores/${sheet.id}/delete`, { method: 'DELETE' }).then(() => { window.location.href = '/table-tennis-scores'; }); }}>
            <button type="submit" className={styles.deleteButton}>
              削除
            </button>
          </form>
        </article>
      </section>
    </main>
  );
}