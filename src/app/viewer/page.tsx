'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, getDocs, orderBy, query, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { decryptText } from "@/lib/encryption";
import { demoSlides } from "@/data/demoSlides";
import { useTheme } from "@/hooks/useTheme";
import styles from "./viewer.module.css";
import editorStyles from "@/app/editor/[id]/editor.module.css";

type DemoSlide = typeof demoSlides[number];

type ViewerSlide = {
  id: string;
  title?: string;
  subtitle?: string;
  notes?: string;
  presentationId?: string;
  imageUrl?: string;
  imageX?: number;
  imageY?: number;
  imageWidth?: number;
  imageHeight?: number;
};

type ViewerState = {
  presentationId?: string | null;
  slideId?: string | null;
  presentationTitle?: string;
  presentationBackground?: "default" | "soft" | "dark";
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
  const viewerSlide = slide as ViewerSlide;
  return {
    id: slide.id ?? "unknown-slide",
    title: slide.title ?? "Untitled slide",
    subtitle: slide.subtitle ?? "",
    notes: viewerSlide.notes ?? "",
    presentationId: (slide as DemoSlide).presentationId ?? undefined,
    imageUrl: viewerSlide.imageUrl,
    imageX: viewerSlide.imageX,
    imageY: viewerSlide.imageY,
    imageWidth: viewerSlide.imageWidth,
    imageHeight: viewerSlide.imageHeight,
  };
};

