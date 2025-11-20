"use client";

import { Suspense, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { collection, query, where, orderBy, getDocs, onSnapshot, Timestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { decryptText } from "@/lib/encryption";
import TeamChatWidget from "@/components/TeamChatWidget";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import styles from "./dashboard.module.css";

const VIEWER_RETURN_KEY = "viewer-return-url";

type Presentation = {
  id: string;
  title: string;
  updatedAt: Date | null;
  createdAt: Date | null;
  role: "Viewer" | "Editor" | "Owner";
  ownerId: string;
  status?: "draft" | "final";
};

type Comment = {
  id: string;
  presentationId: string;
  author: string;
  content: string;
  timestamp: string;
};

type AuditLogEntry = {
  id: string;
  actor: string;
  action: string;
  slideTitle: string;
  timestamp: string;
};


function DashboardContent() {
  const { theme, toggleTheme, mounted } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPresentationId, setSelectedPresentationId] = useState<string | null>(null);
  
  const selectedPresentation = useMemo(
    () => presentations.find((p) => p.id === selectedPresentationId) ?? presentations[0] ?? null,
    [presentations, selectedPresentationId]
  );

  // Load presentations from Firestore
  useEffect(() => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    // Query presentations where user is owner (filter for shared ones client-side)
    const presentationsRef = collection(db, "presentations");
    const presentationsQuery = query(
      presentationsRef,
      where("ownerId", "==", user.uid)
      // Note: Removed orderBy to avoid requiring a composite index
      // We'll sort client-side instead
    );

    const unsubscribe = onSnapshot(
      presentationsQuery,
      (snapshot) => {
        const loadedPresentations: Presentation[] = [];
        
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          // Only show presentations that are shared (isShared === true)
          // This is the team dashboard, so only show shared presentations
          const isShared = data.isShared === true;
          if (!isShared) {
            continue; // Skip private presentations
          }
          
          const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate() : null;
          const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
          
          loadedPresentations.push({
            id: docSnap.id,
            title: data.title || "Untitled Presentation",
            updatedAt,
            createdAt,
            role: "Owner" as const,
            ownerId: data.ownerId || "",
            status: data.status || "draft",
          });
        }
        
        // Sort by updatedAt descending (client-side)
        loadedPresentations.sort((a, b) => {
          const aTime = a.updatedAt?.getTime() || 0;
          const bTime = b.updatedAt?.getTime() || 0;
          return bTime - aTime;
        });
        
        setPresentations(loadedPresentations);
        
        // Auto-select first presentation if none selected
        if (!selectedPresentationId && loadedPresentations.length > 0) {
          setSelectedPresentationId(loadedPresentations[0].id);
        }
        
        setIsLoading(false);
      },
      (error) => {
        console.error("Failed to load presentations:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid, selectedPresentationId]);

  // Load comments for selected presentation
  useEffect(() => {
    if (!selectedPresentation?.id) {
      setComments([]);
      return;
    }

    const commentsRef = collection(db, "presentations", selectedPresentation.id, "comments");
    const commentsQuery = query(commentsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      commentsQuery,
      (snapshot) => {
        const loadedComments: Comment[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const rawText = typeof data.text === "string" ? data.text : "";
          const decrypted = rawText ? decryptText(rawText) : "";
          const finalText = decrypted || rawText || "";

          let timestampLabel = "";
          const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
          if (createdAt instanceof Date && !Number.isNaN(createdAt.getTime())) {
            const now = new Date();
            const diffMs = now.getTime() - createdAt.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);
            
            if (diffMins < 1) timestampLabel = "Just now";
            else if (diffMins < 60) timestampLabel = `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
            else if (diffHours < 24) timestampLabel = `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
            else if (diffDays === 1) timestampLabel = "Yesterday";
            else timestampLabel = `${diffDays} days ago`;
          }

          return {
            id: docSnap.id,
            presentationId: selectedPresentation.id,
            author: typeof data.userName === "string" && data.userName.length > 0 ? data.userName : "Team member",
            content: finalText,
            timestamp: timestampLabel,
          };
        });

        setComments(loadedComments);
      },
      (error) => {
        console.error("Failed to load comments:", error);
      }
    );

    return () => unsubscribe();
  }, [selectedPresentation?.id]);

  // Load audit logs
  useEffect(() => {
    if (!user?.uid) {
      setAuditLog([]);
      return;
    }

    const auditLogsRef = collection(db, "auditLogs");
    const auditLogsQuery = query(auditLogsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      auditLogsQuery,
      (snapshot) => {
        const loadedLogs: AuditLogEntry[] = snapshot.docs.slice(0, 20).map((docSnap) => {
          const data = docSnap.data();
          const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
          
          let timestampLabel = "";
          if (createdAt instanceof Date && !Number.isNaN(createdAt.getTime())) {
            const now = new Date();
            const diffMs = now.getTime() - createdAt.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);
            
            if (diffMins < 1) timestampLabel = "Just now";
            else if (diffMins < 60) timestampLabel = `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
            else if (diffHours < 24) timestampLabel = `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
            else if (diffDays === 1) timestampLabel = "Yesterday";
            else timestampLabel = `${diffDays} days ago`;
          }

          const action = data.action || "viewed";
          const slideTitle = data.details?.title || "Unknown presentation";
          const actor = data.userEmail || "Unknown user";
          const isCurrentUser = data.userId === user.uid;

          return {
            id: docSnap.id,
            actor: isCurrentUser ? "You" : actor.split("@")[0] || actor,
            action: action.toLowerCase().replace(/_/g, " "),
            slideTitle,
            timestamp: timestampLabel,
          };
        });

        setAuditLog(loadedLogs);
      },
      (error) => {
        console.error("Failed to load audit logs:", error);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // Format date for display
  const formatDate = (date: Date | null): string => {
    if (!date) return "Unknown";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

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
            {!mounted ? (
              // Render moon icon during SSR to avoid hydration mismatch
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
            ) : theme === "dark" ? (
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

                  {isLoading ? (
                    <div className={styles.emptyState}>Loading presentations...</div>
                  ) : presentations.length === 0 ? (
                    <div className={styles.emptyState}>You have no presentations yet. Click "Create New Slide" to get started.</div>
                  ) : (
                    presentations.map((presentation) => {
                      const isActive = selectedPresentation?.id === presentation.id;
                      return (
                        <div
                          key={presentation.id}
                          role="listitem"
                          className={`${styles.tableRow} ${isActive ? styles.tableRowActive : ""}`}
                          onClick={() => setSelectedPresentationId(presentation.id)}
                        >
                          <div className={styles.rowTitle}>
                            <span>{presentation.title}</span>
                            <span>ID: {presentation.id.substring(0, 8)}...</span>
                          </div>
                          <div>{formatDate(presentation.updatedAt)}</div>
                          <div>{presentation.role}</div>
                          <div className={styles.actions}>
                            <button
                              type="button"
                              className={styles.outlineButton}
                              onClick={(event) => {
                                event.stopPropagation();
                                router.push(`/editor?presentationId=${encodeURIComponent(presentation.id)}&slideId=slide-1`);
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
                                router.push(`/viewer?presentationId=${encodeURIComponent(presentation.id)}&slideId=slide-1`);
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
                {selectedPresentation ? (
                  <p className={styles.commentInfo}>
                    Viewing feedback for <strong>{selectedPresentation.title}</strong>
                  </p>
                ) : null}

                <div className={styles.commentList}>
                  {comments.length === 0 ? (
                    <div className={styles.emptyState} style={{ padding: "20px 12px" }}>
                      {selectedPresentation ? "No comments yet for this presentation." : "Select a presentation to view comments."}
                    </div>
                  ) : (
                    comments.map((comment) => (
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

                {selectedPresentation && (
                <div className={styles.commentComposer}>
                  <textarea placeholder="Leave a quick update for your team…" aria-label="Add a comment" />
                  <button type="button" className={styles.outlineButton}>
                    Add Comment
                  </button>
                </div>
                )}
              </aside>
            </div>

            <section id="audit" className={`${styles.auditSection} ${styles.card}`}>
              <h2>Audit Log</h2>
              {auditLog.length === 0 ? (
                <div className={styles.emptyState} style={{ padding: "20px 12px" }}>
                  No audit log entries yet.
                </div>
              ) : (
              <ul className={styles.auditList}>
                {auditLog.map((entry) => (
                  <li key={entry.id} className={styles.auditItem}>
                    <div className={styles.auditPrimary}>
                        {entry.actor} {entry.action} {" "}
                      <span className={styles.auditSlideTitle}>{entry.slideTitle}</span>
                    </div>
                    <div className={styles.auditMeta}>{entry.timestamp}</div>
                  </li>
                ))}
              </ul>
              )}
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


