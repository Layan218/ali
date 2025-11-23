"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import TeamChatWidget from "@/components/TeamChatWidget";
import styles from "./audit-log.module.css";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { useTheme } from "@/hooks/useTheme";

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
  const { theme } = useTheme(); // Initialize theme hook to ensure dark class is applied
  const pathname = usePathname();
  const router = useRouter();

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
          <ThemeToggle />
          <button
            type="button"
            className={styles.primary}
            onClick={() => router.push("/presentations")}
          >
            Slides Home
          </button>
          <Link className={styles.secondary} href="/">
            Back to Home
          </Link>
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
