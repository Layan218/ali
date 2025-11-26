"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  addDoc,
  getDocs,
  query as firestoreQuery,
  orderBy,
  serverTimestamp
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { logAuditEvent } from "@/lib/audit";
import TeamChatWidget from "@/components/TeamChatWidget";
import styles from "./presentations.module.css";
import {
  readPresentationMeta,
  recordPresentationDraft,
  PRESENTATION_META_UPDATED_EVENT,
  type PresentationMeta,
} from "@/lib/presentationMeta";
import { useAuth } from "@/context/AuthContext";
import { encryptText } from "@/lib/encryption";
import { useTheme } from "@/hooks/useTheme";
import { generatePresentation, type AIPresentationSlide } from "@/services/aiPresentationService";
import { createDefaultFormatting } from "@/utils/formattingUtils";

type TemplateCard = {
  id: string;
  title: string;
  icon: ReactNode;
};

const templates: TemplateCard[] = [
  {
    id: "template-blank",
    title: "Blank presentation",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    ),
  },
  {
    id: "template-team-update",
    title: "Team update",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="8" cy="10" r="3" />
        <circle cx="16" cy="10" r="3" />
        <path d="M3 19c0-2.5 2-4.5 4.5-4.5h1" />
        <path d="M13.5 14.5h1C17 14.5 19 16.5 19 19" />
      </svg>
    ),
  },
  {
    id: "template-project-review",
    title: "Project review",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 19h16" />
        <path d="M8 19V9" />
        <path d="M12 19v-6" />
        <path d="M16 19v-9" />
        <path d="M7 5h10" />
        <path d="M14 5l2 2" />
        <path d="M14 5l-2 2" />
      </svg>
    ),
  },
  {
    id: "template-training",
    title: "Training deck",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 7h8a4 4 0 0 1 4 4v8H8a4 4 0 0 1-4-4V7z" />
        <path d="M12 3h8v12" />
        <path d="M12 9h4" />
      </svg>
    ),
  },
  {
    id: "template-executive",
    title: "Executive summary",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 4h9l3 3v13H6z" />
        <path d="m9 13 2 2 4-4" />
      </svg>
    ),
  },
  {
    id: "template-ai",
    title: "Free AI",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
        <circle cx="19" cy="5" r="1" fill="currentColor" />
        <circle cx="5" cy="19" r="1" fill="currentColor" />
      </svg>
    ),
  },
];

