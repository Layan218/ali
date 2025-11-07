"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import TeamChatWidget from "@/components/TeamChatWidget";
import styles from "./audit-log.module.css";

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
    timestamp: "22 Aug 2025 • 09:45",
    user: "Layla Nassar",
    action: "Edited slide title",
    details: "Updated slide 3 title to “2026 Roadmap Highlights”.",
  },
  {
    id: "log-2",
    timestamp: "22 Aug 2025 • 09:02",
    user: "Omar Khalid",
    action: "Viewed slideshow",
    details: "Played “Executive Briefing” deck from the editor.",
  },
  {
    id: "log-3",
    timestamp: "22 Aug 2025 • 08:58",
    user: "Leila Al-Hassan",
    action: "Created new presentation",
    details: "Drafted “Q4 Stakeholder Summit” from the Strategy template.",
  },
  {
    id: "log-4",
    timestamp: "21 Aug 2025 • 17:12",
    user: "Priya Singh",
    action: "Added collaborator",
    details: "Shared “AI Adoption Playbook” with maya.a@aramco.com.",
  },
  {
    id: "log-5",
    timestamp: "21 Aug 2025 • 16:41",
    user: "Amir Al-Qahtani",
    action: "Commented on slide",
    details: "Left a note on slide 5: “Add the updated revenue chart here.”",
  },
  {
    id: "log-6",
    timestamp: "21 Aug 2025 • 15:33",
    user: "Layla Nassar",
    action: "Deleted slide",
    details: "Removed duplicate slide 7 from “Board Strategy Deck”.",
  },
  {
    id: "log-7",
    timestamp: "21 Aug 2025 • 14:05",
    user: "Omar Khalid",
    action: "Restored previous version",
    details: "Rolled back slide 2 in “Innovation Roadmap” to the morning revision.",
  },
  {
    id: "log-8",
    timestamp: "21 Aug 2025 • 11:22",
    user: "Priya Singh",
    action: "Exported presentation",
    details: "Downloaded “Cybersecurity Awareness” as PDF for distribution.",
  },
  {
    id: "log-9",
    timestamp: "21 Aug 2025 • 10:47",
    user: "Leila Al-Hassan",
    action: "Updated access",
    details: "Granted view-only access to it.support@aramco.com for “Incident Response Plan”.",
  },
  {
    id: "log-10",
    timestamp: "20 Aug 2025 • 19:15",
    user: "Amir Al-Qahtani",
    action: "Duplicated presentation",
    details: "Copied “Operational Excellence 2025” to create “Ops Excellence – EMEA”.",
  },
  {
    id: "log-11",
    timestamp: "20 Aug 2025 • 18:02",
    user: "Layla Nassar",
    action: "Edited speaker notes",
    details: "Refined closing remarks for slide 12 in “Investor Update”.",
  },
  {
    id: "log-12",
    timestamp: "20 Aug 2025 • 17:26",
    user: "Omar Khalid",
    action: "Applied new theme",
    details: "Switched “Digital Transformation” deck to Aramco Dark theme.",
  },
  {
    id: "log-13",
    timestamp: "20 Aug 2025 • 16:58",
    user: "Priya Singh",
    action: "Published presentation",
    details: "Made “Quarterly Ops Review” available to Leadership workspace.",
  },
];

export default function AuditLogPage() {
  const [isDark, setIsDark] = useState(false);
  const pathname = usePathname();

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
          <a className={styles.primary} href="/slides">
            Slides Home
          </a>
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
