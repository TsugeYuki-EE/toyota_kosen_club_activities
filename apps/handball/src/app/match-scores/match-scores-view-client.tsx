"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatDateTime } from "@/lib/date-format";
import styles from "./match-scores.module.css";

type MatchScoresViewProps = {
  matches: Array<{
    id: string;
    opponent: string;
    ourScore: number;
    theirScore: number;
    matchDate: Date;
  }>;
};

export function MatchScoresView({ matches }: MatchScoresViewProps) {
  // 新しいものが上になるように降順でソート
  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime());
  }, [matches]);

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>対戦相手</th>
            <th>スコア</th>
            <th>日時</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {sortedMatches.map((match) => (
            <tr key={match.id}>
              <td>{match.opponent}</td>
              <td>{`${match.ourScore} - ${match.theirScore}`}</td>
              <td>{formatDateTime(new Date(match.matchDate))}</td>
              <td>
                <Link href={`/match-scores/${match.id}`} className={styles.button}>
                  結果を見る
                </Link>
              </td>
            </tr>
          ))}
          {sortedMatches.length === 0 ? (
            <tr>
              <td colSpan={4} className={styles.empty}>試合データがまだありません。</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