function ViewerContent() {
  useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const querySlideId = searchParams.get("slideId");
  const queryPresentationId = searchParams.get("presentationId");

  const [viewerState, setViewerState] = useState<ViewerState | null>(null);
  const [slides, setSlides] = useState<ViewerSlide[]>([]);
  const [presentationTitle, setPresentationTitle] = useState<string>("Presentation Mode");
  const [presentationBackground, setPresentationBackground] = useState<"default" | "soft" | "dark">("default");
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedSlides, setHasLoadedSlides] = useState(false);

  // Load viewer state from sessionStorage and slides from Firestore
  useEffect(() => {
    if (hasLoadedSlides) return; // Prevent multiple loads

    const loadViewerData = async () => {
      setIsLoading(true);
      
      let storedState: ViewerState | null = null;
      let presentationId: string | null = null;
      
      // First, try to load from sessionStorage
      if (typeof window !== "undefined") {
        try {
          const raw = window.sessionStorage.getItem(VIEWER_STATE_KEY);
          if (raw) {
            storedState = JSON.parse(raw) as ViewerState;
            setViewerState(storedState);
            
            // If slides are already in state, use them
            if (storedState.slides && storedState.slides.length > 0) {
              setSlides(storedState.slides);
              if (storedState.presentationTitle) {
                setPresentationTitle(storedState.presentationTitle);
              }
              if (storedState.presentationBackground) {
                setPresentationBackground(storedState.presentationBackground);
              }
              setIsLoading(false);
              setHasLoadedSlides(true);
              return;
            }
            
            presentationId = storedState.presentationId || null;
          }
        } catch (error) {
          console.error("Failed to load viewer state", error);
        }
      }

      // If no slides in sessionStorage, load from Firestore
      if (!presentationId) {
        presentationId = queryPresentationId || null;
      }
      
      if (!presentationId) {
        // Fallback to demo slides if no presentationId
        setSlides(getSlidesForPresentation(null));
        setIsLoading(false);
        setHasLoadedSlides(true);
        return;
      }

      try {
        // Load presentation title and background
        const presentationRef = doc(db, "presentations", presentationId as string);
        const presentationSnap = await getDoc(presentationRef);
        if (presentationSnap.exists()) {
          const presentationData = presentationSnap.data();
          if (presentationData?.title) {
            setPresentationTitle(presentationData.title);
          }
          if (presentationData?.background && typeof presentationData.background === "string") {
            if (presentationData.background === "default" || presentationData.background === "soft" || presentationData.background === "dark") {
              setPresentationBackground(presentationData.background);
            }
          }
        }

        // Load slides
        const slidesRef = collection(db, "presentations", presentationId as string, "slides");
        const slidesQuery = query(slidesRef, orderBy("order", "asc"));
        const snapshot = await getDocs(slidesQuery);

        if (snapshot.empty) {
          // Fallback to demo slides if no slides found
          setSlides(getSlidesForPresentation(presentationId));
          setIsLoading(false);
          setHasLoadedSlides(true);
          return;
        }

        const loadedSlides: ViewerSlide[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const rawContent = typeof data.content === "string" ? data.content : "";
          const rawNotes = typeof data.notes === "string" ? data.notes : "";
          
          // Safely decrypt content
          let decryptedContent = "";
          if (rawContent) {
            try {
              // Check if content looks encrypted (CryptoJS encrypted strings start with "U2FsdGVk")
              const looksEncrypted = rawContent.startsWith("U2FsdGVk");
              
              if (looksEncrypted) {
                // Try to decrypt
                const decrypted = decryptText(rawContent);
                // If decryptText returns the same string or still looks encrypted, decryption failed
                if (decrypted === rawContent || (decrypted && decrypted.startsWith("U2FsdGVk"))) {
                  // Decryption failed - the function returned the encrypted string unchanged
                  // This means the content couldn't be decrypted, so use empty and fall back to subtitle
                  console.warn("Failed to decrypt content - decryption returned encrypted string");
                  decryptedContent = "";
                } else {
                  // Decryption succeeded
                  decryptedContent = decrypted || "";
                }
              } else {
                // Content doesn't look encrypted, use it as-is (might be plain text)
                decryptedContent = rawContent;
              }
            } catch (error) {
              // If decryption fails with exception, use empty and fall back to subtitle
              console.warn("Failed to decrypt content:", error);
              decryptedContent = "";
            }
          }
          
          // Safely decrypt notes
          let decryptedNotes = "";
          if (rawNotes) {
            try {
              // Check if notes look encrypted
              const looksEncrypted = rawNotes.startsWith("U2FsdGVk");
              
              if (looksEncrypted) {
                // Try to decrypt
                const decrypted = decryptText(rawNotes);
                // If decryptText returns the same string or still looks encrypted, decryption failed
                if (decrypted === rawNotes || (decrypted && decrypted.startsWith("U2FsdGVk"))) {
                  // Decryption failed
                  console.warn("Failed to decrypt notes - decryption returned encrypted string");
                  decryptedNotes = "";
                } else {
                  // Decryption succeeded
                  decryptedNotes = decrypted || "";
                }
              } else {
                // Notes don't look encrypted, use as-is (might be plain text)
                decryptedNotes = rawNotes;
              }
            } catch (error) {
              // If decryption fails with exception, use empty
              console.warn("Failed to decrypt notes:", error);
              decryptedNotes = "";
            }
          }

          // Build final content - prefer decrypted content, then subtitle field, then empty
          const finalContent =
            decryptedContent ||
            (typeof data.subtitle === "string" ? data.subtitle : "") ||
            "";

          const slideData = {
            id: docSnap.id,
            title: typeof data.title === "string" ? data.title : "Untitled slide",
            subtitle: finalContent,
            notes: decryptedNotes || "",
            presentationId: presentationId as string,
            imageUrl: typeof data.imageUrl === "string" && data.imageUrl.length > 0 ? data.imageUrl : undefined,
            imageX: typeof data.imageX === "number" ? data.imageX : undefined,
            imageY: typeof data.imageY === "number" ? data.imageY : undefined,
            imageWidth: typeof data.imageWidth === "number" ? data.imageWidth : undefined,
            imageHeight: typeof data.imageHeight === "number" ? data.imageHeight : undefined,
          };
          
          // Debug: Log image data if present
          if (slideData.imageUrl) {
            console.log("Viewer: Loaded slide with image", {
              slideId: slideData.id,
              hasImageUrl: !!slideData.imageUrl,
              imageX: slideData.imageX,
              imageY: slideData.imageY,
              imageWidth: slideData.imageWidth,
              imageHeight: slideData.imageHeight,
            });
          }
          
          return slideData;
        });

        setSlides(loadedSlides);
      } catch (error) {
        console.error("Failed to load slides from Firestore:", error);
        // Fallback to demo slides on error
        setSlides(getSlidesForPresentation(presentationId));
      } finally {
        setIsLoading(false);
        setHasLoadedSlides(true);
      }
    };

    void loadViewerData();
  }, [queryPresentationId, hasLoadedSlides]);

  // Get initial slide ID from viewerState, sessionStorage, or query params
  const initialSlideId = useMemo(() => {
    if (viewerState?.slideId) return viewerState.slideId;
    if (typeof window !== "undefined") {
      try {
        const raw = window.sessionStorage.getItem(VIEWER_STATE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as ViewerState;
          if (parsed.slideId) return parsed.slideId;
        }
      } catch {
        // Ignore errors
      }
    }
    return querySlideId;
  }, [viewerState, querySlideId]);

  const [index, setIndex] = useState(() => findSlideIndex(slides, initialSlideId));

  useEffect(() => {
    if (slides.length > 0) {
      setIndex(findSlideIndex(slides, initialSlideId));
    }
  }, [slides, initialSlideId]);

  const slide = normalizeSlide(slides[index]);

  const totalSlides = slides.length > 0 ? slides.length : 1;
  const slidePosition = `${Math.min(index + 1, totalSlides)} of ${totalSlides}`;

  // Get background class based on presentation background
  const backgroundClass =
    presentationBackground === "soft"
      ? editorStyles.softBackground
      : presentationBackground === "dark"
      ? editorStyles.darkBackground
      : editorStyles.defaultBackground;

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
            {presentationTitle}
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
        {isLoading ? (
          <div style={{ padding: 24, fontFamily: "Calibri, Arial, sans-serif", textAlign: "center" }}>
            Loading presentation…
          </div>
        ) : (
          <article ref={slideRef} className={`${styles.slideCard} ${styles.slideCardActive} ${backgroundClass}`} style={{ position: "relative", overflow: "visible" }}>
            <h1 className={styles.slideTitle}>{slide.title}</h1>
            <div 
              className={styles.slideContent}
              dangerouslySetInnerHTML={{ __html: slide.subtitle || "<p>Click to add content</p>" }}
            />
            {/* Image display */}
            {slide.imageUrl && (() => {
              const imageX = slide.imageX ?? 50;
              const imageY = slide.imageY ?? 50;
              const imageWidth = slide.imageWidth ?? 30;
              const imageHeight = slide.imageHeight ?? 30;
              
              console.log("Viewer: Rendering image", {
                imageUrl: slide.imageUrl?.substring(0, 50) + "...",
                imageX,
                imageY,
                imageWidth,
                imageHeight,
              });
              
              return (
                <div
                  style={{
                    position: "absolute",
                    left: `${imageX}%`,
                    top: `${imageY}%`,
                    transform: "translate(-50%, -50%)",
                    width: `${imageWidth}%`,
                    height: `${imageHeight}%`,
                    zIndex: 10,
                    pointerEvents: "none",
                  }}
                >
                  <img 
                    src={slide.imageUrl} 
                    alt="" 
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      borderRadius: "8px",
                      display: "block",
                    }}
                    onError={(e) => {
                      console.error("Failed to load image:", slide.imageUrl);
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                    onLoad={() => {
                      console.log("Image loaded successfully in viewer");
                    }}
                  />
                </div>
              );
            })()}
          </article>
        )}
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
