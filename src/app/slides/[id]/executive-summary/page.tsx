"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import TeamChatWidget from "@/components/TeamChatWidget";
import { useTheme } from "@/hooks/useTheme";
import styles from "../../../executive-summary/executive-summary.module.css";

const summaryStats = [
  { id: "stat-total", label: "Total Presentations", value: "6" },
  { id: "stat-draft", label: "Draft Presentations", value: "2" },
  { id: "stat-final", label: "Final Presentations", value: "4" },
] as const;

const presentations = [
  {
    id: "pres-1",
    title: "Q2 Strategy Briefing",
    owner: "R. Al-Qahtani",
    lastUpdated: "17 Jun 2025",
    status: "Final" as const,
    comments: 5,
  },
  {
    id: "pres-2",
    title: "Operations Review – Q3",
    owner: "Reem S.",
    lastUpdated: "16 Jun 2025",
    status: "Draft" as const,
    comments: 3,
  },
  {
    id: "pres-3",
    title: "Security Posture Update",
    owner: "O. Khalid",
    lastUpdated: "15 Jun 2025",
    status: "Final" as const,
    comments: 4,
  },
] as const;

const truncateId = (value: string) => {
  if (!value) return "Unknown";
  if (value.length <= 20) return value;
  return `${value.slice(0, 9)}…${value.slice(-8)}`;
};

export default function SlideExecutiveSummaryPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const params = useParams() as { id?: string } | null;
  const presentationId = params?.id ?? pathname.split("/")[2] ?? "";

  return (
    <div className={styles.wrapper}>
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
            {theme === "dark" ? (
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
            <div>
              <h1 className={styles.title}>Executive Summary</h1>
              <p className={styles.subtitle}>Overview, metrics, and last activity</p>
            </div>
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

        </div>
      </main>

      <footer className={styles.footer}>© 2025 Aramco Digital – Secure Presentation Tool</footer>

      <TeamChatWidget />
    </div>
  );
}
