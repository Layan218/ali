"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
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

          return {
            id: docSnap.id,
            order: typeof data.order === "number" ? data.order : index + 1,
            title: typeof data.title === "string" ? data.title : "",
            content: finalContent,
            notes: finalNotes,
            theme: typeof data.theme === "string" ? data.theme : "default",
          };
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
          <article className={styles.presentationModeSlide}>
            <h1 className={styles.presentationModeTitle}>{activeSlide.title || "Untitled slide"}</h1>
            <div
              className={styles.presentationModeContent}
              dangerouslySetInnerHTML={{ __html: activeSlide.content || "<p>Click to add content</p>" }}
            />
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

