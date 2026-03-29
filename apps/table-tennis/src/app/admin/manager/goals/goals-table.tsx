"use client";

import { useState, useMemo } from "react";
import styles from "./goals-table.module.css";

type GoalMember = {
  id: string;
  name: string;
  nickname: string | null;
  grade: string | null;
  yearlyGoal: string | null;
  monthlyGoal: string | null;
};

interface GoalsTableProps {
  members: GoalMember[];
}

type SortColumn = "name" | "yearlyGoal" | "monthlyGoal";
type SortDirection = "asc" | "desc";

export function GoalsTable({ members }: GoalsTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sortedMembers = useMemo(() => {
    const sorted = [...members];
    sorted.sort((a, b) => {
      let aValue: string | null = "";
      let bValue: string | null = "";

      switch (sortColumn) {
        case "name":
          aValue = a.name;
          bValue = b.name;
          break;
        case "yearlyGoal":
          aValue = a.yearlyGoal ?? null;
          bValue = b.yearlyGoal ?? null;
          break;
        case "monthlyGoal":
          aValue = a.monthlyGoal ?? null;
          bValue = b.monthlyGoal ?? null;
          break;
      }

      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      const comparison = String(aValue).localeCompare(String(bValue), "ja");
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [members, sortColumn, sortDirection]);

  const getSortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) return " ↕";
    return sortDirection === "asc" ? " ↑" : " ↓";
  };

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>
              <button className={styles.sortButton} onClick={() => handleSort("name")}>
                名前{getSortIndicator("name")}
              </button>
            </th>
            <th>
              <button className={styles.sortButton} onClick={() => handleSort("yearlyGoal")}>
                年間目標{getSortIndicator("yearlyGoal")}
              </button>
            </th>
            <th>
              <button className={styles.sortButton} onClick={() => handleSort("monthlyGoal")}>
                月間目標{getSortIndicator("monthlyGoal")}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedMembers.map((member) => (
            <tr key={member.id}>
              <td>
                <div className={styles.nameCell}>
                  <div className={styles.name}>{member.name}</div>
                  {member.nickname && (
                    <div className={styles.nickname}>({member.nickname})</div>
                  )}
                  {member.grade && (
                    <div className={styles.grade}>{member.grade}</div>
                  )}
                </div>
              </td>
              <td className={styles.goalCell}>
                {member.yearlyGoal ? (
                  <div className={styles.goalText}>{member.yearlyGoal}</div>
                ) : (
                  <div className={styles.emptyGoal}>未設定</div>
                )}
              </td>
              <td className={styles.goalCell}>
                {member.monthlyGoal ? (
                  <div className={styles.goalText}>{member.monthlyGoal}</div>
                ) : (
                  <div className={styles.emptyGoal}>未設定</div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {members.length === 0 && (
        <div className={styles.emptyState}>
          <p>部員情報がありません。</p>
        </div>
      )}
    </div>
  );
}
