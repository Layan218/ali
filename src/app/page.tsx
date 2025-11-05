import styles from "./page.module.css";

export default function Home() {
  return (
    <>
      <div className={styles.logoWrap}>
        <img src="/aramco-digital.png" alt="Aramco Digital" className={styles.logo} />
      </div>
      <div className={styles.topRightActions}>
        <a className={styles.primary} href="#">Try Work Presentation</a>
        <a className={styles.secondary} href="/login">Sign in</a>
      </div>
      <main className={styles.hero}>
        <div className={styles.centered}>
          <h1 className={styles.title} style={{ fontFamily: "Calibri, Arial, Helvetica, sans-serif" }}>Secure Presentation Tool</h1>
          <p className={styles.description}>
            You can create and present professional presentations directly in your browser, from anywhere, with no installation required — exclusively for Aramco Digital.
          </p>
          <div className={styles.actions}>
            <a className={styles.primary} href="#">Try Work Presentation</a>
            <a className={styles.secondary} href="/login">Sign in</a>
          </div>
        </div>
      </main>
      <div className={styles.waveContainer} style={{ marginTop: 80 }}>
        <img src="/curve-wave-seamless-pattern-thin-260nw-2293479067.jpg-removebg-preview.png" alt="Decorative wave" className={styles.wave} />
      </div>
      <footer style={{ background: "#ffffff", color: "#555555", textAlign: "center", padding: 16, fontFamily: "Calibri, Arial, Helvetica, sans-serif" }}>
        © 2025 Aramco Digital - Secure Presentation Tool
      </footer>
    </>
  );
}
