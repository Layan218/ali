"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { logAuditEvent } from "@/lib/audit";
import TeamChatWidget from "@/components/TeamChatWidget";
import styles from "./presentations.module.css";
import {
  readPresentationMeta,
  recordPresentationDraft,
  PRESENTATION_META_UPDATED_EVENT,
  type PresentationMeta,
} from "@/lib/presentationMeta";
import { useAuth } from "@/context/AuthContext";

type TemplateCard = {
  id: string;
  title: string;
  icon: ReactNode;
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
  const { user, loading } = useAuth();
  const [isDark, setIsDark] = useState(false);
  const [presentationMeta, setPresentationMeta] = useState<PresentationMeta[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const savedPresentations = useMemo(
    () => presentationMeta.filter((item) => item.isSaved),
    [presentationMeta]
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setQuery(searchInput);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  const visiblePresentations = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return savedPresentations;
    return savedPresentations.filter((item) => {
      const indexSource =
        item.searchIndex?.toLowerCase() ?? `${item.title ?? ""}`.toLowerCase();
      return indexSource.includes(trimmed);
    });
  }, [query, savedPresentations]);

  const highlightMatch = useCallback(
    (text: string): ReactNode => {
      const trimmed = query.trim();
      if (!trimmed) return text;
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(${escaped})`, "ig");
      const parts = text.split(regex);
      return parts.map((part, index) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <mark key={`${part}-${index}`} className={styles.highlight}>
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        )
      );
    },
    [query]
  );

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

  const refreshPresentationMeta = useCallback(() => {
    setPresentationMeta(readPresentationMeta());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    refreshPresentationMeta();
    const handleMetaUpdate = () => refreshPresentationMeta();
    window.addEventListener(PRESENTATION_META_UPDATED_EVENT, handleMetaUpdate);
    return () => {
      window.removeEventListener(PRESENTATION_META_UPDATED_EVENT, handleMetaUpdate);
    };
  }, [refreshPresentationMeta]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const toggleTheme = () => setIsDark((value) => !value);

  const goToPresentation = (presentationId: string) => {
    router.push(`/editor?presentationId=${encodeURIComponent(presentationId)}&slideId=slide-1`);
  };

  const goToDashboard = (event?: MouseEvent<HTMLElement>) => {
    event?.stopPropagation();
    try {
      localStorage.setItem("pmodeEntry", "dashboard");
    } catch {
      // no-op
    }
    router.push("/dashboard");
  };

  const goToAuditLog = (event?: MouseEvent<HTMLElement>) => {
    event?.stopPropagation();
    router.push("/audit-log");
  };

  const handleTrainingClick = () => {
    router.push("/training-deck");
  };

  const handleExecutiveSummaryClick = async (event?: MouseEvent<HTMLElement>) => {
    event?.stopPropagation();
    let targetPresentationId = savedPresentations[0]?.id;

    if (!targetPresentationId) {
      // Create a draft presentation if none exists
      // Use a timestamp-based ID generated in a callback to avoid render-time impure function
      const timestamp = Date.now();
      const draftId = `presentation-${timestamp}`;
      recordPresentationDraft(draftId, "Untitled presentation");
      targetPresentationId = draftId;
    }

    if (targetPresentationId) {
      router.push(`/slides/${encodeURIComponent(targetPresentationId)}/executive-summary`);
    }
  };

  async function createPresentation(templateName: string) {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      router.push("/login");
      return;
    }

    try {
      const presentationRef = await addDoc(collection(db, "presentations"), {
        ownerId: currentUser.uid,
        title: templateName,
        template: templateName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const presentationId = presentationRef.id;

      await addDoc(collection(db, "presentations", presentationId, "slides"), {
        order: 1,
        title: "Slide 1",
        content: "",
        notes: "",
        theme: "default",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      recordPresentationDraft(presentationId, templateName);

      await logAuditEvent({
        presentationId,
        userId: currentUser.uid,
        userEmail: currentUser.email ?? null,
        action: "CREATE_PRESENTATION",
        details: {
          title: templateName,
          templateName,
        },
      });

      router.push(`/editor?presentationId=${encodeURIComponent(presentationId)}&slideId=slide-1`);
    } catch (error) {
      console.error("Failed to create presentation", error);
    }
  }


  return (
    <>
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
          {!loading && !user ? (
            <button type="button" className={styles.primary} onClick={() => router.push("/login")}>
              Sign in
            </button>
          ) : null}
          {!loading && user ? (
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => router.push("/profile")}
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "#E5F4F1",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: "16px",
                  fontWeight: 500,
                  color: "#2b6a64",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.05)";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "none";
                }}
                aria-label="Profile"
              >
                {(() => {
                  if (!user) return "U";
                  const userRecord = user as Record<string, unknown>;
                  const displayName = typeof userRecord.displayName === "string" ? userRecord.displayName : null;
                  const email = typeof userRecord.email === "string" ? userRecord.email : null;
                  const initial = displayName
                    ? displayName.charAt(0).toUpperCase()
                    : email
                    ? email.charAt(0).toUpperCase()
                    : "U";
                  return initial;
                })()}
              </button>
              <button
                type="button"
                className={styles.secondary}
                onClick={async () => {
                  await signOut(auth);
                  router.push("/login");
                }}
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </nav>

      <div className={styles.page}>
        <header className={styles.headerBar}>
          <div className={styles.searchWrap}>
            <input
              className={styles.searchInput}
              placeholder="Search presentations…"
              aria-label="Search presentations"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
        </header>

        <main className={styles.content}>
          <div className="mb-6">
            <h1 className="text-3xl font-semibold text-gray-900">
              {(() => {
                if (!user) return "Welcome, User";
                const userRecord = user as Record<string, unknown>;
                const displayName = typeof userRecord.displayName === "string" ? userRecord.displayName : null;
                const userEmail = typeof userRecord.email === "string" ? userRecord.email : null;
                return `Welcome, ${displayName || userEmail || "User"}`;
              })()}
            </h1>
            <p className="mt-1 text-lg text-gray-700">
              Secure Presentations
            </p>
          </div>
          <section className={styles.templatesSection}>
            <div className={styles.sectionHeader}>
              <h2>Home</h2>
            </div>
            <div className={styles.templateRow}>
              {templates.map((template) => (
                <article
                  key={template.id}
                  className={styles.templateCard}
                  onClick={(event) => {
                    if (template.id === "template-blank") {
                      void createPresentation("Blank presentation");
                    } else if (template.id === "template-team-update") {
                      goToAuditLog(event);
                    } else if (template.id === "template-project-review") {
                      goToDashboard(event);
                    } else if (template.id === "template-training") {
                      handleTrainingClick();
                    } else if (template.id === "template-executive") {
                      void handleExecutiveSummaryClick(event);
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

          <section className={styles.recentsSection} aria-label="Recent presentations">
            <div className={styles.recentsHeader}>
              <h2>Recent presentations</h2>
            </div>

          {savedPresentations.length === 0 ? (
            <div className={styles.emptyState}>No recent presentations yet.</div>
          ) : visiblePresentations.length === 0 ? (
            <div className={styles.emptyState}>No presentations match your search.</div>
          ) : (
            <div className={styles.recentGrid}>
              {visiblePresentations.map((item) => (
                <article
                  key={item.id}
                  className={styles.recentCard}
                  onClick={() => goToPresentation(item.id)}
                >
                  <div className={styles.recentMeta}>
                    <h3>{highlightMatch(item.title || "Untitled presentation")}</h3>
                    {item.updatedAt ? <p>{item.updatedAt}</p> : null}
                  </div>
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
