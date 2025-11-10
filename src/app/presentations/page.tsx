"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import TeamChatWidget from "@/components/TeamChatWidget";
import styles from "./presentations.module.css";
import {
  type PresentationRecord,
  createPresentation,
  fetchPresentations,
} from "@/lib/mockPresentationsApi";

type TemplateCard = {
  id: string;
  title: string;
  icon: ReactNode;
};

type RecentPresentation = {
  id: string;
  title: string;
  date: string;
  thumbAccent: string;
  shared?: boolean;
  type?: "P" | "G";
};

const templates: TemplateCard[] = [
  {
    id: "template-blank",
    title: "Blank presentation",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    ),
  },
  {
    id: "template-team-update",
    title: "Team update",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="8" cy="10" r="3" />
        <circle cx="16" cy="10" r="3" />
        <path d="M3 19c0-2.5 2-4.5 4.5-4.5h1" />
        <path d="M13.5 14.5h1C17 14.5 19 16.5 19 19" />
      </svg>
    ),
  },
  {
    id: "template-project-review",
    title: "Project review",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 19h16" />
        <path d="M8 19V9" />
        <path d="M12 19v-6" />
        <path d="M16 19v-9" />
        <path d="M7 5h10" />
        <path d="M14 5l2 2" />
        <path d="M14 5l-2 2" />
      </svg>
    ),
  },
  {
    id: "template-training",
    title: "Training deck",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 7h8a4 4 0 0 1 4 4v8H8a4 4 0 0 1-4-4V7z" />
        <path d="M12 3h8v12" />
        <path d="M12 9h4" />
      </svg>
    ),
  },
  {
    id: "template-executive",
    title: "Executive summary",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 4h9l3 3v13H6z" />
        <path d="m9 13 2 2 4-4" />
      </svg>
    ),
  },
];

export default function PresentationsHome() {
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);
  const [recentCards, setRecentCards] = useState<RecentPresentation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    const prefersDark =
      typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
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

  useEffect(() => {
    let cancelled = false;

    const loadPresentations = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const records = await fetchPresentations();
        if (!cancelled) {
          setRecentCards(records.map(mapRecordToCard));
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load presentations", err);
          setError("We couldn’t load your presentations right now. Please try again shortly.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadPresentations();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleTheme = () => setIsDark((value) => !value);

  const goToPresentation = (presentationId: string) => {
    router.push(`/editor?presentationId=${encodeURIComponent(presentationId)}&slideId=slide-1`);
  };

  const handleBlankClick = async () => {
    const presentationId = `presentation-${Date.now()}`;
    const now = new Date();
    const newPresentation: PresentationRecord = {
      presentationId,
      title: "Untitled presentation",
      owner: "Current User",
      lastUpdated: now.toISOString(),
      status: "Draft",
      slides: [
        {
          id: "slide-1",
          title: "Click to add title",
          subtitle: "Click to add subtitle",
        },
      ],
    };

    try {
      await createPresentation(newPresentation);
      setRecentCards((prev) => [mapRecordToCard(newPresentation), ...prev]);
      router.push(`/editor?presentationId=${encodeURIComponent(presentationId)}&slideId=slide-1`);
    } catch (err) {
      console.error("Failed to create presentation", err);
      setError("We couldn’t create your presentation. Please try again.");
    }
  };

  const handleTeamUpdateClick = () => {
    router.push("/audit-log");
  };

  const handleTrainingClick = () => {
    router.push("/training-deck");
  };

  const handleExecutiveSummaryClick = () => {
    router.push("/executive-summary");
  };

  return (
    <>
      <nav className={styles.nav}>
        <div className={styles.logoWrap}>
          <img src="/aramco-digital.png" alt="Aramco Digital" className={styles.logo} />
        </div>
        <div className={styles.navLinks}>
          <button type="button" className={styles.navLink} onClick={() => router.push("/#features")}>Features</button>
          <button type="button" className={styles.navLink} onClick={() => router.push("/#security")}>Security</button>
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
          <button type="button" className={styles.primary} onClick={() => router.push("/login")}>
            Try Work Presentation
          </button>
          <button type="button" className={styles.secondary} onClick={() => router.push("/login")}>
            Sign in
          </button>
        </div>
      </nav>

      <div className={styles.page}>
        <header className={styles.headerBar}>
          <h1 className={styles.heading}>Secure Presentations</h1>
          <div className={styles.searchWrap}>
            <input className={styles.searchInput} placeholder="Search presentations…" aria-label="Search presentations" />
          </div>
        </header>

        <main className={styles.content}>
          <section className={styles.templatesSection}>
            <div className={styles.sectionHeader}>
              <h2>Home</h2>
            </div>
            <div className={styles.templateRow}>
              {templates.map((template) => (
                <article
                  key={template.id}
                  className={styles.templateCard}
                  onClick={() => {
                    if (template.id === "template-blank") {
                      void handleBlankClick();
                    } else if (template.id === "template-team-update") {
                      handleTeamUpdateClick();
                    } else if (template.id === "template-training") {
                      handleTrainingClick();
                    } else if (template.id === "template-executive") {
                      handleExecutiveSummaryClick();
                    } else {
                      goToPresentation(template.id);
                    }
                  }}
                >
                  <div className={styles.templateIcon} aria-hidden="true">
                    {template.icon}
                  </div>
                  <h3>{template.title}</h3>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.recentsSection}>
            <div className={styles.recentsHeader}>
              <h2>Recent presentations</h2>
            </div>

            {isLoading ? (
              <div className={styles.emptyState}>Loading your presentations…</div>
            ) : error ? (
              <div className={styles.emptyState}>{error}</div>
            ) : recentCards.length === 0 ? (
              <div className={styles.emptyState}>You haven’t created any presentations yet.</div>
            ) : (
              <div className={styles.recentGrid}>
                {recentCards.map((item) => (
                  <article
                    key={item.id}
                    className={styles.recentCard}
                    onClick={() => goToPresentation(item.id)}
                  >
                    <div className={styles.recentThumb} style={{ background: item.thumbAccent }}>
                      <span className={styles.fileBadge}>{item.type ?? "P"}</span>
                    </div>
                    <div className={styles.recentMeta}>
                      <h3>{item.title}</h3>
                      <p>{item.date}</p>
                      {item.shared ? <span className={styles.sharedLabel}>Shared with you</span> : null}
                    </div>
                    <button
                      className={styles.cardMenu}
                      type="button"
                      aria-label="More actions"
                      onClick={(event) => {
                        event.stopPropagation();
                        goToPresentation(item.id);
                      }}
                    >
                      ⋮
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </main>

        <TeamChatWidget />

        <footer className={styles.footer}>© 2025 Aramco Digital - Secure Presentation Tool</footer>
      </div>
    </>
  );
}

function mapRecordToCard(record: PresentationRecord): RecentPresentation {
  const displayDate = new Date(record.lastUpdated).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return {
    id: record.presentationId,
    title: record.title || "Untitled presentation",
    date: displayDate,
    thumbAccent: "linear-gradient(135deg, #7ccba2, #e2f7ec)",
    type: "P",
    shared: record.owner !== "Current User" && record.owner !== "You",
  };
}
