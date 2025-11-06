"use client";

import { useEffect, useMemo, useState } from "react";
import pageStyles from "../page.module.css";
import styles from "./dashboard.module.css";

type Role = "Viewer" | "Editor";

type Presentation = {
  id: string;
  title: string;
  lastModified: string;
  role: Role;
};

export default function DashboardPage() {
  const [isDark, setIsDark] = useState(false);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState(
    () =>
      [
        { id: "1", user: "Reem", time: "2:15 PM", text: "Welcome to the dashboard!" },
        { id: "2", user: "Ali", time: "2:20 PM", text: "Let's review the Q1 deck." },
      ] as Array<{ id: string; user: string; time: string; text: string }>
  );

  const [historyFor, setHistoryFor] = useState<Presentation | null>(null);

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

  useEffect(() => {
    // Simulate auth check (replace with real auth later)
    const authed = localStorage.getItem("authed");
    setIsAuthed(authed === "true");
  }, []);

  const toggleTheme = () => setIsDark((v) => !v);

  const presentations: Presentation[] = useMemo(
    () => [
      { id: "p1", title: "Q1 Strategy Deck", lastModified: "2 hours ago", role: "Editor" },
      { id: "p2", title: "Security Overview", lastModified: "yesterday", role: "Viewer" },
      { id: "p3", title: "Training Deck", lastModified: "3 days ago", role: "Editor" },
      { id: "p4", title: "Roadmap 2025", lastModified: "last week", role: "Viewer" },
      { id: "p5", title: "Budget Review", lastModified: "2 weeks ago", role: "Editor" },
    ],
    []
  );

  function handleSendMessage() {
    if (!chatInput.trim()) return;
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages((prev) => [
      ...prev,
      { id: String(prev.length + 1), user: "You", time, text: chatInput.trim() },
    ]);
    setChatInput("");
  }

  // Auth guard temporarily disabled to allow designing the dashboard without login
  // if (isAuthed === false) {
  //   return (
  //     <div className={styles.gate}>
  //       <div className={styles.gateCard}>
  //         <h1 className={styles.gateTitle}>Please sign in to access your secure presentations.</h1>
  //         <a className={pageStyles.primary} href="/login">Go to Login</a>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className={styles.container}>
      {/* Top Navigation (reused from Home) */}
      <nav className={pageStyles.nav}>
        <div className={pageStyles.logoWrap}>
          <img src="/aramco-digital.png" alt="Aramco Digital" className={pageStyles.logo} />
        </div>
        <div className={pageStyles.navLinks}>
          <a href="#features" className={pageStyles.navLink}>Features</a>
          <a href="#security" className={pageStyles.navLink}>Security</a>
        </div>
        <div className={pageStyles.topRightActions}>
          <button
            type="button"
            aria-label="Toggle dark mode"
            onClick={toggleTheme}
            className={pageStyles.themeToggle}
          >
            {isDark ? (
              <svg className={`${pageStyles.icon} ${pageStyles.iconSpin}`} width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg className={`${pageStyles.icon} ${pageStyles.iconSpin}`} width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" stroke="currentColor" strokeWidth="1.8" fill="none"/>
              </svg>
            )}
          </button>
          <a className={pageStyles.primary} href="#">Try Work Presentation</a>
          <a className={pageStyles.secondary} href="/login">Sign out</a>
        </div>
      </nav>

      {/* Main Section */}
      <main className={styles.main}>
        <header className={styles.header}> 
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>My Secure Presentations</h1>
            <p className={styles.subtitle}>Manage, create, and collaborate securely on your presentations inside Aramco Digital.</p>
          </div>
          <div className={styles.headerRight}>
            <a className={pageStyles.primary} href="#create">Create New Presentation</a>
          </div>
        </header>

        <section className={styles.contentArea}>
          <div className={styles.listWrap}>
            <div className={styles.table} role="table" aria-label="Presentations">
              <div className={styles.tableHeader} role="row">
                <div className={`${styles.col} ${styles.colName}`} role="columnheader">Presentation</div>
                <div className={`${styles.col} ${styles.colModified}`} role="columnheader">Last modified</div>
                <div className={`${styles.col} ${styles.colRole}`} role="columnheader">Role</div>
                <div className={`${styles.col} ${styles.colActions}`} role="columnheader">Actions</div>
              </div>
              <div className={styles.tableBody} role="rowgroup">
                {presentations.map((p) => (
                  <div key={p.id} className={styles.tableRow} role="row">
                    <div className={`${styles.col} ${styles.colName}`} role="cell">{p.title}</div>
                    <div className={`${styles.col} ${styles.colModified}`} role="cell">{p.lastModified}</div>
                    <div className={`${styles.col} ${styles.colRole}`} role="cell">{p.role}</div>
                    <div className={`${styles.col} ${styles.colActions}`} role="cell">
                      <a className={styles.link} href={`#open-${p.id}`}>Open</a>
                      <button className={styles.textButton} onClick={() => setHistoryFor(p)}>View History</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className={styles.sidePanel}>
            <h3 className={styles.panelTitle}>Recent Activity</h3>
            <ul className={styles.activityList}>
              <li>Reem edited ‘Training Deck’ 2 hours ago</li>
              <li>Ali viewed ‘Security Overview’ yesterday</li>
              <li>Reem edited ‘Q1 Strategy Deck’ last week</li>
            </ul>
            <div className={styles.commentBox}>
              <textarea className={styles.textarea} placeholder="Add an internal dashboard note..."></textarea>
              <button className={pageStyles.primary}>Add Dashboard Comment</button>
            </div>
          </aside>
        </section>
      </main>

      {/* History Modal */}
      {historyFor ? (
        <div className={styles.modalOverlay} onClick={() => setHistoryFor(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Version History – {historyFor.title}</h3>
              <button className={styles.modalClose} onClick={() => setHistoryFor(null)} aria-label="Close">✕</button>
            </div>
            <ul className={styles.versionList}>
              <li>
                <div>Version 3 – Edited by Reem – 2 hours ago</div>
                <button className={pageStyles.secondary}>Restore</button>
              </li>
              <li>
                <div>Version 2 – Edited by Ali – yesterday</div>
                <button className={pageStyles.secondary}>Restore</button>
              </li>
              <li>
                <div>Version 1 – Created by Reem – last week</div>
                <button className={pageStyles.secondary}>Restore</button>
              </li>
            </ul>
          </div>
        </div>
      ) : null}

      {/* Floating Chat */}
      <button className={styles.chatFab} aria-label="Open team chat" onClick={() => setShowChat(true)}>Chat</button>
      {showChat ? (
        <div className={styles.chatPanel}>
          <div className={styles.chatHeader}>
            <strong>Team Chat</strong>
            <button className={styles.modalClose} onClick={() => setShowChat(false)} aria-label="Close">✕</button>
          </div>
          <div className={styles.chatMessages}>
            {messages.map((m) => (
              <div key={m.id} className={styles.chatMessage}>
                <div className={styles.chatMeta}><strong>{m.user}</strong> • {m.time}</div>
                <div>{m.text}</div>
              </div>
            ))}
          </div>
          <div className={styles.chatInputRow}>
            <input
              className={styles.chatInput}
              placeholder="Type a message..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage(); }}
            />
            <button className={pageStyles.primary} onClick={handleSendMessage}>Send</button>
          </div>
        </div>
      ) : null}

      {/* Footer */}
      <footer className={pageStyles.footer}>© 2025 Aramco Digital – Secure Presentation Tool.</footer>
    </div>
  );
}


