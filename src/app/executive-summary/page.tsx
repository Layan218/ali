"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import TeamChatWidget from "@/components/TeamChatWidget";
import styles from "./executive-summary.module.css";

type SummaryStat = {
  id: string;
  label: string;
  value: string;
};

type PresentationRow = {
  id: string;
  title: string;
  owner: string;
  lastUpdated: string;
  status: "Draft" | "Final";
  comments: number;
};

const summaryStats: SummaryStat[] = [
  { id: "stat-total", label: "Total Presentations", value: "6" },
  { id: "stat-draft", label: "Draft Presentations", value: "2" },
  { id: "stat-final", label: "Final Presentations", value: "4" },
];

const presentations: PresentationRow[] = [
  {
    id: "pres-1",
    title: "Q2 Strategy Briefing",
    owner: "R. Al-Qahtani",
    lastUpdated: "17 Jun 2025",
    status: "Final",
    comments: 5,
  },
  {
    id: "pres-2",
    title: "Operations Review – Q3",
    owner: "Reem S.",
    lastUpdated: "16 Jun 2025",
    status: "Draft",
    comments: 3,
  },
  {
    id: "pres-3",
    title: "Security Posture Update",
    owner: "O. Khalid",
    lastUpdated: "15 Jun 2025",
    status: "Final",
    comments: 4,
  },
];

export default function ExecutiveSummaryPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);

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
              <svg className={`${styles.icon} ${styles.iconSpin}`} width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg className={`${styles.icon} ${styles.iconSpin}`} width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" stroke="currentColor" strokeWidth="1.8" fill="none" />
              </svg>
            )}
          </button>
          <button type="button" className={styles.primary} onClick={() => router.push("/presentations")}>
            Slides Home
          </button>
          <button type="button" className={styles.secondary} onClick={() => router.push("/")}>
            Back to Home
          </button>
        </div>
      </nav>

      <main className={styles.main}>
        <div className={styles.container}>
          <header className={styles.pageHeader}>
            <h1 className={styles.title}>Executive Summary</h1>
            <p className={styles.subtitle}>High-level overview of all active presentations.</p>
          </header>

          <section className={styles.statsRow}>
            {summaryStats.map((stat) => (
              <article key={stat.id} className={styles.statCard}>
                <span className={styles.statLabel}>{stat.label}</span>
                <span className={styles.statValue}>{stat.value}</span>
              </article>
            ))}
          </section>

          <section className={styles.tableCard}>
            <header className={styles.tableHeader}>
              <h2>Presentation Overview</h2>
            </header>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Presentation Title</th>
                    <th>Owner</th>
                    <th>Last Updated</th>
                    <th>Status</th>
                    <th>Comments</th>
                  </tr>
                </thead>
                <tbody>
                  {presentations.map((presentation) => (
                    <tr key={presentation.id}>
                      <td>{presentation.title}</td>
                      <td>{presentation.owner}</td>
                      <td>{presentation.lastUpdated}</td>
                      <td>
                        <span
                          className={`${styles.statusBadge} ${
                            presentation.status === "Final" ? styles.statusFinal : styles.statusDraft
                          }`}
                        >
                          {presentation.status}
                        </span>
                      </td>
                      <td>{presentation.comments}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className={styles.actionsRow}>
            <button type="button" className={styles.ghostButton} onClick={() => router.push("/dashboard")}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </main>

      <footer className={styles.footer}>© 2025 Aramco Digital – Secure Presentation Tool</footer>

      <TeamChatWidget />
    </>
  );
}
