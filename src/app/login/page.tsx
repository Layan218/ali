"use client";

import Image from "next/image";
import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useTheme } from "@/hooks/useTheme";
import { useRouter } from "next/navigation";

type AuthMode = "login" | "signup";

export default function LoginPage() {
  const { theme } = useTheme();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  function readStoredUser(): Record<string, unknown> | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem("authUser");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  async function ensureUserDocument(uid: string, emailAddress: string | null | undefined) {
    try {
      const userRef = doc(db, "users", uid);
      const snapshot = await getDoc(userRef);
      if (!snapshot.exists()) {
        const safeEmail = emailAddress && emailAddress.includes('@') ? emailAddress : (email && email.includes('@') ? email : null);
        if (!safeEmail) {
          console.error('Invalid email for ensureUserDocument:', emailAddress, email);
          throw new Error('Invalid email address');
        }
        await setDoc(userRef, {
          uid,
          email: safeEmail,
          role: "editor",
          createdAt: serverTimestamp(),
        });
      } else {
        // Update displayName if it exists in Firestore
        const userData = snapshot.data();
        if (userData?.displayName && typeof window !== "undefined") {
          const stored = readStoredUser();
          if (stored) {
            const payload = { ...stored, displayName: userData.displayName };
            window.localStorage.setItem("authUser", JSON.stringify(payload));
            window.dispatchEvent(new Event("auth:updated"));
          }
        }
      }
    } catch (error) {
      console.error("Firestore error (ensureUserDocument):", error);
      throw error;
    }
  }

  async function createUserDocument(uid: string, emailAddress: string | null | undefined, name: string) {
    try {
      const safeEmail = emailAddress && emailAddress.includes('@') ? emailAddress : (email && email.includes('@') ? email : null);
      if (!safeEmail) {
        console.error('Invalid email for createUserDocument:', emailAddress, email);
        throw new Error('Invalid email address');
      }
      const userRef = doc(db, "users", uid);
      await setDoc(userRef, {
        uid,
        email: safeEmail,
        displayName: name,
        role: "editor",
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Firestore error (createUserDocument):", error);
      throw error;
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    // Validate email format before Firebase Auth calls
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (mode === "signup") {
      if (password !== confirmPassword) {
        setError("Passwords do not match. Please confirm your password.");
        return;
      }
      if (!displayName || !displayName.trim()) {
        setError("Please enter your full name.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Validate Firebase is properly initialized
      if (!auth || !auth.app) {
        throw new Error("Firebase Auth is not initialized. Please check your configuration.");
      }

      if (mode === "login") {
        let result;
        try {
          result = await signInWithEmailAndPassword(auth, trimmedEmail, password);
        } catch (error) {
          console.error("Firebase Auth error (signInWithEmailAndPassword):", error);
          throw error;
        }
        const user = result.user;
        const userEmail = user?.email;
        if (!userEmail || !userEmail.includes('@')) {
          console.error('Invalid email for Firebase Auth:', userEmail);
          setError("Authentication succeeded but user email is invalid. Please contact support.");
          setIsSubmitting(false);
          return;
        }
        try {
          await ensureUserDocument(user.uid, userEmail);
        } catch (error) {
          console.error("Firestore error (ensureUserDocument):", error);
          // Continue even if this fails
        }
        // Fetch user profile from Firestore to get displayName
        let userSnap;
        try {
          const userRef = doc(db, "users", user.uid);
          userSnap = await getDoc(userRef);
        } catch (error) {
          console.error("Firestore error (getDoc user):", error);
          userSnap = null;
        }
        const userData = userSnap?.data();
        if (typeof window !== "undefined") {
          const safeEmail = userEmail || trimmedEmail;
          if (!safeEmail || !safeEmail.includes('@')) {
            console.error('Invalid email for localStorage:', safeEmail);
            setError("Cannot save user data: invalid email. Please contact support.");
            setIsSubmitting(false);
            return;
          }
          const payload = {
            uid: user.uid,
            email: safeEmail,
            displayName: userData?.displayName || user.displayName || null,
            role: "editor",
          };
          window.localStorage.setItem("authUser", JSON.stringify(payload));
          window.dispatchEvent(
            new StorageEvent("storage", { key: "authUser", storageArea: window.localStorage })
          );
          window.dispatchEvent(new Event("auth:updated"));
        }
      } else {
        let result;
        try {
          result = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        } catch (error) {
          console.error("Firebase Auth error (createUserWithEmailAndPassword):", error);
          throw error;
        }
        const user = result.user;
        const userEmail = user?.email;
        if (!userEmail || !userEmail.includes('@')) {
          console.error('Invalid email for Firebase Auth:', userEmail);
          setError("Account created but user email is invalid. Please contact support.");
          setIsSubmitting(false);
          return;
        }
        const trimmedName = displayName.trim();
        // Update Firebase Auth profile
        try {
          await updateProfile(user, { displayName: trimmedName });
        } catch (error) {
          console.error("Firebase Auth error (updateProfile):", error);
          // Continue even if this fails
        }
        // Save to Firestore
        try {
          await createUserDocument(user.uid, userEmail, trimmedName);
        } catch (error) {
          console.error("Firestore error (createUserDocument):", error);
          // Continue even if this fails
        }
        if (typeof window !== "undefined") {
          const payload = {
            uid: user.uid,
            email: userEmail,
            displayName: trimmedName,
            role: "editor",
          };
          window.localStorage.setItem("authUser", JSON.stringify(payload));
          window.dispatchEvent(
            new StorageEvent("storage", { key: "authUser", storageArea: window.localStorage })
          );
          window.dispatchEvent(new Event("auth:updated"));
        }
      }

      router.push("/presentations");
    } catch (submitError: unknown) {
      console.error("Authentication error:", submitError);
      
      let message = "Unable to process your request. Please try again.";
      
      if (submitError instanceof Error) {
        const errorCode = (submitError as any).code;
        const errorMessage = submitError.message;
        
        // Handle specific Firebase Auth errors
        if (errorCode === "auth/network-request-failed") {
          message = "Network error. Please check your internet connection and ensure Firebase is properly configured. If the problem persists, verify that 'localhost' is added to your Firebase authorized domains.";
        } else if (errorCode === "auth/invalid-api-key") {
          message = "Invalid Firebase API key. Please check your environment variables.";
        } else if (errorCode === "auth/invalid-credential") {
          message = "Invalid email or password. Please try again.";
        } else if (errorCode === "auth/user-not-found") {
          message = "No account found with this email address.";
        } else if (errorCode === "auth/wrong-password") {
          message = "Incorrect password. Please try again.";
        } else if (errorCode === "auth/email-already-in-use") {
          message = "This email is already registered. Please sign in instead.";
        } else if (errorCode === "auth/weak-password") {
          message = "Password is too weak. Please use a stronger password.";
        } else if (errorMessage) {
          message = errorMessage;
        }
      }
      
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const isDark = theme === "dark";
  const backgroundColor = isDark ? "#0f172a" : "#ffffff";
  const foregroundColor = isDark ? "#e2e8f0" : "#000000";
  const cardBackground = isDark ? "#17263b" : "#f7f7f7";
  const borderColor = isDark ? "rgba(148, 163, 184, 0.35)" : "var(--border)";
  const footerBackground = isDark ? "#101f33" : "#eeeeee";
  const footerColor = isDark ? "#cbd5f5" : "#333333";
  const activeTabColor = isDark ? "#56c1b0" : "#56c1b0";
  const inactiveTabBackground = isDark ? "rgba(15,23,42,0.45)" : "transparent";

  const title = mode === "login" ? "Sign in" : "Create account";
  const description =
    mode === "login"
      ? "Enter your email and password to continue."
      : "Fill in the details below to create your account.";

  const submitLabel = isSubmitting
    ? mode === "login"
      ? "Signing in…"
      : "Creating account…"
    : mode === "login"
    ? "Sign in"
    : "Create account";

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
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 8,
            marginBottom: 16,
            background: isDark ? "rgba(15, 23, 42, 0.25)" : "rgba(86, 193, 176, 0.08)",
            padding: 4,
            borderRadius: 999,
          }}
        >
          {(["login", "signup"] as const).map((tabMode) => {
            const isActive = mode === tabMode;
            return (
              <button
                key={tabMode}
                type="button"
                onClick={() => {
                  setMode(tabMode);
                  setError(null);
                  setConfirmPassword("");
                  setDisplayName("");
                }}
                style={{
                  border: "none",
                  borderRadius: 999,
                  padding: "10px 12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: isActive ? activeTabColor : inactiveTabBackground,
                  color: isActive ? "#ffffff" : foregroundColor,
                  transition: "background 0.2s ease",
                }}
              >
                {tabMode === "login" ? "Login" : "Create account"}
              </button>
            );
          })}
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: foregroundColor }}>{title}</h1>
        <p style={{ color: foregroundColor, marginBottom: 20 }}>{description}</p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          {mode === "signup" ? (
            <label style={{ display: "grid", gap: 6, textAlign: "left", color: foregroundColor }}>
              <span style={{ fontWeight: 600, textAlign: "center", color: foregroundColor }}>Full Name</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your full name"
                required
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: `1px solid ${borderColor}`,
                  background: isDark ? "rgba(15, 23, 42, 0.45)" : "transparent",
                  color: foregroundColor,
                  textAlign: "center",
                  outline: "none",
                }}
              />
            </label>
          ) : null}

          <label style={{ display: "grid", gap: 6, textAlign: "left", color: foregroundColor }}>
            <span style={{ fontWeight: 600, textAlign: "center", color: foregroundColor }}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: `1px solid ${borderColor}`,
                background: isDark ? "rgba(15, 23, 42, 0.45)" : "transparent",
                color: foregroundColor,
                textAlign: "center",
                outline: "none",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, textAlign: "left", color: foregroundColor }}>
            <span style={{ fontWeight: 600, textAlign: "center", color: foregroundColor }}>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: `1px solid ${borderColor}`,
                background: isDark ? "rgba(15, 23, 42, 0.45)" : "transparent",
                color: foregroundColor,
                textAlign: "center",
                outline: "none",
              }}
            />
          </label>

          {mode === "signup" ? (
            <label style={{ display: "grid", gap: 6, textAlign: "left", color: foregroundColor }}>
              <span style={{ fontWeight: 600, textAlign: "center", color: foregroundColor }}>
                Confirm password
              </span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                required
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: `1px solid ${borderColor}`,
                  background: isDark ? "rgba(15, 23, 42, 0.45)" : "transparent",
                  color: foregroundColor,
                  textAlign: "center",
                  outline: "none",
                }}
              />
            </label>
          ) : null}

          {error ? (
            <div style={{ color: "#ef4444", fontSize: 14, textAlign: "center" }}>{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              background: "#56c1b0",
              color: "#ffffff",
              border: "none",
              borderRadius: 10,
              padding: "12px 18px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "filter 0.2s ease",
              opacity: isSubmitting ? 0.8 : 1,
            }}
            onMouseDown={(e) => (e.currentTarget.style.filter = "brightness(0.95)")}
            onMouseUp={(e) => (e.currentTarget.style.filter = "none")}
          >
            {submitLabel}
          </button>
        </form>

        <div style={{ marginTop: 16, fontSize: 14, color: foregroundColor }}>
          {mode === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setConfirmPassword("");
                  setDisplayName("");
                }}
                style={{
                  border: "none",
                  background: "none",
                  color: "#56c1b0",
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                  setConfirmPassword("");
                  setDisplayName("");
                }}
                style={{
                  border: "none",
                  background: "none",
                  color: "#56c1b0",
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
      <footer
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          background: footerBackground,
          color: footerColor,
          textAlign: "center",
          padding: 12,
          fontFamily: "Calibri, Arial, Helvetica, sans-serif",
          fontSize: 14,
        }}
      >
        © 2025 Aramco Digital. All rights reserved.
      </footer>
      <style jsx>{`
        input::placeholder {
          color: ${isDark ? "#cbd5f5" : "#000000"};
        }

        input::-ms-input-placeholder {
          color: ${isDark ? "#cbd5f5" : "#000000"};
        }

        input:-ms-input-placeholder {
          color: ${isDark ? "#cbd5f5" : "#000000"};
        }
      `}</style>
    </div>
  );
}


