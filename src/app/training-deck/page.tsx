"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import TeamChatWidget from "@/components/TeamChatWidget";
import styles from "./training-deck.module.css";

type TrainingSlide = {
  id: string;
  title: string;
};

const defaultSlides: TrainingSlide[] = [
  { id: "train-1", title: "Welcome to Training" },
  { id: "train-2", title: "Learning Objectives" },
  { id: "train-3", title: "Case Study" },
  { id: "train-4", title: "Assessment / Review" },
];

export default function TrainingDeckPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);
  const [slides, setSlides] = useState(defaultSlides);
  const [activeSlideId, setActiveSlideId] = useState(defaultSlides[0].id);

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

  const toggleTheme = () => setIsDark((value) => !value);

  const activeSlide = slides.find((slide) => slide.id === activeSlideId) ?? slides[0];

  const handleAddSlide = () => {
    const nextNumber = slides.length + 1;
    const newSlide: TrainingSlide = {
      id: `train-${nextNumber}-${Date.now()}`,
      title: `New Training Slide ${nextNumber}`,
    };
    setSlides((prev) => [...prev, newSlide]);
    setActiveSlideId(newSlide.id);
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
            {isDark ? (
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
          <header className={styles.header}>
            <div className={styles.titleGroup}>
              <h1 className={styles.title}>Training Deck Builder</h1>
              <p className={styles.subtitle}>Create, edit, and share your internal training presentations securely.</p>
            </div>
            <div className={styles.headerActions}>
              <button type="button" className={styles.ghostButton} onClick={handleAddSlide}>
                Add Slide
              </button>
              <button type="button" className={styles.outlineButton}>
                Save
              </button>
              <button type="button" className={styles.primaryButton}>
                Start Training Mode
              </button>
            </div>
          </header>

          <div className={styles.layout}>
            <aside className={styles.sidebar}>
              <h2 className={styles.sidebarHeading}>Slides</h2>
              <ol className={styles.slideList}>
                {slides.map((slide) => (
                  <li key={slide.id}>
                    <button
                      type="button"
                      className={`${styles.slideListItem} ${slide.id === activeSlideId ? styles.slideListItemActive : ""}`}
                      onClick={() => setActiveSlideId(slide.id)}
                    >
                      {slide.title}
                    </button>
                  </li>
                ))}
              </ol>
            </aside>

            <section className={styles.canvas}>
              <div className={styles.canvasCard}>
                <h3 className={styles.canvasTitle}>{activeSlide?.title ?? "Training Slide"}</h3>
                <p className={styles.canvasSubtitle}>
                  Tailor this slide with relevant training content, visuals, and interactive checkpoints to reinforce learning.
                </p>
              </div>
              <div className={styles.canvasNotes}>
                <h4>Trainer Notes</h4>
                <p>
                  Capture speaker notes, facilitation tips, or talking points to ensure each training session stays consistent and impactful.
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>

      <footer className={styles.footer}>© 2025 Aramco Digital – Secure Presentation Tool</footer>

      <TeamChatWidget />
    </>
  );
}
