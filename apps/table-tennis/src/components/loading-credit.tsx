import styles from "./loading-credit.module.css";
import { SiteCredit } from "@/components/site-credit";

export function LoadingCredit() {
  return (
    <footer className={styles.creditWrap} aria-label="クレジット表記">
      <p className={styles.creditText}>
        <SiteCredit />
      </p>
    </footer>
  );
}
