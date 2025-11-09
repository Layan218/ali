"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import TeamChatWidget from "@/components/TeamChatWidget";
import styles from "./audit-log.module.css";
import { useRouter } from "next/navigation";

type LogEntry = {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
};

const logEntries: LogEntry[] = [
  {
    id: "log-1",
    timestamp: "2025-06-17 12:30",
    user: "reem.saad",
    action: "Edited slide",
    details: "Updated title for Q2 Strategy Briefing",
  },
  {
    id: "log-2",
    timestamp: "2025-06-17 12:10",
    user: "r.alqahtani",
    action: "Viewed presentation",
    details: "Opened in Presentation Mode",
  },
  {
    id: "log-3",
    timestamp: "2025-06-17 11:45",
    user: "l.fernandez",
    action: "Commented",
    details: "Added note on maintenance backlog",
  },
];

export default function AuditLogPage() {
  const [isDark, setIsDark] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldDark = saved ? saved === "dark" : prefersDark;
    setIsDark(shouldDark);
    if (shouldDark) document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark((value) => !value);

  return (
    <>
      <nav className={styles.nav}>
        <div className={styles.logoWrap}>
          <img src="/aramco-digital.png" alt="Aramco Digital" className={styles.logo} />
          <div className={styles.navLinks}>
            <Link
              href="/presentations"
              className={`${styles.navLink} ${pathname === "/presentations" ? styles.navLinkActive : ""}`}
            >
              Slides
            </Link>
            <Link
              href="/audit-log"
              className={`${styles.navLink} ${pathname === "/audit-log" ? styles.navLinkActive : ""}`}
            >
              Audit Log
            </Link>
          </div>
        </div>
        <div className={styles.topRightActions}>
          <button
            type="button"
            aria-label="Toggle dark mode"
            onClick={toggleTheme}
            className={styles.themeToggle}
          >
            {isDark ? (
              <svg
                className={`${styles.icon} ${styles.iconSpin}`}
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg
                className={`${styles.icon} ${styles.iconSpin}`}
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  fill="none"
                />
              </svg>
            )}
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={() => router.push("/presentations")}
          >
            Slides Home
          </button>
          <a className={styles.secondary} href="/">
            Back to Home
          </a>
        </div>
      </nav>

      <main className={styles.main}>
        <div className={styles.container}>
          <header className={styles.pageHeader}>
            <h1 className={styles.title}>Activity Logs</h1>
            <p className={styles.subtitle}>
              Track recent edits, views, and presentation activity across your slides.
            </p>
          </header>

          <section className={styles.logsCard}>
            <div className={styles.cardHeader}>
              <h2>Recent activity</h2>
              <span className={styles.entryCount}>{logEntries.length} entries</span>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col" className={styles.tableHeaderCell}>
                      Date &amp; Time
                    </th>
                    <th scope="col" className={styles.tableHeaderCell}>
                      User
                    </th>
                    <th scope="col" className={styles.tableHeaderCell}>
                      Action
                    </th>
                    <th scope="col" className={styles.tableHeaderCell}>
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className={styles.tableBody}>
                  {logEntries.map((entry) => (
                    <tr key={entry.id} className={styles.tableBodyRow}>
                      <td className={styles.tableBodyCell}>{entry.timestamp}</td>
                      <td className={styles.tableBodyCell}>{entry.user}</td>
                      <td className={styles.tableBodyCell}>{entry.action}</td>
                      <td className={styles.tableBodyCell}>{entry.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      <footer className={styles.footer}>© 2025 Aramco Digital – Secure Presentation Tool</footer>

      <TeamChatWidget />
    </>
  );
}
