'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { demoSlides } from "@/data/demoSlides";
import { useTheme } from "@/hooks/useTheme";
import styles from "./viewer.module.css";

type DemoSlide = typeof demoSlides[number];

type ViewerSlide = {
  id: string;
  title?: string;
  subtitle?: string;
  notes?: string;
  presentationId?: string;
};

type ViewerState = {
  presentationId?: string | null;
  slideId?: string | null;
  presentationTitle?: string;
  slides?: ViewerSlide[];
};

const VIEWER_RETURN_KEY = "viewer-return-url";
const VIEWER_STATE_KEY = "viewer-state";

const getSlidesForPresentation = (presentationId?: string | null): ViewerSlide[] => {
  if (!presentationId) {
    return demoSlides;
  }
  const filtered = demoSlides.filter((slide) => slide.presentationId === presentationId);
  return filtered.length > 0 ? filtered : demoSlides;
};

const findSlideIndex = (slides: ViewerSlide[], slideId?: string | null): number => {
  if (!slideId) return 0;
  const idx = slides.findIndex((slide) => slide.id === slideId);
  return idx >= 0 ? idx : 0;
};

const normalizeSlide = (slide: ViewerSlide | DemoSlide | undefined): ViewerSlide => {
  if (!slide) {
    return { id: "unknown-slide", title: "Untitled slide", subtitle: "" };
  }
  return {
    id: slide.id ?? "unknown-slide",
    title: slide.title ?? "Untitled slide",
    subtitle: slide.subtitle ?? "",
    notes: slide.notes ?? "",
    presentationId: (slide as DemoSlide).presentationId ?? undefined,
  };
};

function ViewerContent() {
  useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const querySlideId = searchParams.get("slideId");
  const queryPresentationId = searchParams.get("presentationId");

  const [viewerState, setViewerState] = useState<ViewerState | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(VIEWER_STATE_KEY);
      if (!raw) {
        setViewerState(null);
        return;
      }
      const parsed = JSON.parse(raw) as ViewerState;
      setViewerState(parsed);
    } catch (error) {
      console.error("Failed to load viewer state", error);
      setViewerState(null);
    }
  }, []);

  const slides = useMemo<ViewerSlide[]>(() => {
    if (viewerState?.slides && viewerState.slides.length > 0) {
      return viewerState.slides.map((slide, index) => ({
        id: slide.id || `slide-${index + 1}`,
        title: slide.title ?? "Untitled slide",
        subtitle: slide.subtitle ?? "",
        notes: slide.notes ?? "",
      }));
    }
    return getSlidesForPresentation(queryPresentationId);
  }, [viewerState, queryPresentationId]);

  const initialSlideId = viewerState?.slideId ?? querySlideId;
  const [index, setIndex] = useState(() => findSlideIndex(slides, initialSlideId));

  useEffect(() => {
    setIndex(findSlideIndex(slides, initialSlideId));
  }, [slides, initialSlideId]);

  const slide = normalizeSlide(slides[index]);

  const totalSlides = slides.length > 0 ? slides.length : 1;
  const slidePosition = `${Math.min(index + 1, totalSlides)} of ${totalSlides}`;

  const slideRef = useRef<HTMLElement>(null);

  const handlePrevious = () => {
    setIndex((value) => Math.max(0, value - 1));
  };

  const handleNext = () => {
    setIndex((value) => Math.min(totalSlides - 1, value + 1));
  };

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenElement =
        document.fullscreenElement ||
        (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
        (document as unknown as { msFullscreenElement?: Element }).msFullscreenElement;
      setIsFullscreen(fullscreenElement === slideRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange as EventListener);
    document.addEventListener("msfullscreenchange", handleFullscreenChange as EventListener);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange as EventListener);
      document.removeEventListener("msfullscreenchange", handleFullscreenChange as EventListener);
    };
  }, []);

  const toggleFullscreen = () => {
    if (typeof document === "undefined" || !slideRef.current) return;
    const slideEl = slideRef.current as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
      msRequestFullscreen?: () => Promise<void> | void;
    };
    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void> | void;
      msExitFullscreen?: () => Promise<void> | void;
    };

    if (!isFullscreen) {
      if (slideEl.requestFullscreen) {
        void slideEl.requestFullscreen();
      } else if (slideEl.webkitRequestFullscreen) {
        slideEl.webkitRequestFullscreen();
      } else if (slideEl.msRequestFullscreen) {
        slideEl.msRequestFullscreen();
      }
    } else {
      if (doc.exitFullscreen) {
        void doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      } else if (doc.msExitFullscreen) {
        doc.msExitFullscreen();
      }
    }
  };

  const handleExit = () => {
    let pmodeEntry: string | null = null;
    const previousRoute =
      typeof window !== "undefined" ? window.sessionStorage.getItem(VIEWER_RETURN_KEY) : null;
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(VIEWER_RETURN_KEY);
      window.sessionStorage.removeItem(VIEWER_STATE_KEY);
      try {
        pmodeEntry = window.localStorage.getItem("pmodeEntry");
        window.localStorage.removeItem("pmodeEntry");
      } catch {
        pmodeEntry = null;
      }
    }

    let target = "/slides";
    if (pmodeEntry === "dashboard" || previousRoute?.includes("/dashboard")) {
      target = "/dashboard";
    } else if (previousRoute && (previousRoute.includes("/editor") || previousRoute.includes("/show"))) {
      target = previousRoute;
    }

    router.push(target);
  };

  return (
    <div className={styles.viewerShell}>
      <header className={styles.viewerHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.presentationTitle}>
            {viewerState?.presentationTitle ?? "Presentation Mode"}
          </span>
        </div>
        <div className={styles.headerCenter}>
          <span className={styles.currentSlideTitle}>{slide.title}</span>
        </div>
        <div className={styles.headerRight}>
          <button
            type="button"
            className={styles.exitButton}
            onClick={() => {
              handleExit();
            }}
          >
            Exit
          </button>
        </div>
      </header>

      <main className={styles.viewerMain}>
        <article ref={slideRef} className={`${styles.slideCard} ${styles.slideCardActive}`}>
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
          <div className={styles.footerRight}>
            <button
              type="button"
              className={`${styles.navButton} ${styles.fullscreenButton}`}
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? "🔳" : "⛶"}
            </button>
            <button
              type="button"
              className={styles.navButton}
              onClick={handleNext}
              disabled={index >= totalSlides - 1}
            >
              Next ➡️
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function ViewerPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, fontFamily: "Calibri, Arial, sans-serif" }}>Loading viewer…</div>}>
      <ViewerContent />
    </Suspense>
  );
}
