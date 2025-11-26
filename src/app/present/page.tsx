"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { collection, getDocs, orderBy, query, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { decryptText } from "@/lib/encryption";
import styles from "@/app/editor/[id]/editor.module.css";

type PresentSlide = {
  id: string;
  order: number;
  title: string;
  content: string;
  notes: string;
  theme: string;
  imageUrl?: string;
  imageX?: number;
  imageY?: number;
  imageWidth?: number;
  imageHeight?: number;
};

export default function PresentPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const presentationId = searchParams.get("presentationId");
  const initialIndex = Number.parseInt(searchParams.get("slideIndex") ?? "0", 10);
  const [slides, setSlides] = useState<PresentSlide[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(Number.isNaN(initialIndex) ? 0 : initialIndex);
  const [presentationBackground, setPresentationBackground] = useState<"default" | "soft" | "dark">("default");

  useEffect(() => {
    setActiveIndex(Number.isNaN(initialIndex) ? 0 : initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (!presentationId) {
      setSlides([]);
      setErrorMessage("Missing presentation identifier.");
      return;
    }

    const loadSlides = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        // Load presentation background
        const presentationRef = doc(db, "presentations", presentationId);
        const presentationSnap = await getDoc(presentationRef);
        if (presentationSnap.exists()) {
          const presentationData = presentationSnap.data();
          if (presentationData?.background && typeof presentationData.background === "string") {
            if (presentationData.background === "default" || presentationData.background === "soft" || presentationData.background === "dark") {
              setPresentationBackground(presentationData.background);
            }
          }
        }

        const slidesRef = collection(db, "presentations", presentationId, "slides");
        const slidesQuery = query(slidesRef, orderBy("order", "asc"));
        const snapshot = await getDocs(slidesQuery);

        if (snapshot.empty) {
          setSlides([]);
          setErrorMessage("No slides available for this presentation.");
          return;
        }

        const loadedSlides: PresentSlide[] = snapshot.docs.map((docSnap, index) => {
          const data = docSnap.data();
          const rawContent = typeof data.content === "string" ? data.content : "";
          const rawNotes = typeof data.notes === "string" ? data.notes : "";
          const decryptedContent = rawContent ? decryptText(rawContent) : "";
          const decryptedNotes = rawNotes ? decryptText(rawNotes) : "";

          const finalContent =
            decryptedContent ||
            (typeof data.subtitle === "string" ? data.subtitle : "") ||
            rawContent ||
            "";
          const finalNotes = decryptedNotes || rawNotes || "";

          const slideData = {
            id: docSnap.id,
            order: typeof data.order === "number" ? data.order : index + 1,
            title: typeof data.title === "string" ? data.title : "",
            content: finalContent,
            notes: finalNotes,
            theme: typeof data.theme === "string" ? data.theme : "default",
            imageUrl: typeof data.imageUrl === "string" && data.imageUrl.length > 0 ? data.imageUrl : undefined,
            imageX: typeof data.imageX === "number" ? data.imageX : undefined,
            imageY: typeof data.imageY === "number" ? data.imageY : undefined,
            imageWidth: typeof data.imageWidth === "number" ? data.imageWidth : undefined,
            imageHeight: typeof data.imageHeight === "number" ? data.imageHeight : undefined,
          };
          
          // Debug: Log image data if present
          if (slideData.imageUrl) {
            console.log("Present: Loaded slide with image", {
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
        setActiveIndex((prev) => {
          if (prev < 0) return 0;
          if (prev >= loadedSlides.length) return loadedSlides.length - 1;
          return prev;
        });
      } catch (error) {
        console.error("Failed to load slides for presentation mode:", error);
        setErrorMessage("Unable to load presentation slides.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadSlides();
  }, [presentationId]);

  const totalSlides = slides.length;
  const activeSlide = useMemo(
    () => (totalSlides > 0 && activeIndex >= 0 && activeIndex < totalSlides ? slides[activeIndex] : null),
    [slides, activeIndex, totalSlides]
  );

  // Get background class based on presentation background
  const backgroundClass =
    presentationBackground === "soft"
      ? styles.softBackground
      : presentationBackground === "dark"
      ? styles.darkBackground
      : styles.defaultBackground;

  const handleNavigate = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= totalSlides) return;
    setActiveIndex(nextIndex);
    const params = new URLSearchParams(searchParams.toString());
    params.set("slideIndex", String(nextIndex));
    router.replace(`/present?${params.toString()}`);
  };

  return (
    <div className={styles.presentationModeShell}>
      <header className={styles.presentationModeHeader}>
        <div>
          <Link href="/presentations" className={styles.presentationModeBackLink}>
            ← Back to Secure Presentations
          </Link>
          <div className={styles.presentationModeMeta}>
            {presentationId ? <span>Presentation: {presentationId}</span> : <span>No presentation selected</span>}
            {totalSlides > 0 ? <span>Slide {activeIndex + 1} of {totalSlides}</span> : null}
          </div>
        </div>
        <div className={styles.presentationModeActions}>
          <button
            type="button"
            onClick={() => handleNavigate(activeIndex - 1)}
            disabled={activeIndex <= 0 || isLoading}
            className={styles.presentationModeButton}
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => handleNavigate(activeIndex + 1)}
            disabled={activeIndex >= totalSlides - 1 || isLoading}
            className={styles.presentationModeButton}
          >
            Next
          </button>
        </div>
      </header>

      <main className={styles.presentationModeMain}>
        {isLoading ? (
          <div className={styles.presentationModeEmpty}>Loading presentation…</div>
        ) : errorMessage ? (
          <div className={styles.presentationModeEmpty}>{errorMessage}</div>
        ) : activeSlide ? (
          <article className={`${styles.presentationModeSlide} ${backgroundClass}`} style={{ position: "relative" }}>
            {/* Aramco Digital Logo in top right */}
            <div style={{
              position: "absolute",
              top: "16px",
              right: "20px",
              zIndex: 10,
              pointerEvents: "none",
              maxWidth: "120px",
              height: "auto",
            }}>
              <img src="/aramco-digital.png" alt="Aramco Digital" style={{ width: "100%", height: "auto", objectFit: "contain", display: "block" }} />
            </div>
            <h1 className={styles.presentationModeTitle}>{activeSlide.title || "Untitled slide"}</h1>
            <div
              className={styles.presentationModeContent}
              dangerouslySetInnerHTML={{ __html: activeSlide.content || "<p>Click to add content</p>" }}
            />
            {/* Image display */}
            {activeSlide.imageUrl && (() => {
              const imageX = activeSlide.imageX ?? 50;
              const imageY = activeSlide.imageY ?? 50;
              const imageWidth = activeSlide.imageWidth ?? 30;
              const imageHeight = activeSlide.imageHeight ?? 30;
              
              console.log("Present: Rendering image", {
                imageUrl: activeSlide.imageUrl?.substring(0, 50) + "...",
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
                    src={activeSlide.imageUrl} 
                    alt="" 
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      borderRadius: "8px",
                      display: "block",
                    }}
                    onError={(e) => {
                      console.error("Failed to load image in present mode:", activeSlide.imageUrl);
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                    onLoad={() => {
                      console.log("Image loaded successfully in present mode");
                    }}
                  />
                </div>
              );
            })()}
            {activeSlide.notes ? (
              <section className={styles.presentationModeNotes}>
                <h2>Presenter Notes</h2>
                <p>{activeSlide.notes}</p>
              </section>
            ) : null}
          </article>
        ) : (
          <div className={styles.presentationModeEmpty}>Select a presentation to view.</div>
        )}
      </main>
    </div>
  );
}

