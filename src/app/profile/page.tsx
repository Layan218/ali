"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTheme } from "@/hooks/useTheme";
import Image from "next/image";

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string>("Owner");
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    const fetchUserData = async () => {
      try {
        const userRecord = user as Record<string, unknown>;
        const uid = typeof userRecord.uid === "string" ? userRecord.uid : null;
        const userEmail = typeof userRecord.email === "string" ? userRecord.email : null;
        const userDisplayName = typeof userRecord.displayName === "string" ? userRecord.displayName : null;

        // Set initial values from auth context
        setEmail(userEmail);
        setDisplayName(userDisplayName);

        // Fetch from Firestore to get latest user data
        if (uid) {
          const userRef = doc(db, "users", uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userData?.displayName) {
              setDisplayName(userData.displayName);
            }
            if (userData?.email && !userEmail) {
              setEmail(userData.email);
            }
            // Set role (default to "Owner" if not found)
            if (userData?.role && typeof userData.role === "string") {
              setRole(userData.role);
            } else {
              setRole("Owner");
            }
            // Set member since date
            if (userData?.createdAt) {
              let date: Date;
              if (userData.createdAt instanceof Timestamp) {
                date = userData.createdAt.toDate();
              } else if (userData.createdAt instanceof Date) {
                date = userData.createdAt;
              } else {
                date = new Date();
              }
              setMemberSince(date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }));
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch user data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchUserData();
  }, [user, authLoading, router]);

  if (authLoading || isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Calibri, Arial, Helvetica, sans-serif",
          padding: 16,
        }}
      >
        <div style={{ textAlign: "center", color: theme === "dark" ? "#e2e8f0" : "#202124" }}>
          Loading...
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  const isDark = theme === "dark";
  const backgroundColor = isDark ? "#0f172a" : "#ffffff";
  const foregroundColor = isDark ? "#e2e8f0" : "#000000";
  const cardBackground = isDark ? "#17263b" : "#f7f7f7";
  const borderColor = isDark ? "rgba(148, 163, 184, 0.35)" : "var(--border)";
  const mutedColor = isDark ? "#94a3b8" : "#5f6368";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Calibri, Arial, Helvetica, sans-serif",
        padding: 16,
        background: backgroundColor,
        color: foregroundColor,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          border: `1px solid ${borderColor}`,
          borderRadius: 14,
          padding: 28,
          textAlign: "center",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          background: cardBackground,
        }}
      >
        <div style={{ display: "grid", placeItems: "center", gap: 8, marginBottom: 16 }}>
          <Image
            src="/rt-removebg-preview.png"
            alt="Aramco Digital"
            width={150}
            height={60}
            style={{ height: "auto", display: "block" }}
          />
        </div>
        <div
          style={{
            width: "70px",
            height: "70px",
            borderRadius: "50%",
            background: "#E5F4F1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
            fontSize: "28px",
            fontWeight: 700,
            color: "#2b6a64",
          }}
        >
          {(() => {
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
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: foregroundColor }}>Profile</h1>
        <p style={{ color: foregroundColor, marginBottom: 20 }}>Account settings</p>

        <div style={{ display: "grid", gap: 16, textAlign: "left" }}>
          <div>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                marginBottom: 6,
                color: foregroundColor,
                fontSize: 14,
              }}
            >
              Full Name
            </label>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: `1px solid ${borderColor}`,
                background: isDark ? "rgba(15, 23, 42, 0.45)" : "#ffffff",
                color: foregroundColor,
                fontSize: 14,
              }}
            >
              {displayName || "—"}
            </div>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                marginBottom: 6,
                color: foregroundColor,
                fontSize: 14,
              }}
            >
              Email
            </label>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: `1px solid ${borderColor}`,
                background: isDark ? "rgba(15, 23, 42, 0.45)" : "#ffffff",
                color: foregroundColor,
                fontSize: 14,
              }}
            >
              {email || "—"}
            </div>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                marginBottom: 6,
                color: foregroundColor,
                fontSize: 14,
              }}
            >
              User Role
            </label>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: `1px solid ${borderColor}`,
                background: isDark ? "rgba(15, 23, 42, 0.45)" : "#ffffff",
                color: foregroundColor,
                fontSize: 14,
              }}
            >
              {role}
            </div>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                marginBottom: 6,
                color: foregroundColor,
                fontSize: 14,
              }}
            >
              Member Since
            </label>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: `1px solid ${borderColor}`,
                background: isDark ? "rgba(15, 23, 42, 0.45)" : "#ffffff",
                color: foregroundColor,
                fontSize: 14,
              }}
            >
              {memberSince || "—"}
            </div>
          </div>
        </div>

        <p style={{ marginTop: 20, fontSize: 12, color: mutedColor }}>More settings coming soon</p>
      </div>
    </div>
  );
}

