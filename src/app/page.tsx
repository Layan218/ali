"use client";

import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";
import styles from "./page.module.css";

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const features = [
    {
      title: "Secure Login & Role Management",
      description: "Login with @aramcodigital.com and control access for Viewer and Editor roles.",
    },
    {
      title: "Slide Editor (Basic)",
      description: "Create and edit slides with titles, text, images, and basic formatting.",
    },
    {
      title: "Secure Database Storage",
      description: "Store presentations safely in a private internal database.",
    },
    {
      title: "Basic Encryption",
      description: "Encrypt data before saving to protect sensitive content.",
    },
    {
      title: "Audit Log System",
      description: "Track who viewed or edited each presentation and when.",
    },
    {
      title: "Internal Comments",
      description: "Add comments and feedback inside the system for team collaboration.",
    },
    {
      title: "Presentation Mode (Viewer)",
      description: "Present slides in a clean full-screen viewer with next/previous controls.",
    },
    {
      title: "Live Team Chat",
      description: "Communicate instantly with your team while editing presentations in real time.",
    },
    {
      title: "Version History & Restore",
      description: "View previous versions of your presentation and easily restore older edits.",
    },
  ];

  const securityHighlights = [
    {
      title: "Zero-Trust Access",
      description: "Every session is authenticated with Aramco Digital SSO and scoped to least-privilege roles.",
    },
    {
      title: "End-to-End Encryption",
      description: "Slides, comments, and attachments are encrypted in transit and at rest using AES-256.",
    },
    {
      title: "24/7 Monitoring",
      description: "Security operations receive real-time alerts for anomalous access across all presentations.",
    },
    {
      title: "Tamper-Proof Auditing",
      description: "Immutable audit logs capture edits, views, and exports for regulatory compliance.",
    },
  ];

  return (
    <>
      {/* Top Navigation */}
      <nav className={styles.nav}>
        <div className={styles.logoWrap}>
          <img src="/aramco-digital.png" alt="Aramco Digital" className={styles.logo} />
        </div>
        {pathname === "/" ? (
        <div className={styles.navLinks}>
          <a href="#features" className={styles.navLink}>Features</a>
          <a href="#security" className={styles.navLink}>Security</a>
        </div>
        ) : <div />}
        <div className={styles.topRightActions}>
          <ThemeToggle />
          {!loading && !user ? (
          <button
            type="button"
            className={styles.primary}
            onClick={() => router.push("/login")}
          >
              Sign in
          </button>
          ) : null}
        </div>
      </nav>

      {/* Hero Section */}
      <main className={styles.hero}>
        <div className={styles.centered}>
          <h1 className={styles.title}>Secure Presentation Tool</h1>
          <p className={styles.description}>
            You can create and present secure, professional presentations directly in your browser — exclusively for Aramco Digital.
          </p>
          <div className={styles.heroActions}>
            <a href="/login" className={styles.primaryButton}>
              Sign in
            </a>
          </div>
          {!loading && !user && (
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={() => router.push("/login")}>
                Sign in
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Features Section */}
      <section id="features" className={styles.features}>
        <div className={styles.featuresContainer}>
          <h2 className={styles.featuresTitle}>Features</h2>
          <div className={styles.featuresGrid}>
            {features.map((feature, index) => (
              <div key={index} className={styles.featureCard}>
                <h3 className={styles.featureCardTitle}>{feature.title}</h3>
                <p className={styles.featureCardDescription}>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="security" className={styles.features}>
        <div className={styles.featuresContainer}>
          <h2 className={styles.featuresTitle}>Security</h2>
          <div className={styles.featuresGrid}>
            {securityHighlights.map((item, index) => (
              <div key={item.title + index} className={styles.featureCard}>
                <h3 className={styles.featureCardTitle}>{item.title}</h3>
                <p className={styles.featureCardDescription}>{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        © 2025 Aramco Digital - Secure Presentation Tool
      </footer>
    </>
  );
}
