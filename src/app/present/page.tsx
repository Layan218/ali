"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { decryptText } from "@/lib/encryption";
import AutoPresentation from "@/components/AutoPresentation";
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
  const autoPlay = searchParams.get("autoPlay") === "true";
  const [slides, setSlides] = useState<PresentSlide[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(Number.isNaN(initialIndex) ? 0 : initialIndex);

  useEffect(() => {
    setActiveIndex(Number.isNaN(initialIndex) ? 0 : initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (!presentationId) {
      console.log("❌ Presentation ID:", presentationId);
      setSlides([]);
      setErrorMessage("Missing presentation identifier.");
      return;
    }

    console.log("📋 Presentation ID:", presentationId);
    console.log("🔍 Starting to load slides from Firebase...");

    const loadSlides = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        // Wait a bit to ensure Firebase is initialized
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log("📂 Loading slides for presentationId:", presentationId);
        console.log("🗄️ Firebase db instance:", db ? "initialized" : "NOT initialized");
        
        const collectionPath = `presentations/${presentationId}/slides`;
        console.log("📁 Collection path:", collectionPath);
        
        const slidesRef = collection(db, "presentations", presentationId, "slides");
        console.log("✅ Collection reference created");
        
        const slidesQuery = query(slidesRef, orderBy("order", "asc"));
        console.log("🔎 Executing Firestore query...");
        
        const snapshot = await getDocs(slidesQuery);

        console.log("📊 Firebase query result:", {
          empty: snapshot.empty,
          size: snapshot.size,
          docs: snapshot.docs.length,
          presentationId: presentationId,
        });

        // Log all document IDs for debugging
        if (snapshot.docs.length > 0) {
          console.log("📄 Found document IDs:", snapshot.docs.map(doc => doc.id));
        } else {
          console.warn("⚠️ No documents found in collection:", collectionPath);
          // Try to check if the presentation document exists
          const { doc, getDoc } = await import("firebase/firestore");
          const presentationRef = doc(db, "presentations", presentationId);
          const presentationSnap = await getDoc(presentationRef);
          console.log("📋 Presentation document exists:", presentationSnap.exists());
        }

        if (snapshot.empty) {
          console.warn("❌ No slides found in Firebase for presentation:", presentationId);
          setSlides([]);
          setErrorMessage(
            `No slides available for this presentation (ID: ${presentationId}). Please save your slides in the editor first.`
          );
          return;
        }

        const loadedSlides: PresentSlide[] = snapshot.docs.map((docSnap, index) => {
          const data = docSnap.data();
          console.log(`Slide ${index + 1} data:`, {
            id: docSnap.id,
            hasTitle: !!data.title,
            hasContent: !!data.content,
            hasSubtitle: !!data.subtitle,
            hasNotes: !!data.notes,
            order: data.order,
          });

          const rawTitle = typeof data.title === "string" ? data.title : "";
          const rawContent = typeof data.content === "string" ? data.content : "";
          const rawSubtitle = typeof data.subtitle === "string" ? data.subtitle : "";
          const rawNotes = typeof data.notes === "string" ? data.notes : "";

          // Try to decrypt (if encrypted) or use raw value
          const decryptedTitle = rawTitle ? (decryptText(rawTitle) || rawTitle) : "";
          const decryptedContent = rawContent ? (decryptText(rawContent) || rawContent) : "";
          const decryptedSubtitle = rawSubtitle ? (decryptText(rawSubtitle) || rawSubtitle) : "";
          const decryptedNotes = rawNotes ? (decryptText(rawNotes) || rawNotes) : "";

          // Use subtitle as content if content is empty
          const finalContent = decryptedContent || decryptedSubtitle || "";
          const finalNotes = decryptedNotes || "";

          return {
            id: docSnap.id,
            order: typeof data.order === "number" ? data.order : index + 1,
            title: decryptedTitle,
            content: finalContent,
            notes: finalNotes,
            theme: typeof data.theme === "string" ? data.theme : "default",
          };
        });

        console.log("✅ Fetched slides:", loadedSlides);
        console.log(`✅ Successfully loaded ${loadedSlides.length} slides`);
        console.log("📋 Presentation ID:", presentationId);
        setSlides(loadedSlides);
        setActiveIndex((prev) => {
          if (prev < 0) return 0;
          if (prev >= loadedSlides.length) return loadedSlides.length - 1;
          return prev;
        });
      } catch (error) {
        console.error("❌ Failed to load slides for presentation mode:", error);
        const errorDetails = error instanceof Error ? error.message : String(error);
        console.error("❌ Error details:", errorDetails);
        console.error("📋 Presentation ID:", presentationId);
        console.error("🗄️ Firebase db:", db ? "initialized" : "NOT initialized");
        setErrorMessage(
          `Unable to load presentation slides: ${errorDetails}. Please check your Firebase configuration and ensure slides are saved. Presentation ID: ${presentationId}`
        );
        setSlides([]);
      } finally {
        setIsLoading(false);
      }
    };

    // Load slides (Firebase should be initialized at module load time)
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
          <article 
            className={`${styles.presentationModeSlide} ${styles.slideFadeIn}`}
            key={`slide-${activeIndex}`}
          >
            <h1 className={styles.presentationModeTitle}>
              {activeSlide.title && activeSlide.title.trim() && activeSlide.title !== "Click to add title"
                ? activeSlide.title
                : ""}
            </h1>
            <div
              className={styles.presentationModeContent}
              dangerouslySetInnerHTML={{
                __html:
                  activeSlide.content &&
                  activeSlide.content.trim() &&
                  !activeSlide.content.includes("Click to add")
                    ? activeSlide.content
                    : "",
              }}
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

      {/* Always show AutoPresentation component, even if there are errors or no slides */}
      {!isLoading && (
        <AutoPresentation
          slides={slides}
          onSlideChange={handleNavigate}
          currentSlideIndex={activeIndex}
          presentationId={presentationId || ""}
          autoStart={autoPlay && slides.length > 0 && !errorMessage}
        />
      )}
    </div>
  );
}

