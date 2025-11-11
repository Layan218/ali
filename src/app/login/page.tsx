"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/hooks/useTheme";

export default function LoginPage() {
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  // Removed time display per request

  function isValidCompanyEmail(value: string) {
    return /^[\w.+-]+@[aA][rR][aA][mM][cC][oO][dD][iI][gG][iI][tT][aA][lL]\.com$/.test(value.trim());
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    if (!isValidCompanyEmail(email)) {
      setError("Only @aramcodigital.com emails can log in.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 500));
      router.push("/presentations");
    } catch {
      setError("Login failed. Please try again.");
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
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: foregroundColor }}>Login</h1>
        <p style={{ color: foregroundColor, marginBottom: 20 }}>
          Use your <strong>@aramcodigital.com</strong> email to continue.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6, textAlign: "left", color: foregroundColor }}>
            <span style={{ fontWeight: 600, textAlign: "center", color: foregroundColor }}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@aramcodigital.com"
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
            }}
            onMouseDown={(e) => (e.currentTarget.style.filter = "brightness(0.95)")}
            onMouseUp={(e) => (e.currentTarget.style.filter = "none")}
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
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


