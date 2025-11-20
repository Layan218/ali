"use client";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import styles from "./slides.module.css";

type TemplateCard = {
  id: string;
  title: string;
  subtitle?: string;
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
  { id: "blank", title: "Blank presentation", accent: "var(--accent-orange)" },
  { id: "idea", title: "Your big idea", subtitle: "by Made to Stick", accent: "var(--accent-red)" },
  { id: "album", title: "Photo album", accent: "var(--accent-sky)" },
  { id: "wedding", title: "Wedding", accent: "var(--accent-lilac)" },
  { id: "portfolio", title: "Portfolio", accent: "var(--accent-slate)" },
  { id: "lookbook", title: "Lookbook", accent: "var(--accent-green)" },
];

// Recent presentations will be loaded from Firestore/localStorage dynamically
const recents: RecentPresentation[] = [];

export default function SlidesHome() {
  const { theme, toggleTheme } = useTheme();
  const { user, loading } = useAuth();
  const router = useRouter();

  const handleTemplateSelect = (template: TemplateCard) => {
    if (template.id === "blank") {
      router.push("/slide-editor");
    }
  };

  return (
    <>
      {/* Top Navigation - Same as Home page */}
      <nav className={styles.nav}>
        <div className={styles.logoWrap}>
          <img src="/aramco-digital.png" alt="Aramco Digital" className={styles.logo} />
        </div>
        <div className={styles.navLinks} />
        <div className={styles.topRightActions}>
          <button
            type="button"
            aria-label="Toggle dark mode"
            onClick={toggleTheme}
            className={styles.themeToggle}
          >
            {theme === "dark" ? (
              <svg className={`${styles.icon} ${styles.iconSpin}`} width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg className={`${styles.icon} ${styles.iconSpin}`} width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" stroke="currentColor" strokeWidth="1.8" fill="none"/>
              </svg>
            )}
          </button>
          {!loading && !user ? (
            <button className={styles.primary} type="button" onClick={() => router.push("/login")}>
              Sign in
            </button>
          ) : null}
          {!loading && user ? (
            <button
              className={styles.secondary}
              type="button"
              onClick={async () => {
                await signOut(auth);
                router.push("/login");
              }}
            >
              Sign out
            </button>
          ) : null}
        </div>
      </nav>

      <div className={styles.page}>
        <header className={styles.headerBar}>
          <h1 className={styles.heading}>Slides</h1>
          <div className={styles.searchWrap}>
            <input className={styles.searchInput} placeholder="Search presentations" aria-label="Search presentations" />
          </div>
          <button className={styles.newButton} type="button">Start new</button>
        </header>

        <main className={styles.content}>
          <section className={styles.templatesSection}>
            <div className={styles.sectionHeader}>
              <h2>Home</h2>
              <button className={styles.templateGallery} type="button">Template gallery ▾</button>
            </div>
            <div className={styles.templateRow}>
              {templates.map((template) => {
                const isInteractive = template.id === "blank";
                return (
                  <article
                    key={template.id}
                    className={styles.templateCard}
                    onClick={isInteractive ? () => handleTemplateSelect(template) : undefined}
                    onKeyDown={
                      isInteractive
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              handleTemplateSelect(template);
                            }
                          }
                        : undefined
                    }
                    role={isInteractive ? "button" : undefined}
                    tabIndex={isInteractive ? 0 : undefined}
                  >
                  <div
                    className={styles.templateThumb}
                    style={{ background: template.accent }}
                    aria-hidden
                  />
                  <h3>{template.title}</h3>
                    {template.subtitle ? <p>{template.subtitle}</p> : null}
                </article>
                );
              })}
            </div>
          </section>

          <section className={styles.recentsSection}>
            <div className={styles.recentsHeader}>
              <h2>Recent presentations</h2>
              <div className={styles.recentsControls}>
                <button className={styles.controlButton} type="button">Owned by anyone ▾</button>
                <div className={styles.viewControls}>
                  <button className={styles.iconButton} aria-label="Grid view" type="button">▦</button>
                  <button className={styles.iconButton} aria-label="List view" type="button">☰</button>
                  <button className={styles.iconButton} aria-label="Sort" type="button">A⋁</button>
                </div>
              </div>
            </div>

            <div className={styles.recentGrid}>
              {recents.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "#5f6368", gridColumn: "1 / -1" }}>
                  No recent presentations. Create a presentation to see it here.
                </div>
              ) : (
                recents.map((item) => (
                <article key={item.id} className={styles.recentCard}>
                  <div className={styles.recentThumb} style={{ background: item.thumbAccent }}>
                    <span className={styles.fileBadge}>{item.type ?? "P"}</span>
                  </div>
                  <div className={styles.recentMeta}>
                    <h3>{item.title}</h3>
                    <p>{item.date}</p>
                    {item.shared ? <span className={styles.sharedLabel}>Shared with you</span> : null}
                  </div>
                  <button className={styles.cardMenu} type="button" aria-label="More actions">⋮</button>
                </article>
                ))
              )}
            </div>
          </section>
        </main>

        {/* Footer - Same as Home page */}
        <footer className={styles.footer}>
          © 2025 Aramco Digital - Secure Presentation Tool
        </footer>
      </div>
    </>
  );
}


