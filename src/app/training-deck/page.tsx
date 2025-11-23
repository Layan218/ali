"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import TeamChatWidget from "@/components/TeamChatWidget";
import ThemeToggle from "@/components/ThemeToggle";
import { useTheme } from "@/hooks/useTheme";
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
  const { theme } = useTheme(); // Initialize theme hook to ensure dark class is applied
  const router = useRouter();
  const pathname = usePathname();
  const [slides, setSlides] = useState(defaultSlides);
  const [activeSlideId, setActiveSlideId] = useState(defaultSlides[0].id);

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
          <ThemeToggle />
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
