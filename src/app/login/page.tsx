"use client";

import Image from "next/image";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Removed time display per request

  function isValidCompanyEmail(value: string) {
    return /^[\w.+-]+@[aA][rR][aA][mM][cC][oO][dD][iI][gG][iI][tT][aA][lL]\.com$/.test(value.trim());
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

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
      setSuccess("Login successful (demo).");
    } catch (err) {
      setError("Login failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Calibri, Arial, Helvetica, sans-serif",
        padding: 16,
        background: "#ffffff",
      }}
    >
      <div
        style={{
            width: "100%",
            maxWidth: 440,
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 28,
            textAlign: "center",
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
            background: "#f7f7f7",
        }}
      >
        <div style={{ display: "grid", placeItems: "center", gap: 8, marginBottom: 16 }}>
          <Image
            src="/rt.jpeg"
            alt="Aramco Digital"
            width={160}
            height={64}
            style={{
              height: "auto",
              width: "auto",
              maxWidth: "100%",
              mixBlendMode: "multiply", // visually blends white background away on light themes
              display: "block",
            }}
          />
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Login</h1>
        <p style={{ color: "var(--muted)", marginBottom: 20 }}>
          Use your <strong>@aramcodigital.com</strong> email to continue.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6, textAlign: "left" }}>
            <span style={{ fontWeight: 600, textAlign: "center" }}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@aramcodigital.com"
              required
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "inherit",
                textAlign: "center",
                outline: "none",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, textAlign: "left" }}>
            <span style={{ fontWeight: 600, textAlign: "center" }}>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "inherit",
                textAlign: "center",
                outline: "none",
              }}
            />
          </label>

          {error ? (
            <div style={{ color: "#ef4444", fontSize: 14, textAlign: "center" }}>{error}</div>
          ) : null}
          {success ? (
            <div style={{ color: "#22c55e", fontSize: 14, textAlign: "center" }}>{success}</div>
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
    </div>
  );
}


