'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./viewer.module.css";

type Slide = {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
};

const presentationTitle = "Q2 Strategy Briefing";

const slides: Slide[] = [
  {
    id: "slide-1",
    title: "Vision Alignment",
    content: "Reinforce our commitment to resilient energy transition with a focus on secure digital enablement across the enterprise.",
    imageUrl: "/slides/vision.png",
  },
  {
    id: "slide-2",
    title: "Key Metrics",
    content: "• 18% increase in operational uptime\n• 12% reduction in cybersecurity incidents\n• 26 new digital wells onboarded this quarter",
  },
  {
    id: "slide-3",
    title: "Action Items",
    content: "1. Finalize stakeholder workshops\n2. Launch digital twin pilot\n3. Prepare executive summary for Board review",
    imageUrl: "/slides/action-items.png",
  },
];

export default function ViewerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSlideId = searchParams.get("slideId");
  const presentationId = searchParams.get("presentationId");
  const initialIndex = useMemo(() => {
    if (!requestedSlideId) return 0;
    const found = slides.findIndex((slide) => slide.id === requestedSlideId);
    return found >= 0 ? found : 0;
  }, [requestedSlideId]);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    if (initialIndex !== currentIndex) {
      setCurrentIndex(initialIndex);
    }
  }, [initialIndex, currentIndex]);

  const currentSlide = useMemo(() => slides[currentIndex], [currentIndex]);
  const totalSlides = slides.length;
  const slidePosition = `${currentIndex + 1} of ${totalSlides}`;

  useEffect(() => {
    if (!transitioning) return;
    const timeout = setTimeout(() => setTransitioning(false), 220);
    return () => clearTimeout(timeout);
  }, [transitioning]);

  const handlePrevious = () => {
    if (currentIndex === 0 || transitioning) return;
    setTransitioning(true);
    setCurrentIndex((index) => Math.max(0, index - 1));
  };

  const handleNext = () => {
    if (currentIndex === totalSlides - 1 || transitioning) return;
    setTransitioning(true);
    setCurrentIndex((index) => Math.min(totalSlides - 1, index + 1));
  };

  return (
    <div className={styles.viewerShell}>
      <header className={styles.viewerHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.presentationTitle}>{presentationTitle}</span>
        </div>
        <div className={styles.headerCenter}>
          <span className={styles.currentSlideTitle}>{currentSlide.title}</span>
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
        <article
          className={`${styles.slideCard} ${transitioning ? styles.slideCardTransition : styles.slideCardActive}`}
        >
          <h1 className={styles.slideTitle}>{currentSlide.title}</h1>
          <p className={styles.slideContent}>
            {currentSlide.content.split("\n").map((line, index) => (
              <span key={`${line}-${index}`}>
                {line}
                <br />
              </span>
            ))}
          </p>
        </article>
      </main>

      <footer className={styles.viewerFooter}>
        <div className={styles.footerControls}>
          <button type="button" className={styles.navButton} onClick={handlePrevious} disabled={currentIndex === 0 || transitioning}>
            ⬅️ Previous
          </button>
          <span className={styles.slidePosition}>Slide {slidePosition}</span>
          <button
            type="button"
            className={styles.navButton}
            onClick={handleNext}
            disabled={currentIndex === totalSlides - 1 || transitioning}
          >
            Next ➡️
          </button>
        </div>
      </footer>
    </div>
  );
}