export default function PresentationsHome() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { theme, toggleTheme, mounted } = useTheme();
  const [presentationMeta, setPresentationMeta] = useState<PresentationMeta[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiTitle, setAITitle] = useState("");
  const [aiDescription, setAIDescription] = useState("");
  const [aiGoal, setAIGoal] = useState<string>("");
  const [aiAudience, setAIAudience] = useState<string>("");
  const [aiTone, setAITone] = useState<"formal" | "friendly" | "technical">("formal");
  const [aiLanguage, setAILanguage] = useState<"en" | "ar">("en");
  const [aiSlideCount, setAISlideCount] = useState(6);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [aiProgress, setAIProgress] = useState<string>("");
  const [aiError, setAiError] = useState<string | null>(null);
  const savedPresentations = useMemo(
    () => presentationMeta.filter((item) => item.isSaved),
    [presentationMeta]
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setQuery(searchInput);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  const visiblePresentations = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return savedPresentations;
    return savedPresentations.filter((item) => {
      const indexSource =
        item.searchIndex?.toLowerCase() ?? `${item.title ?? ""}`.toLowerCase();
      return indexSource.includes(trimmed);
    });
  }, [query, savedPresentations]);

  const highlightMatch = useCallback(
    (text: string): ReactNode => {
      const trimmed = query.trim();
      if (!trimmed) return text;
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(${escaped})`, "ig");
      const parts = text.split(regex);
      return parts.map((part, index) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <mark key={`${part}-${index}`} className={styles.highlight}>
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        )
      );
    },
    [query]
  );

  const refreshPresentationMeta = useCallback(() => {
    setPresentationMeta(readPresentationMeta());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    refreshPresentationMeta();
    const handleMetaUpdate = () => refreshPresentationMeta();
    window.addEventListener(PRESENTATION_META_UPDATED_EVENT, handleMetaUpdate);
    return () => {
      window.removeEventListener(PRESENTATION_META_UPDATED_EVENT, handleMetaUpdate);
    };
  }, [refreshPresentationMeta]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/login");
        }
    });
    return () => unsubscribe();
  }, [router]);


  const goToPresentation = (presentationId: string) => {
    router.push(`/editor/${encodeURIComponent(presentationId)}?slideId=slide-1`);
  };

  const goToDashboard = (event?: MouseEvent<HTMLElement>) => {
    event?.stopPropagation();
    try {
      localStorage.setItem("pmodeEntry", "dashboard");
    } catch {
      // no-op
    }
    router.push("/dashboard");
  };

  const goToAuditLog = (event?: MouseEvent<HTMLElement>) => {
    event?.stopPropagation();
    router.push("/audit-log");
  };

  const handleTrainingClick = () => {
    router.push("/training-deck");
  };

  const handleExecutiveSummaryClick = async (event?: MouseEvent<HTMLElement>) => {
    event?.stopPropagation();
    let targetPresentationId = savedPresentations[0]?.id;

    if (!targetPresentationId) {
      // Create a draft presentation if none exists
      // Use a timestamp-based ID generated in a callback to avoid render-time impure function
      const timestamp = Date.now();
      const draftId = `presentation-${timestamp}`;
      recordPresentationDraft(draftId, "Untitled presentation");
      targetPresentationId = draftId;
    }

    if (targetPresentationId) {
      router.push(`/slides/${encodeURIComponent(targetPresentationId)}/executive-summary`);
    }
  };

  const handleAIClick = (event?: MouseEvent<HTMLElement>) => {
    event?.stopPropagation();
    setIsAIModalOpen(true);
  };

  const closeAIModal = () => {
    setIsAIModalOpen(false);
    setAITitle("");
    setAIDescription("");
    setAIGoal("");
    setAIAudience("");
    setAITone("formal");
    setAILanguage("en");
    setAISlideCount(6);
    setAiError(null);
    setAIProgress("");
    setIsAIGenerating(false);
  };

  // Old generateSlides function removed - now using aiPresentationService.generatePresentation()

  const handleAIGenerate = async () => {
    if (!aiTitle.trim()) {
      setAiError("Please enter a title");
      return;
    }

    setAiError(null);
    setAIProgress("");
    setIsAIGenerating(true);
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      setAiError("You must be logged in to create a presentation");
      setIsAIGenerating(false);
      router.push("/login");
      return;
    }

    try {
      // Generate slides using the new AI service with timeout protection
      let generatedSlides: AIPresentationSlide[] = [];
      
      try {
        // Set a timeout to prevent hanging
        const generationPromise = generatePresentation(
          {
            topic: aiTitle,
            goal: aiGoal || undefined,
            audience: aiAudience || undefined,
            tone: aiTone,
            language: aiLanguage,
            slideCount: aiSlideCount,
          },
          (progress) => {
            // Update progress indicator
            setAIProgress(progress.message);
          }
        );

        // Add timeout protection (60 seconds max for OpenAI API)
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Generation timeout")), 60000);
        });

        generatedSlides = await Promise.race([generationPromise, timeoutPromise]);
        
        // Update progress for cover image generation
        if (generatedSlides.length > 0) {
          setAIProgress("Generating cover image with AI...");
        }
      } catch (genError) {
        console.warn("AI generation failed or timed out, using fallback:", genError);
        // Fallback: generate simple slides locally
        generatedSlides = generateLocalFallbackSlides(aiTitle, aiGoal, aiAudience, aiTone, aiLanguage, aiSlideCount);
        setAIProgress("Using local fallback generator...");
      }

      if (!generatedSlides || generatedSlides.length === 0) {
        // Final fallback: create at least one slide
        generatedSlides = [{
          title: aiTitle,
          bullets: ["Overview", "Key points", "Summary"],
          notes: "",
          layout: "title-bullets",
        }];
      }

      // Use AI-recommended theme if available, otherwise select intelligently
      const aiRecommendedTheme = (generatedSlides[0] as any)?._recommendedTheme;
      const availableThemes = [
        { name: "Digital Solutions", id: "digital-solutions", themeId: "digital_solutions_black" },
        { name: "SCDT", id: "scdt", themeId: "scdt" },
        { name: "Aramco Classic", id: "aramco-classic", themeId: "aramco_classic" },
        { name: "Default", id: "default", themeId: "default" },
      ];
      
      let selectedTheme;
      if (aiRecommendedTheme) {
        // Use AI-recommended theme
        const themeMap: Record<string, typeof availableThemes[0]> = {
          "digital-solutions": availableThemes[0],
          "scdt": availableThemes[1],
          "aramco-classic": availableThemes[2],
          "default": availableThemes[3],
        };
        selectedTheme = themeMap[aiRecommendedTheme.toLowerCase()] || availableThemes[0];
        console.log(`Using AI-recommended theme: ${selectedTheme.name}`);
      } else {
        // Fallback: Select theme based on topic hash for consistency
        const themeIndex = Math.abs(aiTitle.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)) % availableThemes.length;
        selectedTheme = availableThemes[themeIndex];
      }

      // Create presentation with AI template and selected theme
      // Note: isShared is not set, so it's private by default (only in recent presentations)
      const presentationRef = await addDoc(collection(db, "presentations"), {
        ownerId: currentUser.uid,
        title: aiTitle,
        template: "AI Generated",
        templateId: "ai-modern", // Mark as using AI template
        theme: selectedTheme.name,
        themeId: selectedTheme.themeId,
        isShared: false, // Private by default, user can share later
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const presentationId = presentationRef.id;

      // Helper function to generate AI image for cover slide using OpenAI DALL-E
      const generateAICoverImage = async (topic: string, imagePrompt?: string): Promise<string | null> => {
        try {
          const response = await fetch("/api/openai/generate-image", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              prompt: imagePrompt || `Professional, modern, corporate presentation cover image for "${topic}". Clean, minimalist design with abstract geometric elements, professional color scheme, suitable for business presentation. High quality, professional photography style.`,
              topic: topic,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.warn("AI image generation failed:", errorData.error || `HTTP ${response.status}`);
            return null;
          }

          const data = await response.json();
          return data.imageUrl || null;
        } catch (error) {
          console.warn("Failed to generate AI cover image:", error);
          return null;
        }
      };

      // Helper function to get image URL from imagePrompt using Unsplash Source API (for non-cover slides)
      const getImageFromPrompt = async (imagePrompt: string | undefined, slideIndex: number): Promise<string | null> => {
        if (!imagePrompt) return null;
        
        try {
          // Extract keywords from imagePrompt for Unsplash search
          const keywords = imagePrompt
            .toLowerCase()
            .replace(/[^\w\s]/g, " ")
            .split(/\s+/)
            .filter(word => word.length > 3)
            .slice(0, 3)
            .join(",") || "business,professional";
          
          // Use Unsplash Source API (free, no API key needed for basic usage)
          // Format: https://source.unsplash.com/800x600/?keywords
          const imageUrl = `https://source.unsplash.com/800x600/?${encodeURIComponent(keywords)}&sig=${slideIndex}`;
          
          // Return the URL (we'll store it as-is, images will be loaded on demand)
          return imageUrl;
        } catch (error) {
          console.warn("Failed to generate image URL from prompt:", error);
          return null;
        }
      };

      // Create slides with AI template styling, themes, layouts, and images
      let firstSlideId: string | null = null;
      const totalSlides = generatedSlides.length;
      
      for (let i = 0; i < generatedSlides.length; i++) {
        const slide: AIPresentationSlide = generatedSlides[i];
        const isTitleSlide = i === 0;
        const isLastSlide = i === totalSlides - 1;
        const slideTitle = slide.title || "Untitled Slide";
        
        // Determine slideType based on position (clean layouts)
        let slideType: "cover" | "content" | "ending" = "content";
        if (isTitleSlide) {
          slideType = "cover";
        } else if (isLastSlide && totalSlides > 1) {
          slideType = "ending";
        }
        
        // Convert bullets array to content string format (bullet points with newlines)
        let slideSubtitle = "";
        let slideContent = "";
        
        if (isTitleSlide) {
          // Title slide: Only title + date (no subtitle, no "AI Generated Presentation")
          // Add current date as subtitle
          const currentDate = new Date().toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric' 
          });
          slideSubtitle = currentDate;
          slideContent = "";
        } else {
          // Content slides: convert bullets array to bullet point string
          if (slide.bullets && slide.bullets.length > 0) {
            slideContent = slide.bullets.map(bullet => `• ${bullet}`).join("\n");
          }
          slideSubtitle = "";
        }
        
        try {
          // Prepare slide data with theme, layout, and image
          const slideData: any = {
            order: i + 1,
            title: slideTitle,
            notes: slide.notes ? encryptText(slide.notes) : encryptText(""),
            theme: selectedTheme.name, // Use selected beautiful theme
            slideType: slideType, // Set clean layout based on position
            templateId: "ai-modern",
            formatting: createDefaultFormatting(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };

          // Add subtitle/content based on slide type
          if (isTitleSlide && slideSubtitle) {
            // Title slide: subtitle contains date only
            slideData.subtitle = encryptText(slideSubtitle);
          } else if (!isTitleSlide && slideContent) {
            // Content slides: content contains bullet points
            slideData.content = encryptText(slideContent);
          }

          // Slide 1 (cover): Automatically insert default cover image - no modal, no manual upload, no save button required
          if (isTitleSlide) {
            // Always apply default cover image to slide 1 - directly to slide state
            slideData.imageUrl = "/digital_solutions_black_theme_bg.png"; // Default cover image URL
            slideData.imageX = 300; // Center horizontally (300px from left, leaving 300px on right for 1000px slide)
            slideData.imageY = 400; // Position below title and date (400px from top)
            slideData.imageWidth = 400; // 40% of slide width for prominent display
            slideData.imageHeight = 300; // Maintain aspect ratio
            
            if (i === 0) {
              setAIProgress("Adding default cover image...");
            }
          } else {
            // Content slides: Use Unsplash images if AI recommends them
            const needsImage = slide.needsImage !== undefined ? slide.needsImage : i < 3;
            if (needsImage && slide.imagePrompt) {
              setAIProgress(`Adding images to slide ${i + 1}...`);
              const imageUrl = await getImageFromPrompt(slide.imagePrompt, i);
              if (imageUrl) {
                slideData.imageUrl = imageUrl;
                slideData.imageX = 600; // Right side of slide
                slideData.imageY = 200; // Top-middle area
                slideData.imageWidth = 350; // 35% of 1000px slide width
                slideData.imageHeight = 263; // Maintain 4:3 aspect ratio
              }
            }
          }

          const slideRef = await addDoc(collection(db, "presentations", presentationId, "slides"), slideData);
          if (i === 0) {
            firstSlideId = slideRef.id;
          }
        } catch (slideError: any) {
          console.error(`Failed to create slide ${i + 1}:`, slideError);
          const errorMessage = slideError?.message || `Failed to create slide ${i + 1}`;
          throw new Error(`${errorMessage}. Please check your Firestore permissions and try again.`);
        }
      }

      recordPresentationDraft(presentationId, aiTitle);

      await logAuditEvent({
        presentationId,
        userId: currentUser.uid,
        userEmail: currentUser.email ?? null,
        action: "CREATE_PRESENTATION",
        details: {
          title: aiTitle,
          templateName: "AI Generated",
          slideCount: generatedSlides.length,
        },
      });

      // Verify slides were created before navigation (avoid race condition)
      const slidesRef = collection(db, "presentations", presentationId, "slides");
      const slidesQuery = firestoreQuery(slidesRef, orderBy("order", "asc"));
      const slidesSnap = await getDocs(slidesQuery);
      
      if (slidesSnap.empty) {
        throw new Error("Failed to create slides - no slides found after creation");
      }

      // Close modal before navigation
      closeAIModal();
      
      // Navigate to editor using the real Firestore-generated slide ID
      if (!firstSlideId) {
        throw new Error("Failed to create first slide - no slide ID available");
      }
      router.push(`/editor/${encodeURIComponent(presentationId)}?slideId=${encodeURIComponent(firstSlideId)}`);
    } catch (error) {
      console.error("Failed to create AI presentation", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create presentation. Please try again.";
      setAiError(errorMessage);
      setIsAIGenerating(false);
      setAIProgress("");
    }
  };

  // Local fallback generator for when AI service fails
  const generateLocalFallbackSlides = (
    title: string,
    goal?: string,
    audience?: string,
    tone: "formal" | "friendly" | "technical" = "formal",
    language: "en" | "ar" = "en",
    slideCount: number = 6
  ): AIPresentationSlide[] => {
    const slides: AIPresentationSlide[] = [];
    const count = Math.max(1, Math.min(20, slideCount));

    // Title slide
    slides.push({
      title: title,
      bullets: audience ? [`Presented to ${audience}`] : [],
      notes: "",
      layout: "title-only",
    });

    if (count <= 1) return slides;

    // Introduction slide
    slides.push({
      title: language === "en" ? "Overview" : "نظرة عامة",
      bullets: [
        `Introduction to ${title}`,
        goal ? `Goal: ${goal}` : "Key objectives",
        "Main topics to be covered",
      ],
      notes: "",
      layout: "title-bullets",
    });

    if (count <= 2) return slides;

    // Content slides
    const contentTitles = [
      language === "en" ? "Key Points" : "النقاط الرئيسية",
      language === "en" ? "Details" : "التفاصيل",
      language === "en" ? "Analysis" : "التحليل",
      language === "en" ? "Recommendations" : "التوصيات",
      language === "en" ? "Next Steps" : "الخطوات التالية",
    ];

    for (let i = 2; i < count; i++) {
      const titleIndex = (i - 2) % contentTitles.length;
      slides.push({
        title: contentTitles[titleIndex],
        bullets: [
          `Point 1 related to ${title}`,
          `Point 2 related to ${title}`,
          `Point 3 related to ${title}`,
          `Point 4 related to ${title}`,
        ],
        notes: "",
        layout: "title-bullets",
      });
    }

    return slides;
  };

  async function createPresentation(templateName: string) {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      router.push("/login");
      return;
    }

    try {
      // Create presentation - private by default (only in recent presentations, not in team dashboard)
      const presentationRef = await addDoc(collection(db, "presentations"), {
        ownerId: currentUser.uid,
        title: templateName,
        template: templateName,
        isShared: false, // Private by default, user can share later via Share button
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const presentationId = presentationRef.id;

      // Create the first slide with proper formatting and structure
      const slideRef = await addDoc(collection(db, "presentations", presentationId, "slides"), {
        order: 1,
        title: "Slide 1",
        subtitle: encryptText(""),
        notes: encryptText(""),
        theme: "default",
        formatting: createDefaultFormatting(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const firstSlideId = slideRef.id;

      // Verify the slide was created before navigation (avoid race condition)
      const slidesRef = collection(db, "presentations", presentationId, "slides");
      const slidesQuery = firestoreQuery(slidesRef, orderBy("order", "asc"));
      const slidesSnap = await getDocs(slidesQuery);
      
      if (slidesSnap.empty) {
        throw new Error("Failed to create slide - slide not found after creation");
      }

      recordPresentationDraft(presentationId, templateName);

      await logAuditEvent({
        presentationId,
        userId: currentUser.uid,
        userEmail: currentUser.email ?? null,
        action: "CREATE_PRESENTATION",
        details: {
          title: templateName,
          templateName,
        },
      });

      // Navigate using the real Firestore-generated slide ID
      router.push(`/editor/${encodeURIComponent(presentationId)}?slideId=${encodeURIComponent(firstSlideId)}`);
    } catch (error) {
      console.error("Failed to create presentation", error);
    }
  }


  return (
    <>
      <nav className={styles.nav}>
        <div className={styles.logoWrap}>
          <img src="/aramco-digital.png" alt="Aramco Digital" className={styles.logo} />
        </div>
        <div className={styles.navLinks} />
        <div className={styles.topRightActions}>
          <button
            type="button"
            aria-label="Toggle dark mode"
            onClick={toggleTheme}
            className={styles.themeToggle}
          >
            {!mounted ? (
              // Render moon icon during SSR to avoid hydration mismatch
              <svg className={`${styles.icon} ${styles.iconSpin}`} width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" stroke="currentColor" strokeWidth="1.8" fill="none" />
              </svg>
            ) : theme === "dark" ? (
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
          {!loading && !user ? (
          <button type="button" className={styles.primary} onClick={() => router.push("/login")}>
            Sign in
          </button>
          ) : null}
          {!loading && user ? (
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => router.push("/profile")}
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "#E5F4F1",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: "16px",
                  fontWeight: 500,
                  color: "#2b6a64",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.05)";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "none";
                }}
                aria-label="Profile"
              >
                {(() => {
                  if (!user) return "U";
                  const userRecord = user as Record<string, unknown>;
                  const displayName = typeof userRecord.displayName === "string" ? userRecord.displayName : null;
                  const email = typeof userRecord.email === "string" ? userRecord.email : null;
                  const initial = displayName
                    ? displayName.charAt(0).toUpperCase()
                    : email
                    ? email.charAt(0).toUpperCase()
                    : "U";
                  return initial;
                })()}
              </button>
              <button
                type="button"
                className={styles.secondary}
                onClick={async () => {
                  await signOut(auth);
                  router.push("/login");
                }}
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </nav>

      <div className={styles.page}>
        <header className={styles.headerBar}>
          <div className={styles.searchWrap}>
            <input
              className={styles.searchInput}
              placeholder="Search presentations…"
              aria-label="Search presentations"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
        </header>

        <main className={styles.content}>
          <div className="mb-6">
            <h1 className="text-3xl font-semibold text-gray-900">
              {(() => {
                if (!user) return "Welcome, User";
                const userRecord = user as Record<string, unknown>;
                const displayName = typeof userRecord.displayName === "string" ? userRecord.displayName : null;
                const userEmail = typeof userRecord.email === "string" ? userRecord.email : null;
                return `Welcome, ${displayName || userEmail || "User"}`;
              })()}
            </h1>
            <p className="mt-1 text-lg text-gray-700">
              Secure Presentations
            </p>
          </div>
          <section className={styles.templatesSection}>
            <div className={styles.sectionHeader}>
              <h2>Home</h2>
            </div>
            <div className={styles.templateRow}>
              {templates.map((template) => (
                <article
                  key={template.id}
                  className={styles.templateCard}
                  onClick={(event) => {
                    if (template.id === "template-blank") {
                      void createPresentation("Blank presentation");
                    } else if (template.id === "template-team-update") {
                      goToAuditLog(event);
                    } else if (template.id === "template-project-review") {
                      goToDashboard(event);
                    } else if (template.id === "template-training") {
                      handleTrainingClick();
                    } else if (template.id === "template-executive") {
                      void handleExecutiveSummaryClick(event);
                    } else if (template.id === "template-ai") {
                      handleAIClick(event);
                    } else {
                      void createPresentation(template.title);
                    }
                  }}
                >
                  <div className={styles.templateIcon} aria-hidden="true">
                    {template.icon}
                  </div>
                  <h3>{template.title}</h3>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.recentsSection} aria-label="Recent presentations">
            <div className={styles.recentsHeader}>
              <h2>Recent presentations</h2>
            </div>

          {savedPresentations.length === 0 ? (
            <div className={styles.emptyState}>No recent presentations yet.</div>
          ) : visiblePresentations.length === 0 ? (
            <div className={styles.emptyState}>No presentations match your search.</div>
            ) : (
              <div className={styles.recentGrid}>
              {visiblePresentations.map((item) => (
                  <article
                    key={item.id}
                    className={styles.recentCard}
                    onClick={() => goToPresentation(item.id)}
                  >
                    <div className={styles.recentMeta}>
                    <h3>{highlightMatch(item.title || "Untitled presentation")}</h3>
                    {item.updatedAt ? <p>{item.updatedAt}</p> : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </main>

        <TeamChatWidget />

        {/* AI Generation Modal */}
        {isAIModalOpen && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={closeAIModal}
          >
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                padding: "32px",
                maxWidth: "600px",
                width: "90%",
                maxHeight: "90vh",
                overflowY: "auto",
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ marginTop: 0, marginBottom: "24px", fontSize: "24px", fontWeight: 600 }}>
                Create AI Presentation
              </h2>

              {aiError && (
                <div
                  style={{
                    marginBottom: "20px",
                    padding: "12px 16px",
                    backgroundColor: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "8px",
                    color: "#991b1b",
                    fontSize: "14px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{aiError}</span>
                    <button
                      onClick={() => setAiError(null)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#991b1b",
                        cursor: "pointer",
                        fontSize: "18px",
                        padding: "0 8px",
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#374151",
                  }}
                >
                  Title <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  value={aiTitle}
                  onChange={(e) => setAITitle(e.target.value)}
                  placeholder="Enter presentation title"
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    fontSize: "14px",
                  }}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#374151",
                  }}
                >
                  Description
                </label>
                <textarea
                  value={aiDescription}
                  onChange={(e) => setAIDescription(e.target.value)}
                  placeholder="Describe what your presentation should be about..."
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    fontSize: "14px",
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#374151",
                  }}
                >
                  Goal / Purpose
                </label>
                <select
                  value={aiGoal}
                  onChange={(e) => setAIGoal(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    fontSize: "14px",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <option value="">Select goal (optional)</option>
                  <option value="Inform">Inform</option>
                  <option value="Persuade">Persuade</option>
                  <option value="Train">Train</option>
                  <option value="Review">Review</option>
                  <option value="Propose">Propose</option>
                </select>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#374151",
                  }}
                >
                  Target Audience
                </label>
                <input
                  type="text"
                  value={aiAudience}
                  onChange={(e) => setAIAudience(e.target.value)}
                  placeholder="e.g., Executives, Team members, Clients"
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    fontSize: "14px",
                  }}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#374151",
                  }}
                >
                  Tone
                </label>
                <div style={{ display: "flex", gap: "12px" }}>
                  {(["formal", "friendly", "technical"] as const).map((tone) => (
                    <label
                      key={tone}
                      style={{
                        flex: 1,
                        padding: "10px",
                        borderRadius: "8px",
                        border: `2px solid ${aiTone === tone ? "#56C1B0" : "#d1d5db"}`,
                        backgroundColor: aiTone === tone ? "#f0fdfa" : "#ffffff",
                        cursor: "pointer",
                        textAlign: "center",
                        fontSize: "14px",
                        textTransform: "capitalize",
                      }}
                    >
                      <input
                        type="radio"
                        value={tone}
                        checked={aiTone === tone}
                        onChange={(e) => setAITone(e.target.value as "formal" | "friendly" | "technical")}
                        style={{ marginRight: "6px" }}
                      />
                      {tone}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#374151",
                  }}
                >
                  Language
                </label>
                <div style={{ display: "flex", gap: "12px" }}>
                  {(["en", "ar"] as const).map((lang) => (
                    <label
                      key={lang}
                      style={{
                        flex: 1,
                        padding: "10px",
                        borderRadius: "8px",
                        border: `2px solid ${aiLanguage === lang ? "#56C1B0" : "#d1d5db"}`,
                        backgroundColor: aiLanguage === lang ? "#f0fdfa" : "#ffffff",
                        cursor: "pointer",
                        textAlign: "center",
                        fontSize: "14px",
                      }}
                    >
                      <input
                        type="radio"
                        value={lang}
                        checked={aiLanguage === lang}
                        onChange={(e) => setAILanguage(e.target.value as "en" | "ar")}
                        style={{ marginRight: "6px" }}
                      />
                      {lang === "en" ? "English" : "Arabic"}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#374151",
                  }}
                >
                  Number of Slides
                </label>
                <input
                  type="number"
                  value={aiSlideCount}
                  onChange={(e) => setAISlideCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 6)))}
                  min={1}
                  max={20}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    fontSize: "14px",
                  }}
                />
                <p style={{ marginTop: "4px", fontSize: "12px", color: "#6b7280" }}>
                  Between 1 and 20 slides
                </p>
              </div>

              {aiProgress && (
                <div
                  style={{
                    marginBottom: "20px",
                    padding: "12px 16px",
                    backgroundColor: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    borderRadius: "8px",
                    color: "#1e40af",
                    fontSize: "14px",
                  }}
                >
                  {aiProgress}
                </div>
              )}

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={closeAIModal}
                  disabled={isAIGenerating}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    backgroundColor: "#ffffff",
                    color: "#374151",
                    fontSize: "14px",
                    fontWeight: 500,
                    cursor: isAIGenerating ? "not-allowed" : "pointer",
                    opacity: isAIGenerating ? 0.5 : 1,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAIGenerate}
                  disabled={isAIGenerating || !aiTitle.trim()}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: isAIGenerating || !aiTitle.trim() ? "#9ca3af" : "#56C1B0",
                    color: "#ffffff",
                    fontSize: "14px",
                    fontWeight: 500,
                    cursor: isAIGenerating || !aiTitle.trim() ? "not-allowed" : "pointer",
                  }}
                >
                  {isAIGenerating ? (aiProgress || "Generating...") : "Generate Presentation"}
                </button>
              </div>
            </div>
          </div>
        )}

        <footer className={styles.footer}>© 2025 Aramco Digital - Secure Presentation Tool</footer>
      </div>
    </>
  );
}
