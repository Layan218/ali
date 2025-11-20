"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
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
  const [aiSlideCount, setAISlideCount] = useState(6);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
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
    router.push(`/editor?presentationId=${encodeURIComponent(presentationId)}&slideId=slide-1`);
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
    setAISlideCount(6);
    setAiError(null);
    setIsAIGenerating(false);
  };

  // Generate slides with clean, accurate, and professionally organized information
  const generateSlides = async (title: string, description: string, slideCount: number) => {
    const slides: Array<{ title: string; content: string }> = [];
    
    // Fetch real information from web first to create a professional introduction
    let webData: { sentences: string[]; keyWords: string[]; summary: string; fullContent?: string } | null = null;
    try {
      const searchQuery = description.trim() || title;
      const response = await fetch("/api/web-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: title, description }),
      });
      
      if (response.ok) {
        webData = await response.json();
      }
    } catch (error) {
      console.error("Failed to fetch web data:", error);
    }

    const fetchedSummary = webData?.summary || description;
    const fetchedSentences = webData?.sentences || [];
    
    // Get current user info for author
    const currentUser = auth.currentUser;
    const authorName = currentUser?.displayName || currentUser?.email?.split('@')[0] || "Presenter";
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Slide 1: Clean title slide only (title, subtitle, author, date)
    const titleSubtitle = description || "An informative presentation";
    const titleSlideContent = `${titleSubtitle}\n\n${authorName}\n${currentDate}`;
    
    slides.push({
      title: title || "Untitled Presentation",
      content: titleSlideContent,
    });

    if (slideCount <= 1) return slides;

    // Use already fetched webData or fetch if not available
    if (!webData) {
      try {
        const searchQuery = description.trim() || title;
        const response = await fetch("/api/web-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: title, description }),
        });
        
        if (response.ok) {
          webData = await response.json();
        }
      } catch (error) {
        console.error("Failed to fetch web data:", error);
      }
    }

    const summary = webData?.summary || description;
    const sentences = webData?.sentences || [];
    const keyWords = webData?.keyWords || [];
    
    // Slide 2: Outline slide with 4-6 main sections
    const outlineSections: string[] = [];
    
    // Generate outline sections based on topic and available content
    const standardSections = [
      "Overview",
      "Key Concepts",
      "Important Aspects",
      "Applications & Use Cases",
      "Benefits & Impact",
      "Conclusion"
    ];
    
    // Try to create topic-specific sections from keyWords and content
    if (keyWords.length > 0 || summary) {
      // Use keyWords to create more specific sections
      const topicWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const mainTopic = topicWords[0] || title.toLowerCase();
      
      // Create sections based on available information
      const customSections: string[] = [];
      
      // Always start with Overview
      customSections.push("Overview");
      
      // Add Key Concepts if we have enough content
      if (sentences.length > 5 || summary) {
        customSections.push("Key Concepts");
      }
      
      // Add Important Aspects
      customSections.push("Important Aspects");
      
      // Add Applications/Use Cases if we have relevant content
      if (keyWords.some(kw => ['application', 'use', 'case', 'example', 'implementation'].some(term => kw.includes(term))) || 
          summary?.toLowerCase().includes('application') ||
          summary?.toLowerCase().includes('use case')) {
        customSections.push("Applications & Use Cases");
      } else {
        customSections.push("Real-World Applications");
      }
      
      // Add Benefits/Impact
      if (keyWords.some(kw => ['benefit', 'impact', 'advantage', 'value'].some(term => kw.includes(term))) ||
          summary?.toLowerCase().includes('benefit') ||
          summary?.toLowerCase().includes('impact')) {
        customSections.push("Benefits & Impact");
      } else {
        customSections.push("Key Benefits");
      }
      
      // Always end with Conclusion
      customSections.push("Conclusion");
      
      // Use custom sections (4-6 items)
      outlineSections.push(...customSections.slice(0, 6));
    } else {
      // Use standard sections
      outlineSections.push(...standardSections);
    }
    
    // Format outline as bullet points
    const outlineContent = outlineSections
      .map((section, index) => `${index + 1}. ${section}`)
      .join('\n');
    
    slides.push({
      title: "Outline",
      content: outlineContent,
    });
    
    // Clean sentences: remove citations, normalize, capitalize, add punctuation
    const cleanSentences = sentences
      .map(s => {
        let cleaned = s.trim()
          .replace(/\[.*?\]/g, '') // Remove citations
          .replace(/\(.*?\)/g, '') // Remove parentheticals
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
        
        if (cleaned.length === 0) return null;
        
        // Capitalize first letter
        if (/^[a-z]/.test(cleaned)) {
          cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        }
        
        // Ensure proper punctuation
        if (!/[.!?]$/.test(cleaned)) {
          cleaned += '.';
        }
        
        return cleaned;
      })
      .filter((s): s is string => s !== null && s.length >= 25 && s.length <= 100)
      .filter((s, index, arr) => arr.indexOf(s) === index); // Remove duplicates
    
    // Create structured slide deck: Overview, Key Concepts, Important Aspects, Applications, Benefits, Conclusion
    // We already have Title (slide 1) and Outline (slide 2), so remaining slides start from slide 3
    const contentSlides = slideCount - 2; // Excluding title and outline slides
    const hasEnoughContent = cleanSentences.length >= contentSlides * 3;
    
    // Slide 3: Overview (4-6 bullet points)
    if (contentSlides >= 1) {
      const overviewSentences = cleanSentences.slice(0, 6).filter(Boolean);
      let overviewContent = "";
      
      if (overviewSentences.length >= 4) {
        // Use 4-6 best sentences for overview
        const pointsToUse = Math.min(overviewSentences.length, 6);
        overviewContent = overviewSentences
          .slice(0, pointsToUse)
          .map(s => `• ${s}`)
          .join('\n');
      } else if (summary) {
        const summaryParts = summary
          .split(/[.!?]+/)
          .map(s => s.trim().replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, ''))
          .filter(s => s.length >= 20 && s.length <= 100)
          .filter((s, idx, arr) => arr.indexOf(s) === idx) // Remove duplicates
          .slice(0, 6)
          .map(s => {
            let cleaned = s.trim();
            if (cleaned.length > 0 && /^[a-z]/.test(cleaned)) {
              cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
            }
            if (cleaned.length > 0 && !/[.!?]$/.test(cleaned)) {
              cleaned += '.';
            }
            return cleaned;
          })
          .filter(s => s.length > 0);
        
        // Ensure at least 4 points
        if (summaryParts.length >= 4) {
          overviewContent = summaryParts
            .slice(0, 6)
            .map(s => `• ${s}`)
            .join('\n');
        } else {
          // Combine with cleanSentences if available
          const combined = [...overviewSentences, ...summaryParts]
            .filter((s, idx, arr) => arr.indexOf(s) === idx)
            .slice(0, 6);
          overviewContent = combined.map(s => `• ${s}`).join('\n');
        }
      }
      
      // Ensure we have at least 4 points
      const contentLines = overviewContent.split('\n').filter(l => l.trim().length > 0);
      if (contentLines.length < 4) {
        const topicWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const mainTopic = topicWords[0] || title.toLowerCase();
        const fallbackPoints = [
          `${title} represents a significant and multifaceted topic.`,
          `Understanding ${mainTopic} requires comprehensive knowledge across multiple domains.`,
          `Key aspects of ${mainTopic} include various interconnected components and considerations.`,
          `Effective engagement with ${mainTopic} involves strategic thinking and practical application.`,
        ];
        
        // Combine existing content with fallback
        const existing = contentLines.map(l => l.replace(/^•\s*/, ''));
        const needed = 4 - existing.length;
        const additional = fallbackPoints
          .filter(p => !existing.some(e => e.toLowerCase().includes(p.toLowerCase().substring(0, 20))))
          .slice(0, needed);
        
        overviewContent = [...existing, ...additional]
          .filter(Boolean)
          .map(s => `• ${s}`)
          .join('\n');
      }
      
      slides.push({
        title: "Overview",
        content: overviewContent,
      });
    }
    
    // Remaining content slides: Key Concepts, Important Aspects, Applications, Benefits, etc.
    // We need to map outline sections to actual slides
    const remainingSlides = contentSlides - 1; // Excluding overview
    
    if (remainingSlides > 0) {
      // Ensure we have enough sentences for 4-6 bullet points per slide
      const sentencesPerSlide = Math.max(4, Math.ceil(cleanSentences.length / remainingSlides));
      const usedSentences = Math.min(4, cleanSentences.length);
      
      for (let i = 0; i < remainingSlides; i++) {
        const slideIndex = i + 1;
        const startIdx = usedSentences + (i * sentencesPerSlide);
        const endIdx = Math.min(startIdx + sentencesPerSlide + 2, cleanSentences.length); // Get extra for selection
        
        let slideSentences = cleanSentences.slice(startIdx, endIdx);
        
        // If not enough sentences, supplement with summary
        if (slideSentences.length < 4 && summary) {
          const summaryParts = summary
            .split(/[.!?]+/)
            .map(s => s.trim().replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, ''))
            .filter(s => s.length >= 20 && s.length <= 100)
            .filter((s, idx, arr) => arr.indexOf(s) === idx) // Remove duplicates
            .slice(i * 4, (i + 1) * 4)
            .map(s => {
              let cleaned = s.trim();
              if (cleaned.length > 0 && /^[a-z]/.test(cleaned)) {
                cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
              }
              if (cleaned.length > 0 && !/[.!?]$/.test(cleaned)) {
                cleaned += '.';
              }
              return cleaned;
            })
            .filter(s => s.length > 0);
          
          // Combine and deduplicate
          const combined = [...slideSentences, ...summaryParts];
          slideSentences = combined.filter((s, idx, arr) => arr.indexOf(s) === idx).slice(0, 6);
        }
        
        // Remove duplicates and ensure variety
        slideSentences = slideSentences.filter((s, idx, arr) => {
          // Remove exact duplicates
          if (arr.indexOf(s) !== idx) return false;
          // Remove very similar sentences (check first 30 chars)
          const prefix = s.substring(0, 30).toLowerCase();
          const similar = arr.slice(0, idx).some(other => 
            other.substring(0, 30).toLowerCase() === prefix
          );
          return !similar;
        });
        
        // Create slide title based on outline sections (skip "Overview" and "Conclusion")
        const outlineSectionTitles = outlineSections.filter(s => s !== "Overview" && s !== "Conclusion");
        const slideTitle = outlineSectionTitles[Math.min(i, outlineSectionTitles.length - 1)] || 
                          ["Key Concepts", "Important Aspects", "Applications", "Benefits"][Math.min(i, 3)];
        
        // Create content (4-6 bullet points, ensure quality)
        let slideContent = "";
        if (slideSentences.length >= 4) {
          // Use 4-6 best sentences
          const pointsToUse = Math.min(slideSentences.length, 6);
          slideContent = slideSentences
            .slice(0, pointsToUse)
            .map(s => `• ${s}`)
            .join('\n');
        } else if (slideSentences.length > 0) {
          // Use what we have, but ensure at least 4 points
          slideContent = slideSentences
            .map(s => `• ${s}`)
            .join('\n');
          
          // If we have less than 4, try to split longer sentences or add from summary
          if (slideSentences.length < 4 && summary) {
            const additionalParts = summary
              .split(/[.!?]+/)
              .map(s => s.trim().replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, ''))
              .filter(s => s.length >= 15 && s.length <= 80)
              .filter(s => !slideSentences.some(existing => 
                existing.toLowerCase().includes(s.toLowerCase().substring(0, 20)) ||
                s.toLowerCase().includes(existing.toLowerCase().substring(0, 20))
              ))
              .slice(0, 4 - slideSentences.length)
              .map(s => {
                let cleaned = s.trim();
                if (cleaned.length > 0 && /^[a-z]/.test(cleaned)) {
                  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
                }
                if (cleaned.length > 0 && !/[.!?]$/.test(cleaned)) {
                  cleaned += '.';
                }
                return cleaned;
              })
              .filter(s => s.length > 0);
            
            if (additionalParts.length > 0) {
              slideContent += '\n' + additionalParts.map(s => `• ${s}`).join('\n');
            }
          }
        } else {
          // Fallback: create topic-specific content
          const topicWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          const mainTopic = topicWords[0] || title.toLowerCase();
          slideContent = `• ${title} encompasses various important aspects and considerations.\n• Understanding ${mainTopic} requires comprehensive knowledge and research.\n• Key components of ${mainTopic} include multiple interconnected elements.\n• Effective implementation of ${mainTopic} involves strategic planning and execution.`;
        }
        
        slides.push({
          title: slideTitle,
          content: slideContent,
        });
      }
    }
    
    // Last slide: Conclusion (if we have more than 3 slides: title + outline + content) - 4-6 bullet points
    if (slides.length >= 4 && contentSlides >= 2) {
      const conclusionSentences = cleanSentences.slice(-6).filter(Boolean);
      let conclusionContent = "";
      
      if (conclusionSentences.length >= 4) {
        // Use 4-6 best sentences for conclusion
        const pointsToUse = Math.min(conclusionSentences.length, 6);
        conclusionContent = conclusionSentences
          .slice(0, pointsToUse)
          .map(s => `• ${s}`)
          .join('\n');
      } else if (summary) {
        const summaryParts = summary
          .split(/[.!?]+/)
          .map(s => s.trim().replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, ''))
          .filter(s => s.length >= 20 && s.length <= 100)
          .filter((s, idx, arr) => arr.indexOf(s) === idx) // Remove duplicates
          .slice(-6)
          .map(s => {
            let cleaned = s.trim();
            if (cleaned.length > 0 && /^[a-z]/.test(cleaned)) {
              cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
            }
            if (cleaned.length > 0 && !/[.!?]$/.test(cleaned)) {
              cleaned += '.';
            }
            return cleaned;
          })
          .filter(s => s.length > 0);
        
        // Combine with conclusionSentences
        const combined = [...conclusionSentences, ...summaryParts]
          .filter((s, idx, arr) => arr.indexOf(s) === idx)
          .slice(0, 6);
        conclusionContent = combined.map(s => `• ${s}`).join('\n');
      }
      
      // Ensure we have at least 4 points
      const contentLines = conclusionContent.split('\n').filter(l => l.trim().length > 0);
      if (contentLines.length < 4) {
        const topicWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const mainTopic = topicWords[0] || title.toLowerCase();
        const fallbackPoints = [
          `Summary of key points and important insights about ${title}.`,
          `Understanding ${mainTopic} provides valuable perspectives and practical applications.`,
          `Key takeaways highlight the significance and impact of ${mainTopic}.`,
          `Future considerations and next steps for further exploration of ${mainTopic}.`,
        ];
        
        // Combine existing content with fallback
        const existing = contentLines.map(l => l.replace(/^•\s*/, ''));
        const needed = 4 - existing.length;
        const additional = fallbackPoints
          .filter(p => !existing.some(e => e.toLowerCase().includes(p.toLowerCase().substring(0, 20))))
          .slice(0, needed);
        
        conclusionContent = [...existing, ...additional]
          .filter(Boolean)
          .map(s => `• ${s}`)
          .join('\n');
      }
      
      // Replace last slide with conclusion
      slides[slides.length - 1] = {
        title: "Conclusion",
        content: conclusionContent,
      };
    }

    return slides;
  };

  const handleAIGenerate = async () => {
    if (!aiTitle.trim()) {
      setAiError("Please enter a title");
      return;
    }

    setAiError(null);
    setIsAIGenerating(true);
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      setAiError("You must be logged in to create a presentation");
      setIsAIGenerating(false);
      router.push("/login");
      return;
    }

    try {
      // Generate slides with real information
      const generatedSlides = await generateSlides(aiTitle, aiDescription, aiSlideCount);

      if (!generatedSlides || generatedSlides.length === 0) {
        throw new Error("Failed to generate slides");
      }

      // Create presentation with AI template and default theme
      // Note: isShared is not set, so it's private by default (only in recent presentations)
      const presentationRef = await addDoc(collection(db, "presentations"), {
        ownerId: currentUser.uid,
        title: aiTitle,
        template: "AI Generated",
        templateId: "ai-modern", // Mark as using AI template
        theme: "Aramco Classic", // Default theme
        themeId: "aramco-classic",
        isShared: false, // Private by default, user can share later
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const presentationId = presentationRef.id;

      // Create slides with AI template styling
      let firstSlideId: string | null = null;
      for (let i = 0; i < generatedSlides.length; i++) {
        const slide = generatedSlides[i];
        // For title slide, use title as main title and description as subtitle
        const isTitleSlide = i === 0;
        const isOutlineSlide = i === 1;
        const slideTitle = slide.title || "Untitled Slide";
        
        // Title slide: content contains subtitle, author, date (separated by newlines) - goes to subtitle field
        // Outline slide: content contains numbered sections - goes to content field
        // Regular slides: content contains bullet points - goes to content field
        let slideSubtitle = "";
        let slideContent = "";
        
        if (isTitleSlide) {
          // Title slide: content contains subtitle, author, date - put in subtitle field
          slideSubtitle = slide.content || "";
          slideContent = "";
        } else if (isOutlineSlide) {
          // Outline slide: content contains numbered sections - put in content field
          slideSubtitle = "";
          slideContent = slide.content || "";
        } else {
          // Regular content slides: content contains bullet points
          slideSubtitle = "";
          slideContent = slide.content || "";
        }
        
        try {
          // Prepare slide data
          const slideData: any = {
            order: i + 1,
            title: slideTitle,
            notes: "",
            theme: "Aramco Classic", // Default theme for all slides
            templateId: "ai-modern",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };

          // Add subtitle/content based on slide type
          if (isTitleSlide && slideSubtitle) {
            // Title slide: subtitle contains subtitle, author, date
            slideData.subtitle = encryptText(slideSubtitle);
          } else if (isOutlineSlide && slideContent) {
            // Outline slide: content contains numbered sections
            slideData.content = encryptText(slideContent);
          } else if (!isTitleSlide && !isOutlineSlide && slideContent) {
            // Regular content slides: content contains bullet points
            slideData.content = encryptText(slideContent);
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

      closeAIModal();
      // Navigate to editor with the first slide ID
      const slideIdParam = firstSlideId ? `&slideId=${encodeURIComponent(firstSlideId)}` : "";
      router.push(`/editor?presentationId=${encodeURIComponent(presentationId)}${slideIdParam}`);
    } catch (error) {
      console.error("Failed to create AI presentation", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create presentation. Please try again.";
      setAiError(errorMessage);
    } finally {
      setIsAIGenerating(false);
    }
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

      await addDoc(collection(db, "presentations", presentationId, "slides"), {
        order: 1,
        title: "Slide 1",
        content: "",
        notes: "",
        theme: "default",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

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

      router.push(`/editor?presentationId=${encodeURIComponent(presentationId)}&slideId=slide-1`);
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
                      goToPresentation(template.id);
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
                maxWidth: "500px",
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
                  rows={4}
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
                  {isAIGenerating ? "Fetching information and generating..." : "Generate Presentation"}
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
