'use client';

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { demoSlides } from "@/data/demoSlides";
import styles from "./viewer.module.css";

type Slide = typeof demoSlides[number];

const getSlidesForPresentation = (presentationId?: string | null): Slide[] => {
  if (!presentationId) {
    return demoSlides;
  }
  const filtered = demoSlides.filter((slide) => slide.presentationId === presentationId);
  return filtered.length > 0 ? filtered : demoSlides;
};

const findSlideIndex = (slides: Slide[], slideId?: string | null): number => {
  if (!slideId) return 0;
  const idx = slides.findIndex((slide) => slide.id === slideId);
  return idx >= 0 ? idx : 0;
};

export default function ViewerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slideId = searchParams.get("slideId");
  const presentationId = searchParams.get("presentationId");

  const slides = getSlidesForPresentation(presentationId);
  const startingIndex = findSlideIndex(slides, slideId);

  const [index, setIndex] = useState(startingIndex);
  const slide = slides[index];

  const totalSlides = slides.length;
  const slidePosition = `${index + 1} of ${totalSlides}`;

  const handlePrevious = () => {
    setIndex((value) => Math.max(0, value - 1));
  };

  const handleNext = () => {
    setIndex((value) => Math.min(totalSlides - 1, value + 1));
  };

  return (
    <div className={styles.viewerShell}>
      <header className={styles.viewerHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.presentationTitle}>Presentation Mode</span>
        </div>
        <div className={styles.headerCenter}>
          <span className={styles.currentSlideTitle}>{slide.title}</span>
        </div>
        <div className={styles.headerRight}>
          <button
            type="button"
            className={styles.exitButton}
            onClick={() => {
              if (presentationId) {
                router.push(`/dashboard?presentationId=${encodeURIComponent(presentationId)}`);
              } else {
                router.push("/dashboard");
              }
            }}
          >
            Exit
          </button>
        </div>
      </header>

      <main className={styles.viewerMain}>
        <article className={`${styles.slideCard} ${styles.slideCardActive}`}>
          <h1 className={styles.slideTitle}>{slide.title}</h1>
          <p className={styles.slideContent}>{slide.subtitle}</p>
        </article>
      </main>

      <footer className={styles.viewerFooter}>
        <div className={styles.footerControls}>
          <button type="button" className={styles.navButton} onClick={handlePrevious} disabled={index === 0}>
            ⬅️ Previous
          </button>
          <span className={styles.slidePosition}>Slide {slidePosition}</span>
          <button
            type="button"
            className={styles.navButton}
            onClick={handleNext}
            disabled={index === totalSlides - 1}
          >
            Next ➡️
          </button>
        </div>
      </footer>
    </div>
  );
}
