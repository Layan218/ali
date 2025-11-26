"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { collection, query, onSnapshot, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import TeamChatWidget from "@/components/TeamChatWidget";
import { useTheme } from "@/hooks/useTheme";
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

export default function ExecutiveSummaryPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [presentations, setPresentations] = useState<PresentationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load all shared team presentations from Firestore
  useEffect(() => {
    if (!user?.uid) {
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const presentationsRef = collection(db, "presentations");
    // Load all presentations and filter client-side for team access
    // (user is owner or collaborator)
    // Note: Not using orderBy to avoid requiring a composite index
    const allPresentationsQuery = query(presentationsRef);

    const unsubscribe = onSnapshot(
      allPresentationsQuery,
      async (snapshot) => {
        try {
          const loadedPresentations: PresentationRow[] = [];

          // Process all presentations with error handling
          // If snapshot is empty, the loop won't execute and loadedPresentations will remain empty
          for (const docSnap of snapshot.docs) {
            try {
              const data = docSnap.data();
              const ownerId = data.ownerId || "";
              const collaboratorIds = Array.isArray(data.collaboratorIds) ? data.collaboratorIds : [];
              const teamRoles = data.teamRoles || {};

              // Check if user has access (owner or collaborator)
              const userId = user.uid;
              if (!userId || typeof userId !== "string") {
                continue; // Skip if user ID is invalid
              }
              const isOwner = ownerId === userId;
              const hasTeamRole = teamRoles && typeof teamRoles === "object" && userId in teamRoles;
              const isCollaborator = collaboratorIds.includes(userId) || hasTeamRole;
              
              if (!isOwner && !isCollaborator) {
                continue; // Skip presentations user doesn't have access to
              }

              const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate() : null;
              
              // Get owner display name
              let ownerName = "Unknown";
              if (ownerId) {
                try {
                  const ownerRef = doc(db, "users", ownerId);
                  const ownerSnap = await getDoc(ownerRef);
                  if (ownerSnap.exists()) {
                    const ownerData = ownerSnap.data();
                    ownerName = ownerData.displayName || ownerData.email?.split("@")[0] || ownerId;
                  } else {
                    ownerName = ownerId;
                  }
                } catch (err) {
                  console.warn(`Failed to fetch owner name for ${ownerId}:`, err);
                  ownerName = ownerId;
                }
              }

              // Count comments
              let commentCount = 0;
              try {
                const commentsRef = collection(db, "presentations", docSnap.id, "comments");
                const commentsSnap = await getDocs(commentsRef);
                commentCount = commentsSnap.size;
              } catch (err) {
                console.warn(`Failed to count comments for presentation ${docSnap.id}:`, err);
                // Continue with commentCount = 0
              }

              const lastUpdated = updatedAt
                ? updatedAt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                : "Unknown";

              loadedPresentations.push({
                id: docSnap.id,
                title: data.title || "Untitled Presentation",
                owner: ownerName,
                lastUpdated,
                status: (data.status === "final" ? "Final" : "Draft") as "Draft" | "Final",
                comments: commentCount,
                _updatedAt: updatedAt, // Store Date object for sorting
              });
            } catch (slideError) {
              console.warn(`Error processing presentation ${docSnap.id}:`, slideError);
              // Continue processing other presentations
            }
          }

          // Sort by updatedAt descending (most recent first)
          loadedPresentations.sort((a, b) => {
            const aTime = (a as any)._updatedAt?.getTime() || 0;
            const bTime = (b as any)._updatedAt?.getTime() || 0;
            return bTime - aTime;
          });

          // Remove temporary sorting field
          const finalPresentations = loadedPresentations.map(({ _updatedAt, ...rest }) => rest);

          setPresentations(finalPresentations);
          setError(null);
        } catch (error) {
          console.error("Error processing presentations:", error);
          setError(error instanceof Error ? error.message : "Failed to load presentations");
          setPresentations([]);
        } finally {
          // Always call setIsLoading(false) exactly once after processing
          setIsLoading(false);
        }
      },
      (error) => {
        console.error("Failed to load presentations:", error);
        setError(error instanceof Error ? error.message : "Failed to load presentations. Please try again.");
        setPresentations([]);
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user?.uid]);

  // Calculate stats from presentations
  const summaryStats = useMemo<SummaryStat[]>(() => {
    const total = presentations.length;
    const draft = presentations.filter((p) => p.status === "Draft").length;
    const final = presentations.filter((p) => p.status === "Final").length;

    return [
      { id: "stat-total", label: "Total Presentations", value: total.toString() },
      { id: "stat-draft", label: "Draft Presentations", value: draft.toString() },
      { id: "stat-final", label: "Final Presentations", value: final.toString() },
    ];
  }, [presentations]);

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
            <h1 className={styles.title}>Executive Summary</h1>
            <p className={styles.subtitle}>High-level overview of all active presentations.</p>
          </header>

          {isLoading ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: theme === "dark" ? "#cbd5e1" : "#5f6368" }}>
              Loading executive summary...
            </div>
          ) : error ? (
            <div style={{ 
              padding: "40px 20px", 
              textAlign: "center", 
              color: theme === "dark" ? "#ef4444" : "#dc2626",
              backgroundColor: theme === "dark" ? "rgba(239, 68, 68, 0.1)" : "rgba(220, 38, 38, 0.1)",
              borderRadius: "12px",
              border: `1px solid ${theme === "dark" ? "rgba(239, 68, 68, 0.3)" : "rgba(220, 38, 38, 0.3)"}`
            }}>
              <p style={{ marginBottom: "12px", fontWeight: 600 }}>Error loading executive summary</p>
              <p style={{ fontSize: "14px", opacity: 0.9 }}>{error}</p>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setIsLoading(true);
                  // Trigger re-fetch by updating user dependency
                  window.location.reload();
                }}
                style={{
                  marginTop: "16px",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: theme === "dark" ? "#56c1b0" : "#56c1b0",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {summaryStats.length > 0 && summaryStats.some(s => parseInt(s.value) > 0) && (
                <section className={styles.statsRow}>
                  {summaryStats.map((stat) => (
                    <article key={stat.id} className={styles.statCard}>
                      <span className={styles.statLabel}>{stat.label}</span>
                      <span className={styles.statValue}>{stat.value}</span>
                    </article>
                  ))}
                </section>
              )}

              <section className={styles.tableCard}>
                <header className={styles.tableHeader}>
                  <h2>Presentation Overview</h2>
                </header>
                <div className={styles.tableWrap}>
                  {presentations.length === 0 ? (
                    <div style={{ padding: "40px 20px", textAlign: "center", color: theme === "dark" ? "#cbd5e1" : "#5f6368" }}>
                      No presentations available. Create a presentation to see it here.
                    </div>
                  ) : (
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
                  )}
                </div>
              </section>
            </>
          )}

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
