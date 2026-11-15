/* eslint-disable @next/next/no-img-element */
import styles from "./KioskHeader.module.css";

export default function KioskHeader({ left, right }) {
  return (
    <header className={styles.header}>
      <div className={styles.side}>{left}</div>
      <div className={styles.brand}>
        <img src="/brand/bean.png" alt="" className={styles.bean} />
        <img src="/brand/wordmark.png" alt="Coffee Palace" className={styles.wordmark} />
      </div>
      <div className={`${styles.side} ${styles.right}`}>{right}</div>
    </header>
  );
}
