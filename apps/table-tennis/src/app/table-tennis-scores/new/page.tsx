'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/home-dashboard.module.css";

interface SetScore {
  ourScore: string;
  theirScore: string;
  winner: string;
  comment: string;
}

export default function NewTableTennisScorePage() {
  const router = useRouter();
  const [opponent, setOpponent] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [sets] = useState<SetScore[]>(
    Array.from({ length: 5 }, () => ({ ourScore: "", theirScore: "", winner: "", comment: "" }))
  );

  const handleSetChange = (index: number, field: keyof SetScore, value: string) => {
    const newSets = [...sets];
    newSets[index] = { ...newSets[index], [field]: value };
    
    // winnerを自動更新
    if (field === "ourScore" || field === "theirScore") {
      const our = parseInt(newSets[index].ourScore) || 0;
      const their = parseInt(newSets[index].theirScore) || 0;
      newSets[index].winner = our > their ? "OUR" : our < their ? "OPPONENT" : "";
    }
    
    sets[index] = newSets[index];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("opponent", opponent);
      formData.append("matchDate", matchDate);
      formData.append("comment", comment);
      sets.forEach((set, index) => {
        formData.append(`set_${index + 1}_ourScore`, set.ourScore);
        formData.append(`set_${index + 1}_theirScore`, set.theirScore);
        formData.append(`set_${index + 1}_winner`, set.winner);
        formData.append(`set_${index + 1}_comment`, set.comment);
      });

      const response = await fetch("/api/table-tennis-scores", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        router.push("/table-tennis-scores");
      } else {
        const error = await response.text();
        alert("エラーが発生しました: " + error);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>新しい試合結果</h1>
      </header>

      <nav className={styles.nav}>
        <a href="/table-tennis-scores" className={styles.secondaryLink}>試合結果一覧へ戻る</a>
      </nav>

      <section className={styles.card}>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.label}>対戦相手</label>
            <input
              type="text"
              className={styles.input}
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>試合日時</label>
            <input
              type="datetime-local"
              className={styles.input}
              value={matchDate}
              onChange={(e) => setMatchDate(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>コメント</label>
            <textarea
              className={styles.textarea}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>

          <h3 className={styles.sectionTitle}>各セットのスコア</h3>

          {sets.map((set, index) => (
            <div key={index} className={styles.setCard}>
              <h4 className={styles.setLabel}>第{index + 1}セット</h4>
              
              <div className={styles.scoreRow}>
                <div className={styles.scoreInput}>
                  <label className={styles.label}>私たち</label>
                  <input
                    type="number"
                    className={styles.input}
                    value={set.ourScore}
                    onChange={(e) => handleSetChange(index, "ourScore", e.target.value)}
                    min="0"
                    required
                  />
                </div>
                <span className={styles.scoreSeparator}>-</span>
                <div className={styles.scoreInput}>
                  <label className={styles.label}>相手</label>
                  <input
                    type="number"
                    className={styles.input}
                    value={set.theirScore}
                    onChange={(e) => handleSetChange(index, "theirScore", e.target.value)}
                    min="0"
                    required
                  />
                </div>
                {set.winner && (
                  <span className={`${styles.winnerBadge} ${set.winner === "OUR" ? styles.ourWin : styles.oppWin}`}>
                    {set.winner === "OUR" ? "私たちの勝ち" : "相手の勝ち"}
                  </span>
                )}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>コメント</label>
                <input
                  type="text"
                  className={styles.input}
                  value={set.comment}
                  onChange={(e) => handleSetChange(index, "comment", e.target.value)}
                  placeholder="セットのコメント（任意）"
                />
              </div>
            </div>
          ))}

          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? "送信中..." : "提出"}
          </button>
        </form>
      </section>
    </main>
  );
}