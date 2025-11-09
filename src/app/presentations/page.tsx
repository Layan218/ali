"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TeamChatWidget from "@/components/TeamChatWidget";
import styles from "./presentations.module.css";

type PresentationRecord = {
  presentationId: string;
  title: string;
  owner: string;
  lastUpdated: string;
  status: "Draft" | "Final";
  slides: Array<{ id: string; title: string; subtitle: string }>;
};

type TemplateCard = {
  id: string;
  title: string;
  accent: string;
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
  { id: "template-blank", title: "Blank presentation", accent: "var(--accent-orange)" },
  { id: "template-team-update", title: "Team update", accent: "var(--accent-red)" },
  { id: "template-project-review", title: "Project review", accent: "var(--accent-sky)" },
  { id: "template-training", title: "Training deck", accent: "var(--accent-lilac)" },
  { id: "template-executive", title: "Executive summary", accent: "var(--accent-slate)" },
];

const defaultRecents: RecentPresentation[] = [
  {
    id: "presentation-deep-learning",
    title: "Lab Manual: Introduction to Deep Learning",
    date: "18 Jun 2025",
    thumbAccent: "linear-gradient(135deg, #79c7d9, #e1f3fb)",
    type: "P",
  },
  {
    id: "presentation-dbms",
    title: "Advanced Coding & Databases for AI & Data Science",
    date: "15 Dec 2024",
    thumbAccent: "linear-gradient(135deg, #76d6b4, #e9f7f0)",
    shared: true,
    type: "G",
  },
  {
    id: "presentation-ai-marketing",
    title: "AI in Marketing Presentation",
    date: "Opened 4 Oct 2024",
    thumbAccent: "linear-gradient(135deg, #7f96ff, #e2e7ff)",
    type: "P",
  },
];

const STORAGE_KEY = "presentationsData";

export default function PresentationsHome() {
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);
  const [recentCards, setRecentCards] = useState<RecentPresentation[]>(defaultRecents);

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
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as PresentationRecord[];
      if (!Array.isArray(parsed)) return;
      const mapped = parsed.map((presentation) => ({
        id: presentation.presentationId,
        title: presentation.title || "Untitled presentation",
        date: new Date(presentation.lastUpdated).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        thumbAccent: "linear-gradient(135deg, #7ccba2, #e2f7ec)",
        type: "P",
      }));
      setRecentCards((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        const filtered = mapped.filter((item) => !existingIds.has(item.id));
        return [...filtered, ...prev];
      });
    } catch (error) {
      console.error("Failed to parse presentations from storage", error);
    }
  }, []);

  const toggleTheme = () => setIsDark((value) => !value);

  const goToPresentation = (presentationId: string) => {
    router.push(`/editor?presentationId=${encodeURIComponent(presentationId)}&slideId=slide-1`);
  };

  const handleBlankClick = () => {
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

    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as PresentationRecord[]) : [];
        const nextData = Array.isArray(parsed) ? [...parsed, newPresentation] : [newPresentation];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
      } catch (error) {
        console.error("Failed to persist new presentation", error);
      }
    }

    const displayDate = now.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    setRecentCards((prev) => [
      {
        id: presentationId,
        title: newPresentation.title,
        date: displayDate,
        thumbAccent: "linear-gradient(135deg, #7ccba2, #e2f7ec)",
        type: "P",
      },
      ...prev,
    ]);

    router.push(`/editor?presentationId=${encodeURIComponent(presentationId)}&slideId=slide-1`);
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
          <button className={styles.newButton} type="button" onClick={() => goToPresentation("new-presentation")}>
            Start new
          </button>
        </header>

        <main className={styles.content}>
          <section className={styles.templatesSection}>
            <div className={styles.sectionHeader}>
              <h2>Start a new presentation</h2>
            </div>
            <div className={styles.templateRow}>
              {templates.map((template) => (
                <article
                  key={template.id}
                  className={styles.templateCard}
                  onClick={
                    template.id === "template-blank"
                      ? handleBlankClick
                      : template.id === "template-team-update"
                      ? handleTeamUpdateClick
                      : template.id === "template-training"
                      ? handleTrainingClick
                      : template.id === "template-executive"
                      ? handleExecutiveSummaryClick
                      : () => goToPresentation(template.id)
                  }
                >
                  <div className={styles.templateThumb} style={{ background: template.accent }} aria-hidden />
                  <h3>{template.title}</h3>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.recentsSection}>
            <div className={styles.recentsHeader}>
              <h2>Recent presentations</h2>
            </div>

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
          </section>
        </main>

        <TeamChatWidget />

        <footer className={styles.footer}>© 2025 Aramco Digital - Secure Presentation Tool</footer>
      </div>
    </>
  );
}
