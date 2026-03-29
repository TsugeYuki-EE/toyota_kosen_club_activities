import Image from "next/image";
import { LoadingCredit } from "@/components/loading-credit";
import styles from "./loading.module.css";

export default function Loading() {
  return (
    <>
      <main className={styles.loadingPage} aria-live="polite" aria-busy="true">
        <section className={styles.loadingCard} role="status" aria-label="ページを読み込み中です">
          <Image src="/table-tennis-logo.svg" alt="卓球部ロゴ" width={64} height={64} className={styles.logo} priority />
          <h1 className={styles.brandTitle}>TOYOTA_KOSEN TABLE TENNIS NOTES</h1>
          <div className={styles.spinner} aria-hidden="true" />
          <p className={styles.label}>読み込み中...</p>
        </section>
      </main>
      <LoadingCredit />
    </>
  );
}
