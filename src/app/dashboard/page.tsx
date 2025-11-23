"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import TeamChatWidget from "@/components/TeamChatWidget";
import ThemeToggle from "@/components/ThemeToggle";
import { useTheme } from "@/hooks/useTheme";
import styles from "./dashboard.module.css";

const VIEWER_RETURN_KEY = "viewer-return-url";

type Slide = {
  id: string;
  title: string;
  updatedAt: string;
  role: "Viewer" | "Editor" | "Owner";
};

type Comment = {
  id: string;
  slideId: string;
  author: string;
  content: string;
  timestamp: string;
};

type AuditLogEntry = {
  id: string;
  actor: string;
  action: "created" | "edited" | "viewed" | "presentation";
  slideTitle: string;
  timestamp: string;
};

const slides: Slide[] = [
  { id: "slide-ops-review", title: "Operations Review – Q3", updatedAt: "5 minutes ago", role: "Editor" },
  { id: "slide-forecast", title: "Demand Forecast 2026", updatedAt: "14 minutes ago", role: "Viewer" },
  { id: "slide-security", title: "Security Posture Update", updatedAt: "1 hour ago", role: "Owner" },
  { id: "slide-innovation", title: "Innovation Lab Showcase", updatedAt: "Yesterday", role: "Editor" },
];

const comments: Comment[] = [
  {
    id: "comment-1",
    slideId: "slide-ops-review",
    author: "R. Al-Qahtani",
    content: "Please refresh the KPI chart with the latest numbers before tomorrow.",
    timestamp: "4 minutes ago",
  },
  {
    id: "comment-2",
    slideId: "slide-ops-review",
    author: "L. Fernandez",
    content: "Added notes on the maintenance backlog—double-check the percentages.",
    timestamp: "18 minutes ago",
  },
  {
    id: "comment-3",
    slideId: "slide-forecast",
    author: "A. Gupta",
    content: "Consider adding a sensitivity analysis for the pricing scenario.",
    timestamp: "30 minutes ago",
  },
  {
    id: "comment-4",
    slideId: "slide-security",
    author: "M. Al-Hassan",
    content: "We need a dedicated slide on zero-trust roadmap milestones.",
    timestamp: "1 hour ago",
  },
];

const auditLog: AuditLogEntry[] = [
  { id: "audit-1", actor: "You", action: "edited", slideTitle: "Operations Review – Q3", timestamp: "Just now" },
  { id: "audit-2", actor: "L. Fernandez", action: "viewed", slideTitle: "Demand Forecast 2026", timestamp: "7 minutes ago" },
  { id: "audit-3", actor: "R. Al-Qahtani", action: "presentation", slideTitle: "Security Posture Update", timestamp: "25 minutes ago" },
  { id: "audit-4", actor: "You", action: "created", slideTitle: "Innovation Lab Showcase", timestamp: "Yesterday" },
];

function describeAction(action: AuditLogEntry["action"]) {
  switch (action) {
    case "created":
      return "created";
    case "edited":
      return "edited";
    case "presentation":
      return "entered presentation mode";
    case "viewed":
    default:
      return "viewed";
  }
}

