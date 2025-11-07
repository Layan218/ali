"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./TeamChatWidget.module.css";

type ChatMessage = {
  id: string;
  author: string;
  body: string;
  timestamp: string;
};

const INITIAL_MESSAGES: ChatMessage[] = [
  { id: "1", author: "Rania", body: "Uploading the latest KPI slide now.", timestamp: "1 min ago" },
  { id: "2", author: "You", body: "Thanks! I’ll review it right after this meeting.", timestamp: "Just now" },
];

export default function TeamChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [draft, setDraft] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setMessages((prev) => {
        const nextMessage: ChatMessage = {
          id: `${Date.now()}`,
          author: "Sara",
          body: "Reminder: security review slides are due by 4 PM.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };

        if (!isOpen) {
          setUnreadCount((count) => count + 1);
        }

        return [...prev, nextMessage];
      });
    }, 28000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOpen]);

  const toggleWidget = () => {
    setIsOpen((open) => {
      if (open) {
        setUnreadCount(0);
      }
      return !open;
    });
    if (!isOpen) {
      setUnreadCount(0);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.trim()) return;

    const newMessage: ChatMessage = {
      id: `${Date.now()}`,
      author: "You",
      body: draft.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, newMessage]);
    setDraft("");
  };

  return (
    <>
      <button type="button" className={styles.widgetButton} onClick={toggleWidget} aria-expanded={isOpen} aria-controls="team-live-chat-panel">
        <span className={styles.buttonIcon} aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M5 7.5C5 6.11929 6.11929 5 7.5 5H16.5C17.8807 5 19 6.11929 19 7.5V12.75C19 14.1307 17.8807 15.25 16.5 15.25H9.75L6.375 18.625C6.04163 18.9584 5.5 18.7217 5.5 18.25V15.25H7.5C6.11929 15.25 5 14.1307 5 12.75V7.5Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        {unreadCount > 0 ? <span className={styles.unreadBadge} aria-label={`${unreadCount} unread messages`}>{unreadCount}</span> : null}
      </button>

      {isOpen ? (
        <div id="team-live-chat-panel" className={styles.chatPanel} role="dialog" aria-label="Team live chat" aria-modal="false">
          <div className={styles.panelHeader}>
            <div>
              <div className={styles.panelTitle}>Team Live Chat</div>
              <div className={styles.panelStatus}>3 teammates online</div>
            </div>
            <button type="button" className={styles.closeButton} onClick={toggleWidget} aria-label="Close chat">
              ✕
            </button>
          </div>

          <div className={styles.messagesList}>
            {messages.map((message) => (
              <div key={message.id} className={styles.message}>
                <div className={styles.messageMeta}>
                  <span className={styles.messageAuthor}>{message.author}</span>
                  <span className={styles.messageTimestamp}>{message.timestamp}</span>
                </div>
                <div className={styles.messageBody}>{message.body}</div>
              </div>
            ))}
          </div>

          <form className={styles.messageForm} onSubmit={handleSubmit}>
            <input
              type="text"
              className={styles.messageInput}
              placeholder="Send a quick update to your team…"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-label="Chat message"
            />
            <button type="submit" className={styles.sendButton} disabled={!draft.trim()}>
              Send
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
