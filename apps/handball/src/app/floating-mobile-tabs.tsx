"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./home-dashboard.module.css";

type FloatingMobileTabsProps = {
  monthQuery: string;
};

const BOTTOM_THRESHOLD_PX = 24;

function isNearBottom(): boolean {
  const documentHeight = document.documentElement.scrollHeight;
  const viewportBottom = window.scrollY + window.innerHeight;
  return viewportBottom >= documentHeight - BOTTOM_THRESHOLD_PX;
}

export function FloatingMobileTabs({ monthQuery }: FloatingMobileTabsProps) {
  const [raised, setRaised] = useState(false);

  useEffect(() => {
    const update = () => setRaised(isNearBottom());

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <nav
      className={`${styles.mobileTabs} ${raised ? styles.mobileTabsRaised : ""}`.trim()}
      aria-label="メイン操作タブ"
    >
      <Link href={`/self/weight${monthQuery}`} className={styles.mobileTab}>体重入力</Link>
      <Link href={`/self/weight-history${monthQuery}`} className={styles.mobileTab}>体重推移</Link>
      <Link href="/match-scores" className={styles.mobileTab}>試合スコア</Link>
      <Link href={`/self/profile${monthQuery}`} className={styles.mobileTab}>プロフィール</Link>
    </nav>
  );
}