function DashboardContent() {
  const { theme } = useTheme(); // Initialize theme hook to ensure dark class is applied
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const presentationId = searchParams.get("presentationId") ?? "presentation-deep-learning";
  const [selectedSlideId, setSelectedSlideId] = useState(slides[0]?.id ?? "");
  const selectedSlide = useMemo(
    () => slides.find((slide) => slide.id === selectedSlideId) ?? slides[0] ?? null,
    [selectedSlideId]
  );

  const visibleComments = useMemo(() => {
    if (!selectedSlide) return [] as Comment[];
    return comments.filter((comment) => comment.slideId === selectedSlide.id);
  }, [selectedSlide]);

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
          <button
            type="button"
            className={styles.secondary}
            onClick={() => router.push("/")}
          >
            Back to Home
          </button>
        </div>
      </nav>

      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.dashboard}>
            <header className={styles.header}>
              <div className={styles.headingGroup}>
                <h1 className={styles.heading}>Secure Presentation Dashboard</h1>
                <p className={styles.subheading}>
                  Monitor your slides, collaborate with teammates, and review the latest activity.
                </p>
              </div>
              <button type="button" className={styles.primary}>
                Create New Slide
              </button>
            </header>

            <div className={styles.content}>
              <section id="slides" className={`${styles.slidesSection} ${styles.card}`}>
                <div className={styles.slidesHeader}>
                  <h2>Home</h2>
                </div>

                <div className={styles.slidesTable} role="list">
                  <div className={`${styles.tableRow} ${styles.tableHeaderRow}`}>
                    <div>Title</div>
                    <div>Last Edited</div>
                    <div>Role</div>
                    <div>Actions</div>
                  </div>

                  {slides.length === 0 ? (
                    <div className={styles.emptyState}>You have no slides yet. Click “Create New Slide” to get started.</div>
                  ) : (
                    slides.map((slide) => {
                      const isActive = selectedSlide?.id === slide.id;
                      return (
                        <div
                          key={slide.id}
                          role="listitem"
                          className={`${styles.tableRow} ${isActive ? styles.tableRowActive : ""}`}
                          onClick={() => setSelectedSlideId(slide.id)}
                        >
                          <div className={styles.rowTitle}>
                            <span>{slide.title}</span>
                            <span>ID: {slide.id}</span>
                          </div>
                          <div>{slide.updatedAt}</div>
                          <div>{slide.role}</div>
                          <div className={styles.actions}>
                            <button
                              type="button"
                              className={styles.outlineButton}
                              onClick={(event) => {
                                event.stopPropagation();
                                router.push("/editor?presentationId=slide-ops-review&slideId=slide-1");
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className={styles.ghostButton}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (typeof window !== "undefined") {
                                  window.sessionStorage.setItem(
                                    VIEWER_RETURN_KEY,
                                    `${window.location.pathname}${window.location.search}`
                                  );
                                }
                                router.push("/viewer?presentationId=slide-ops-review&slideId=slide-1");
                              }}
                            >
                              Presentation Mode
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <aside className={`${styles.commentsPanel} ${styles.card}`}>
                <h2>Comments</h2>
                {selectedSlide ? (
                  <p style={{ margin: 0, color: "#5f6368" }}>
                    Viewing feedback for <strong>{selectedSlide.title}</strong>
                  </p>
                ) : null}

                <div className={styles.commentList}>
                  {visibleComments.length === 0 ? (
                    <div className={styles.emptyState} style={{ padding: "20px 12px" }}>
                      No comments yet for this slide.
                    </div>
                  ) : (
                    visibleComments.map((comment) => (
                      <div key={comment.id} className={styles.commentCard}>
                        <div className={styles.commentMeta}>
                          <span>{comment.author}</span>
                          <span>{comment.timestamp}</span>
                        </div>
                        <div className={styles.commentText}>{comment.content}</div>
                      </div>
                    ))
                  )}
                </div>

                <div className={styles.commentComposer}>
                  <textarea placeholder="Leave a quick update for your team…" aria-label="Add a comment" />
                  <button type="button" className={styles.outlineButton}>
                    Add Comment
                  </button>
                </div>
              </aside>
            </div>

            <section id="audit" className={`${styles.auditSection} ${styles.card}`}>
              <h2>Audit Log</h2>
              <ul className={styles.auditList}>
                {auditLog.map((entry) => (
                  <li key={entry.id} className={styles.auditItem}>
                    <div className={styles.auditPrimary}>
                      {entry.actor} {describeAction(entry.action)} {" "}
                      <span style={{ color: "#2b6a64" }}>{entry.slideTitle}</span>
                    </div>
                    <div className={styles.auditMeta}>{entry.timestamp}</div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </main>

      <TeamChatWidget />

      <footer className={styles.footer}>© 2025 Aramco Digital – Secure Presentation Tool</footer>
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, fontFamily: "Calibri, Arial, sans-serif" }}>Loading dashboard…</div>}>
      <DashboardContent />
    </Suspense>
  );
}


