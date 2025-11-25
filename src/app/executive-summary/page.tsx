"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import TeamChatWidget from "@/components/TeamChatWidget";
import ThemeToggle from "@/components/ThemeToggle";
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
  _updatedAt?: Date | null; // Store Date object for sorting
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
