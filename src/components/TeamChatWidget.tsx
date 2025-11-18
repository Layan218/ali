"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import styles from "./TeamChatWidget.module.css";
import { db, auth } from "@/lib/firebase";
import { decryptText, encryptText } from "@/lib/encryption";
import { logAuditEvent } from "@/lib/audit";

type ChatMessage = {
  id: string;
  author: string;
  body: string;
  timestamp: string;
  userId?: string;
  role?: "owner" | "editor" | "viewer";
};

type TeamChatWidgetProps = {
  presentationId?: string | null;
  canChat?: boolean;
  teamRoles?: Record<string, "owner" | "editor" | "viewer">;
  ownerId?: string | null;
};

export default function TeamChatWidget({
  presentationId,
  canChat = false,
  teamRoles = {},
  ownerId = null,
}: TeamChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);
  const isOpenRef = useRef(isOpen);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messageCountRef = useRef(0);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!presentationId) {
      setMessages([]);
      setAccessMessage("Select a presentation to start chatting.");
      setUnreadCount(0);
      messageCountRef.current = 0;
      return;
    }

    if (!canChat) {
      setMessages([]);
      setAccessMessage("You are not part of this project team.");
      setUnreadCount(0);
      messageCountRef.current = 0;
      return;
    }

    const cutOffMs = Date.now() - 24 * 60 * 60 * 1000;
    const cutOffTimestamp = Timestamp.fromMillis(cutOffMs);

    const cleanupStaleMessages = async () => {
      try {
        const chatRef = collection(db, "presentations", presentationId, "chatMessages");
        const staleQuery = query(chatRef, where("createdAt", "<", cutOffTimestamp));
        const staleSnapshot = await getDocs(staleQuery);
        await Promise.all(staleSnapshot.docs.map((docSnap) => deleteDoc(docSnap.ref)));
      } catch (error) {
        console.error("Failed to cleanup chat messages:", error);
      }
    };

    void cleanupStaleMessages();

    const chatRef = collection(db, "presentations", presentationId, "chatMessages");
    const chatQuery = query(chatRef, orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(
      chatQuery,
      (snapshot) => {
        const nowMs = Date.now();
        const filtered: ChatMessage[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const createdAt = data.createdAt?.toDate?.() ?? null;
          if (!createdAt) return;
          if (createdAt.getTime() < nowMs - 24 * 60 * 60 * 1000) {
            return;
          }
          const rawText = typeof data.text === "string" ? data.text : "";
          const decrypted = rawText ? decryptText(rawText) : "";
          const body = decrypted || rawText || "";

          const authorName = typeof data.userName === "string" ? data.userName : "Team member";
          const messageUserId = typeof data.userId === "string" ? data.userId : null;
          let messageRole: "owner" | "editor" | "viewer" | undefined;
          if (messageUserId) {
            if (ownerId && messageUserId === ownerId) {
              messageRole = "owner";
            } else {
              messageRole = teamRoles[messageUserId] || "editor";
            }
          }
          filtered.push({
            id: docSnap.id,
            author: authorName,
            body,
            timestamp: createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            userId: messageUserId || undefined,
            role: messageRole,
          });
        });

        setMessages(filtered);
        const previousCount = messageCountRef.current;
        messageCountRef.current = filtered.length;
        if (!isOpenRef.current && filtered.length > previousCount) {
          setUnreadCount((count) => count + (filtered.length - previousCount));
        }
        setAccessMessage(null);
      },
      (error) => {
        console.error("Failed to subscribe to chat messages:", error);
        setAccessMessage("Unable to load chat messages.");
      }
    );

    return () => {
      unsubscribe();
    };
  }, [presentationId, canChat]);

  const toggleWidget = () => {
    setIsOpen((open) => {
      const nextOpen = !open;
      if (nextOpen) {
        setUnreadCount(0);
        setTimeout(() => {
          scrollToBottom();
        }, 0);
      }
      return nextOpen;
    });
  };

  const resolvedStatus = useMemo(() => {
    if (!presentationId) {
      return "Select a presentation to start chatting.";
    }
    if (!canChat) {
      return accessMessage ?? "You are not part of this project team.";
    }
    if (accessMessage) {
      return accessMessage;
    }
    return "Connected to project chat";
  }, [presentationId, canChat, accessMessage]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!presentationId || !canChat) {
      setAccessMessage("You are not part of this project team.");
      return;
    }
    if (!draft.trim()) return;

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setAccessMessage("Please sign in to send messages.");
      return;
    }

    try {
      setIsSending(true);
      // Fetch user profile to get displayName
      let displayName = currentUser.displayName || currentUser.email || "User";
      try {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();
        if (userData?.displayName) {
          displayName = userData.displayName;
        }
      } catch (err) {
        console.warn("Failed to fetch user displayName:", err);
      }
      
      const encryptedText = encryptText(draft.trim());
      const chatRef = collection(db, "presentations", presentationId, "chatMessages");
      const messageDoc = await addDoc(chatRef, {
        userId: currentUser.uid,
        userName: displayName,
        text: encryptedText,
        createdAt: serverTimestamp(),
      });

      await logAuditEvent({
        presentationId,
        userId: currentUser.uid,
        userEmail: currentUser.email ?? null,
        action: "SEND_CHAT_MESSAGE",
        details: { messageId: messageDoc.id },
      });

      setDraft("");
      setAccessMessage(null);
    } catch (error) {
      console.error("Failed to send chat message:", error);
      setAccessMessage("Unable to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={styles.widgetButton}
        onClick={toggleWidget}
        aria-expanded={isOpen}
        aria-controls="team-live-chat-panel"
      >
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
        {unreadCount > 0 ? (
          <span className={styles.unreadBadge} aria-label={`${unreadCount} unread messages`}>
            {unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          id="team-live-chat-panel"
          className={styles.chatPanel}
          role="dialog"
          aria-label="Team live chat"
          aria-modal="false"
        >
          <div className={styles.panelHeader}>
            <div>
              <div className={styles.panelTitle}>Team Live Chat</div>
              <div className={styles.panelStatus}>{resolvedStatus}</div>
            </div>
            <button type="button" className={styles.closeButton} onClick={toggleWidget} aria-label="Close chat">
              ✕
            </button>
          </div>

          <div className={styles.messagesList}>
            {messages.map((message) => (
              <div key={message.id} className={styles.message}>
                <div className={styles.messageMeta}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span className={styles.messageAuthor}>{message.author}</span>
                    {message.role && (
                      <span
                        style={{
                          fontSize: "10px",
                          color: "#6b7280",
                          fontWeight: 500,
                          textTransform: "capitalize",
                        }}
                      >
                        {message.role}
                      </span>
                    )}
                  </div>
                  <span className={styles.messageTimestamp}>{message.timestamp}</span>
                </div>
                <div className={styles.messageBody}>{message.body}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form className={styles.messageForm} onSubmit={handleSubmit}>
            <input
              type="text"
              className={styles.messageInput}
              placeholder={
                canChat ? "Send a quick update to your team…" : "You are not part of this project team."
              }
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-label="Chat message"
              disabled={!canChat || isSending}
            />
            <button type="submit" className={styles.sendButton} disabled={!canChat || isSending || !draft.trim()}>
              {isSending ? "Sending…" : "Send"}
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
