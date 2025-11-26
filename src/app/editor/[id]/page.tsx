"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  addDoc,
  collection,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { encryptText, decryptText } from "@/lib/encryption";
import { logAuditEvent } from "@/lib/audit";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import TeamChatWidget from "@/components/TeamChatWidget";
import SmartAssistantPanel from "@/components/SmartAssistantPanel";
import type { SlideContent, PresentationContext } from "@/services/smartAssistantService";
import styles from "./editor.module.css";
import EditorToolbar from "@/components/EditorToolbar";
import {
  markPresentationSaved,
  readPresentationMeta,
  updatePresentationStatus,
} from "@/lib/presentationMeta";
import { AITemplateConfig, getAITemplateStyles } from "@/lib/aiTemplate";
import { presentationThemes, getThemeByName, type PresentationTheme } from "@/lib/presentationThemes";
import type {
  FieldKey,
  AlignOption,
  SlideFormatting,
  SlideData,
  VersionSnapshotSlide,
  PresentationVersion,
  ThemeOption,
  SlideSnapshot,
  CommentItem,
  CommandState,
} from "@/types/editor";
import {
  formatTitleFromId,
  placeholderMap,
  fieldKeyMap,
  DEFAULT_THEME,
  themes,
  INITIAL_THEME,
} from "@/utils/slideUtils";
import {
  DEFAULT_FORMATTING,
  createDefaultFormatting,
  ensureFormatting,
  fontFamilies,
  fontSizes,
  lineSpacingOptions,
  colorOptions,
  highlightOptions,
  FONT_SIZE_TO_COMMAND,
  COMMAND_TO_FONT_SIZE,
  formattingButtons,
} from "@/utils/formattingUtils";

const VIEWER_RETURN_KEY = "viewer-return-url";
const VIEWER_STATE_KEY = "viewer-state";

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");


export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Get presentationId from path parameter [id], with fallback to query param for backward compatibility
  const presentationId = resolvedParams.id || searchParams.get("presentationId");
  const { theme, toggleTheme, mounted } = useTheme();
  const isDark = mounted && theme === "dark";
  const [presentationTitle, setPresentationTitle] = useState(() => formatTitleFromId(resolvedParams.id));
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [isLoadingSlides, setIsLoadingSlides] = useState(true);
  const [selectedSlideId, setSelectedSlideId] = useState<string>("");
  const [status, setStatus] = useState<"draft" | "final">("draft");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusToastVariant, setStatusToastVariant] = useState<"draft" | "final" | null>(null);
  const [activeField, setActiveField] = useState<FieldKey>("title");
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isHighlightPickerOpen, setIsHighlightPickerOpen] = useState(false);
  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoadingFromFirestore, setIsLoadingFromFirestore] = useState(false);
  const [hasLoadedFromFirestore, setHasLoadedFromFirestore] = useState(false);
  const [versions, setVersions] = useState<PresentationVersion[]>([]);
  const [isSavingVersion, setIsSavingVersion] = useState(false);
  const [isRestoringVersion, setIsRestoringVersion] = useState(false);
  const [presentationOwnerId, setPresentationOwnerId] = useState<string | null>(null);
  const [presentationCollaboratorIds, setPresentationCollaboratorIds] = useState<string[]>([]);
  const [teamRoles, setTeamRoles] = useState<Record<string, "owner" | "editor" | "viewer">>({});
  const [ownerDisplayName, setOwnerDisplayName] = useState<string | null>(null);
  const [collaboratorDisplayNames, setCollaboratorDisplayNames] = useState<Record<string, string>>({});
  const [firebaseUserId, setFirebaseUserId] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [firebaseUserEmail, setFirebaseUserEmail] = useState<string | null>(auth.currentUser?.email ?? null);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [newCollaboratorValue, setNewCollaboratorValue] = useState("");
  const [teamModalError, setTeamModalError] = useState<string | null>(null);
  const [isUpdatingTeam, setIsUpdatingTeam] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [speakerNotes, setSpeakerNotes] = useState<string>("");
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [presentationTheme, setPresentationTheme] = useState<string | null>(null);
  const [presentationBackground, setPresentationBackground] = useState<"default" | "soft" | "dark">("default");
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isBackgroundModalOpen, setIsBackgroundModalOpen] = useState(false);
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef<boolean>(false);
  const storageKey = useMemo(() => `presentation-${resolvedParams.id}-slides`, [resolvedParams.id]);
  const storedUserRecord = useMemo(
    () => (user && typeof user === "object" ? (user as Record<string, unknown>) : null),
    [user]
  );

  const colorButtonRef = useRef<HTMLDivElement | null>(null);
  const highlightButtonRef = useRef<HTMLDivElement | null>(null);
  const themeButtonRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLDivElement | null>(null);
  const subtitleRef = useRef<HTMLDivElement | null>(null);
  const notesRef = useRef<HTMLTextAreaElement | null>(null);
  const selectionRef = useRef<Range | null>(null);
  const hasHydratedRef = useRef(false);

  const [commandState, setCommandState] = useState<CommandState>({
    fontFamily: "Calibri",
    fontSize: 14,
    bold: false,
    italic: false,
    underline: false,
    color: "#202124",
    highlight: "transparent",
    align: "left",
    listType: "none",
  });

  const selectedSlide = useMemo(
    () => {
      if (slides.length === 0) return undefined;
      return slides.find((slide) => slide.id === selectedSlideId) ?? slides[0];
    },
    [selectedSlideId, slides]
  );

  // Undo/Redo hook (must be after selectedSlide is defined)
  const {
    undo: applyUndo,
    redo: applyRedo,
    captureSnapshotDebounced,
    captureSnapshotImmediate,
    captureSnapshotOnSlideChange,
  } = useUndoRedo({
    titleRef,
    subtitleRef,
    notesRef,
    selectedSlide,
    selectedSlideId,
    setSlides,
  });

  // Effective theme: presentation theme takes priority (when set), then slide theme, then default
  // This ensures theme changes apply immediately
  // IMPORTANT: Check presentationTheme first - if it's not null/undefined, use it (even if empty string)
  const effectiveThemeName = presentationTheme !== null && presentationTheme !== undefined
    ? presentationTheme
    : (selectedSlide?.theme || themes[0]?.name || DEFAULT_THEME);
  
  // Get theme object - this must match the theme name exactly
  const activeThemeObj = getThemeByName(effectiveThemeName) || presentationThemes["default"];
  const activeTheme = activeThemeObj?.id || effectiveThemeName; // Use theme ID for comparison
  
  const currentSlideIndex = selectedSlide ? slides.findIndex((slide) => slide.id === selectedSlideId) : -1;
  const isFirstSlide = currentSlideIndex <= 0;
  const isLastSlide = currentSlideIndex === slides.length - 1;
  
  // Check theme by both ID and name to ensure we catch all variations
  const isSCDT = activeTheme === "scdt" || effectiveThemeName === "SCDT" || activeThemeObj?.name === "SCDT";
  const isDigitalSolutions = activeTheme === "digital-solutions" || effectiveThemeName === "Digital Solutions" || activeThemeObj?.name === "Digital Solutions";
  const isAramcoClassic = activeTheme === "aramco-classic" || effectiveThemeName === "Aramco Classic" || activeThemeObj?.name === "Aramco Classic";
  
  const slideType = selectedSlide?.slideType || (isFirstSlide ? "cover" : isLastSlide ? "ending" : "content");
  
  // Get the CSS class name for the current theme and slide type
  // This will be used to apply the theme-specific CSS class
  const themeSlideClass = activeThemeObj?.slideLayouts?.[slideType] || "";
  
  // Debug: Log theme changes to help diagnose issues
  // Use stable values from activeThemeObj instead of the object itself
  const activeThemeObjName = activeThemeObj?.name;
  const activeThemeObjId = activeThemeObj?.id;
  const slideTypeFromTheme = activeThemeObj?.slideLayouts?.[slideType];
  const selectedSlideTheme = selectedSlide?.theme;
  
  useEffect(() => {
    console.log("🔍 Theme Debug:", {
      presentationTheme,
      selectedSlideTheme,
      effectiveThemeName,
      activeTheme,
      activeThemeObjName,
      activeThemeObjId,
      themeSlideClass,
      isSCDT,
      isDigitalSolutions,
      isAramcoClassic,
      slideType,
      slideTypeFromTheme
    });
  }, [presentationTheme, selectedSlideTheme, effectiveThemeName, activeTheme, activeThemeObjName, activeThemeObjId, themeSlideClass, isSCDT, isDigitalSolutions, isAramcoClassic, slideType, slideTypeFromTheme]);
  // Use presentation-level background for all slides
  const background = presentationBackground;
  const backgroundClass =
    background === "soft"
      ? styles.softBackground
      : background === "dark"
      ? styles.darkBackground
      : styles.defaultBackground;
  const canDeleteSlide = slides.length > 1;

  // Smart Assistant: Build SlideContent for current slide
  const assistantCurrentSlide: SlideContent | null = useMemo(() => {
    if (!selectedSlide) return null;

    try {
      // Get decrypted content (already decrypted when loaded from Firestore)
      const slideContent = selectedSlide.content || selectedSlide.subtitle || "";
      const slideNotes = selectedSlide.notes || "";

      // Try to infer language from content (simple heuristic: check for Arabic characters)
      const hasArabicChars = /[\u0600-\u06FF]/.test(slideContent || selectedSlide.title || "");
      const inferredLanguage: "en" | "ar" = hasArabicChars ? "ar" : "en";

      return {
        id: selectedSlide.id,
        title: selectedSlide.title || "Untitled slide",
        content: slideContent,
        notes: slideNotes,
        language: inferredLanguage,
      };
    } catch (error) {
      console.warn("Error building assistant slide content:", error);
      return null;
    }
  }, [selectedSlide]);

  // Smart Assistant: Build SlideContent[] for all slides
  const assistantAllSlides: SlideContent[] = useMemo(() => {
    if (!slides || slides.length === 0) {
      return assistantCurrentSlide ? [assistantCurrentSlide] : [];
    }

    try {
      return slides.map((slide) => {
        const slideContent = slide.content || slide.subtitle || "";
        const slideNotes = slide.notes || "";
        
        // Infer language from content
        const hasArabicChars = /[\u0600-\u06FF]/.test(slideContent || slide.title || "");
        const inferredLanguage: "en" | "ar" = hasArabicChars ? "ar" : "en";

        return {
          id: slide.id,
          title: slide.title || "Untitled slide",
          content: slideContent,
          notes: slideNotes,
          language: inferredLanguage,
        };
      });
    } catch (error) {
      console.warn("Error building assistant all slides:", error);
      return assistantCurrentSlide ? [assistantCurrentSlide] : [];
    }
  }, [slides, assistantCurrentSlide]);

  // Smart Assistant: Build PresentationContext
  const assistantPresentationContext: PresentationContext = useMemo(() => {
    try {
      // Infer language from slides content
      const allText = slides.map(s => (s.content || s.subtitle || s.title || "")).join(" ");
      const hasArabicChars = /[\u0600-\u06FF]/.test(allText || presentationTitle || "");
      const inferredLanguage: "en" | "ar" = hasArabicChars ? "ar" : "en";

      return {
        id: presentationId || resolvedParams.id,
        title: presentationTitle || "Untitled presentation",
        totalSlides: slides.length,
        language: inferredLanguage,
        // goal and audience could be added if stored in presentation metadata
        // For now, leave them undefined
      };
    } catch (error) {
      console.warn("Error building assistant presentation context:", error);
      return {
        id: presentationId || resolvedParams.id,
        title: presentationTitle || "Untitled presentation",
        totalSlides: slides.length,
        language: "en",
      };
    }
  }, [presentationId, resolvedParams.id, presentationTitle, slides]);

  // Smart Assistant: UI Language detection
  const uiLanguage = assistantPresentationContext.language || "en";
  const isArabic = uiLanguage === "ar";
  const assistantLabel = isArabic ? "المساعد الذكي" : "AI Assistant";

  // Load presentation and slides from Firestore
  const loadFromFirestore = useCallback(
    async (options?: { force?: boolean; selectSlideId?: string }) => {
      if (!presentationId) return;

      const force = options?.force ?? false;
      const explicitSlideId = options?.selectSlideId;

      if (!force && hasLoadedFromFirestore) return;

      setIsLoadingFromFirestore(true);
      try {
      // Load presentation document
      const presentationRef = doc(db, "presentations", presentationId);
      let presentationSnap;
      try {
        presentationSnap = await getDoc(presentationRef);
      } catch (error) {
        console.error("Firestore error (getDoc presentation):", error);
        throw error;
      }
      
      if (!presentationSnap.exists()) {
        console.warn("Presentation not found in Firestore");
        setIsLoadingFromFirestore(false);
        setIsLoadingSlides(false);
        setPresentationOwnerId(null);
        setPresentationCollaboratorIds([]);
        return;
      }

      const presentationData = presentationSnap.data();
      if (presentationData?.title) {
        setPresentationTitle(presentationData.title);
      }
      // Set presentation theme from Firestore (only on initial load, not if user has already selected one)
      // IMPORTANT: Only set if presentationTheme is currently null (initial state)
      // This prevents overriding user's theme selection
      if (presentationData?.theme && typeof presentationData.theme === "string") {
        setPresentationTheme((prev) => {
          // Only set if prev is null (initial load), otherwise keep user's selection
          if (prev === null) {
            return presentationData.theme;
          }
          return prev; // Keep user's selection
        });
      }
      if (presentationData?.status === "final" || presentationData?.status === "draft") {
        setStatus(presentationData.status);
      }
      // Load presentation background
      if (presentationData?.background && typeof presentationData.background === "string") {
        if (presentationData.background === "default" || presentationData.background === "soft" || presentationData.background === "dark") {
          setPresentationBackground(presentationData.background);
        }
      }
      const ownerId =
        presentationData && typeof presentationData.ownerId === "string" ? presentationData.ownerId : null;
      const collaboratorsRaw = Array.isArray(presentationData?.collaboratorIds)
        ? presentationData.collaboratorIds
        : [];
      const collaborators = collaboratorsRaw.filter((value): value is string => typeof value === "string");
      setPresentationOwnerId(ownerId);
      setPresentationCollaboratorIds(collaborators);

      // Load teamRoles
      const rolesRaw = presentationData?.teamRoles;
      if (rolesRaw && typeof rolesRaw === "object" && !Array.isArray(rolesRaw)) {
        const roles: Record<string, "owner" | "editor" | "viewer"> = {};
        for (const [key, value] of Object.entries(rolesRaw)) {
          if (value === "owner" || value === "editor" || value === "viewer") {
            roles[key.toLowerCase()] = value;
          }
        }
        // Ensure owner is included in teamRoles
        if (presentationOwnerId) {
          const ownerKey = presentationOwnerId.toLowerCase();
          roles[ownerKey] = "owner";
        }
        setTeamRoles(roles);
      } else {
        // Initialize with owner if no roles exist
        const roles: Record<string, "owner" | "editor" | "viewer"> = {};
        if (presentationOwnerId) {
          const ownerKey = presentationOwnerId.toLowerCase();
          roles[ownerKey] = "owner";
        }
        setTeamRoles(roles);
        // Save initial teamRoles to Firestore if it doesn't exist
        if (presentationId && presentationOwnerId) {
          const ownerKey = presentationOwnerId.toLowerCase();
          void setDoc(
            doc(db, "presentations", presentationId),
            { teamRoles: { [ownerKey]: "owner" } },
            { merge: true }
          );
        }
      }

      // Fetch display names for owner and collaborators
      const fetchDisplayNames = async () => {
        const names: Record<string, string> = {};
        if (ownerId) {
          try {
            const ownerRef = doc(db, "users", ownerId);
            const ownerSnap = await getDoc(ownerRef);
            const ownerData = ownerSnap.data();
            if (ownerData?.displayName) {
              setOwnerDisplayName(ownerData.displayName);
            } else if (ownerData?.email) {
              setOwnerDisplayName(ownerData.email);
            } else {
              setOwnerDisplayName(ownerId);
            }
          } catch (err) {
            console.warn("Failed to fetch owner displayName:", err);
            setOwnerDisplayName(ownerId);
          }
        }
        for (const collabId of collaborators) {
          try {
            const collabRef = doc(db, "users", collabId);
            const collabSnap = await getDoc(collabRef);
            const collabData = collabSnap.data();
            if (collabData?.displayName) {
              names[collabId] = collabData.displayName;
            } else if (collabData?.email) {
              names[collabId] = collabData.email;
            } else {
              names[collabId] = collabId;
            }
          } catch (err) {
            console.warn(`Failed to fetch displayName for ${collabId}:`, err);
            names[collabId] = collabId;
          }
        }
        setCollaboratorDisplayNames(names);
      };
      void fetchDisplayNames();

      // Load slides subcollection
      const slidesRef = collection(db, "presentations", presentationId, "slides");
      const slidesQuery = query(slidesRef, orderBy("order", "asc"));
      let slidesSnap;
      try {
        slidesSnap = await getDocs(slidesQuery);
      } catch (error) {
        console.error("Firestore error (getDocs slides):", error);
        throw error;
      }

      if (!slidesSnap.empty) {
        const loadedSlides: SlideData[] = slidesSnap.docs
          .map((docSnap, index) => {
            const data = docSnap.data();
            const rawContent =
              typeof data.content === "string" && data.content.length > 0
                ? data.content
                : typeof data.subtitle === "string"
                ? data.subtitle
                : "";
            const rawNotes = typeof data.notes === "string" ? data.notes : "";

            // Safely decrypt content
            let decryptedContent = "";
            if (rawContent) {
              try {
                decryptedContent = decryptText(rawContent);
                // If decryption returns empty but we had content, use original
                if (!decryptedContent && rawContent.trim()) {
                  decryptedContent = rawContent;
                }
              } catch (error) {
                // If decryption fails, use original content
                console.warn("Failed to decrypt content, using as-is:", error);
                decryptedContent = rawContent;
              }
            }
            
            // Safely decrypt notes
            let decryptedNotes = "";
            if (rawNotes) {
              try {
                decryptedNotes = decryptText(rawNotes);
                // If decryption returns empty but we had content, use original
                if (!decryptedNotes && rawNotes.trim()) {
                  decryptedNotes = rawNotes;
                }
              } catch (error) {
                // If decryption fails, use original notes
                console.warn("Failed to decrypt notes, using as-is:", error);
                decryptedNotes = rawNotes;
              }
            }

            const finalContent =
              decryptedContent ||
              (typeof data.subtitle === "string" ? data.subtitle : "") ||
              rawContent ||
              "";
            const finalNotes = decryptedNotes || rawNotes || "";

            // Decrypt subtitle if it exists
            let decryptedSubtitle = "";
            if (typeof data.subtitle === "string" && data.subtitle) {
              try {
                const rawSubtitle = data.subtitle;
                // Check if subtitle looks encrypted
                const looksEncrypted = rawSubtitle.startsWith("U2FsdGVk");
                
                if (looksEncrypted) {
                  const decrypted = decryptText(rawSubtitle);
                  // Check if decryption actually worked
                  if (decrypted === rawSubtitle || (decrypted && decrypted.startsWith("U2FsdGVk"))) {
                    // Decryption failed, use as-is (might be plain text)
                    decryptedSubtitle = rawSubtitle;
                  } else {
                    // Decryption succeeded
                    decryptedSubtitle = decrypted;
                  }
                } else {
                  // Doesn't look encrypted, use as-is
                  decryptedSubtitle = rawSubtitle;
                }
              } catch (error) {
                console.warn("Failed to decrypt subtitle:", error);
                decryptedSubtitle = data.subtitle;
              }
            }

            return {
              id: docSnap.id,
              order: typeof data.order === "number" ? data.order : index + 1,
              title: data.title || placeholderMap.title,
              subtitle: decryptedSubtitle || finalContent || placeholderMap.subtitle,
              content: typeof data.content === "string" && data.content.length > 0 ? (decryptText(data.content) || data.content) : undefined,
              notes: finalNotes,
              theme: data.theme || presentationTheme || themes[0]?.name || DEFAULT_THEME,
              slideType: typeof data.slideType === "string" ? (data.slideType as "cover" | "content" | "ending") : undefined,
              templateId: typeof data.templateId === "string" ? data.templateId : undefined,
              formatting: ensureFormatting(data.formatting),
              imageUrl: typeof data.imageUrl === "string" && data.imageUrl.length > 0 ? data.imageUrl : undefined,
              imageX: typeof data.imageX === "number" ? data.imageX : undefined,
              imageY: typeof data.imageY === "number" ? data.imageY : undefined,
              imageWidth: typeof data.imageWidth === "number" ? data.imageWidth : undefined,
              imageHeight: typeof data.imageHeight === "number" ? data.imageHeight : undefined,
              background: typeof data.background === "string" && (data.background === "default" || data.background === "soft" || data.background === "dark") ? (data.background as "default" | "soft" | "dark") : undefined,
              layout: typeof data.layout === "string" && (data.layout === "layout1" || data.layout === "layout2" || data.layout === "layout3") ? (data.layout as "layout1" | "layout2" | "layout3") : undefined,
            };
          })
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        setSlides(loadedSlides);
        
        // Set selected slide based on slideId from URL or first slide
        // Do NOT update URL here to avoid infinite loops - URL will be updated by the useEffect below
        const urlSlideId = explicitSlideId ?? searchParams.get("slideId");
        if (urlSlideId && loadedSlides.some((s) => s.id === urlSlideId)) {
          setSelectedSlideId(urlSlideId);
        } else if (loadedSlides.length > 0) {
          const fallbackId = loadedSlides[0].id;
          setSelectedSlideId(fallbackId);
        }
        
        setIsLoadingSlides(false);
      } else {
        // No slides found, create a default one
        const defaultSlide: SlideData = {
          id: `slide-${Date.now()}`,
          title: placeholderMap.title,
          subtitle: placeholderMap.subtitle,
          notes: "",
          theme: presentationTheme || themes[0]?.name || DEFAULT_THEME,
          formatting: createDefaultFormatting(),
        };
        setSlides([defaultSlide]);
        setSelectedSlideId(defaultSlide.id);
        setIsLoadingSlides(false);
        
        // Save the default slide to Firestore
        if (presentationId) {
          try {
            const slideRef = doc(db, "presentations", presentationId, "slides", defaultSlide.id);
            await setDoc(slideRef, {
              order: 1,
              title: defaultSlide.title,
              subtitle: encryptText(defaultSlide.subtitle),
              notes: encryptText(defaultSlide.notes),
              theme: defaultSlide.theme,
              formatting: defaultSlide.formatting,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (saveError) {
            console.error("Failed to save default slide to Firestore:", saveError);
          }
        }
      }

      setHasLoadedFromFirestore(true);
    } catch (error) {
      console.error("Failed to load from Firestore:", error);
      setIsLoadingSlides(false);
    } finally {
      setIsLoadingFromFirestore(false);
    }
  },
  [presentationId, hasLoadedFromFirestore, router]
);

  // Theme is managed by useTheme hook - no need for separate useEffect

  // Load from Firestore if presentationId is available
  useEffect(() => {
    if (presentationId && !hasLoadedFromFirestore && !isLoadingFromFirestore) {
      void loadFromFirestore();
    }
  }, [presentationId, hasLoadedFromFirestore, isLoadingFromFirestore, loadFromFirestore]);

  // Update URL when selectedSlideId changes (for Firestore mode)
  // This is the ONLY place that updates the slideId in the URL
  useEffect(() => {
    if (presentationId && hasLoadedFromFirestore && selectedSlideId) {
      const currentSlideId = searchParams.get("slideId");
      if (currentSlideId !== selectedSlideId) {
        router.replace(`/editor/${encodeURIComponent(presentationId)}?slideId=${encodeURIComponent(selectedSlideId)}`);
      }
    }
  }, [selectedSlideId, presentationId, hasLoadedFromFirestore, router]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setFirebaseUserId(firebaseUser?.uid ?? null);
      setFirebaseUserEmail(firebaseUser?.email ?? null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!presentationId) {
      setPresentationOwnerId(null);
      setPresentationCollaboratorIds([]);
    }
  }, [presentationId]);

  // Update selected slide when URL slideId changes (for browser back/forward)
  // Use useMemo to get the actual slideId value to avoid triggering on searchParams reference changes
  const urlSlideId = useMemo(() => searchParams.get("slideId"), [searchParams]);
  
  // Memoize slide IDs to avoid dependency on entire slides array
  const slideIds = useMemo(() => slides.map((s) => s.id), [slides]);
  
  useEffect(() => {
    if (!presentationId || !hasLoadedFromFirestore || !urlSlideId) return;
    // Only update if the URL slideId is different and exists in slides
    if (urlSlideId !== selectedSlideId && slideIds.includes(urlSlideId)) {
      setSelectedSlideId(urlSlideId);
    }
  }, [urlSlideId, presentationId, hasLoadedFromFirestore, slideIds, selectedSlideId]);

  // Fallback to localStorage if no presentationId (legacy mode)
  useEffect(() => {
    if (presentationId || hasLoadedFromFirestore) {
      // If using Firestore, ensure loading state is cleared (in case Firestore load hasn't happened yet)
      // The loadFromFirestore function will handle clearing isLoadingSlides when it completes
      return;
    }
    if (typeof window === "undefined") {
      setIsLoadingSlides(false);
      return;
    }
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) {
        setIsLoadingSlides(false);
        return;
      }
      const parsed = JSON.parse(stored) as SlideData[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setIsLoadingSlides(false);
        return;
      }
      const normalized = parsed.map((slide, index) => ({
        ...slide,
        order: slide.order ?? index + 1,
        id: slide.id || `slide-${index + 1}`,
        title: slide.title ?? placeholderMap.title,
        subtitle: slide.subtitle ?? placeholderMap.subtitle,
        notes: slide.notes ?? "",
        theme: slide.theme ?? themes[0]?.name ?? DEFAULT_THEME,
        formatting: ensureFormatting(slide.formatting),
      }));
      setSlides(normalized);
      setSelectedSlideId((current) => {
        if (normalized.some((slide) => slide.id === current)) {
          return current;
        }
        return normalized[0]?.id ?? current;
      });
      setIsLoadingSlides(false);
    } catch (error) {
      console.error("Failed to load slides from storage", error);
      setIsLoadingSlides(false);
    } finally {
      hasHydratedRef.current = true;
    }
  }, [storageKey, presentationId, hasLoadedFromFirestore]);

  // Subscribe to Firestore comments
  useEffect(() => {
    if (!presentationId) {
      setComments([]);
      return;
    }

    const commentsRef = collection(db, "presentations", presentationId, "comments");
    const commentsQuery = query(commentsRef, orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(
      commentsQuery,
      (snapshot) => {
        const items: CommentItem[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const rawText = typeof data.text === "string" ? data.text : "";
          
          // Comments are stored as plain text (no encryption)
          // For backward compatibility, try to decrypt if it looks encrypted, otherwise use as-is
          let finalText = rawText || "";
          if (rawText) {
            // Check if text looks encrypted
            const looksEncrypted = rawText.startsWith("U2FsdGVk");
            
            if (looksEncrypted) {
              // Old encrypted comment - try to decrypt for backward compatibility
              try {
                const decrypted = decryptText(rawText);
                // Check if decryption actually succeeded
                // decryptText returns the original cipher if decryption fails
                const decryptionSucceeded = decrypted && 
                                          decrypted !== rawText && 
                                          !decrypted.startsWith("U2FsdGVk") && 
                                          decrypted.length > 0 &&
                                          decrypted.length < rawText.length; // Decrypted should be shorter
                
                if (decryptionSucceeded) {
                  finalText = decrypted;
                } else {
                  // Decryption failed - show a simple message instead of encrypted string
                  finalText = "[Old encrypted comment - please re-add]";
                }
              } catch (error) {
                // Decryption failed - show simple message
                finalText = "[Old encrypted comment - please re-add]";
              }
            }
            // If not encrypted, finalText is already set to rawText above
          }

          let timestampLabel = "";
          const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
          if (createdAt instanceof Date && !Number.isNaN(createdAt.getTime())) {
            timestampLabel = createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          }

          return {
            id: docSnap.id,
            author: typeof data.userName === "string" && data.userName.length > 0 ? data.userName : "Team member",
            message: finalText,
            timestamp: timestampLabel,
          };
        });

        // Mirror previous UX: newest first.
        setComments(items.slice().reverse());
      },
      (error) => {
        console.error("Failed to subscribe to comments:", error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [presentationId]);

  // Subscribe to versions history
  useEffect(() => {
    if (!presentationId) {
      setVersions([]);
      return;
    }

    const versionsRef = collection(db, "presentations", presentationId, "versions");
    const versionsQuery = query(versionsRef, orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      versionsQuery,
      (snapshot) => {
        const records: PresentationVersion[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const createdAt =
            data.createdAt && typeof data.createdAt.toDate === "function" ? data.createdAt.toDate() : null;
          const summary = typeof data.summary === "string" ? data.summary : "";
          const createdBy = typeof data.createdBy === "string" ? data.createdBy : null;
          const rawSlides = Array.isArray(data.slidesSnapshot) ? data.slidesSnapshot : [];
          const slidesSnapshot: VersionSnapshotSlide[] = rawSlides
            .map((item) => ({
              slideId: typeof item.slideId === "string" ? item.slideId : "",
              order: typeof item.order === "number" ? item.order : 0,
              title: typeof item.title === "string" ? item.title : "",
              encryptedContent: typeof item.encryptedContent === "string" ? item.encryptedContent : "",
              encryptedNotes: typeof item.encryptedNotes === "string" ? item.encryptedNotes : "",
              theme: typeof item.theme === "string" ? item.theme : "default",
              slideType: typeof item.slideType === "string" ? (item.slideType as "cover" | "content" | "ending") : undefined,
            }))
            .filter((item) => item.slideId.length > 0);

          return {
            id: docSnap.id,
            createdAt,
            createdBy,
            summary,
            slidesSnapshot,
          };
        });
        setVersions(records);
      },
      (error) => {
        console.error("Failed to subscribe to versions:", error);
      }
    );

    return () => unsubscribe();
  }, [presentationId]);

  // Expose version handlers for future UI hooks (without changing layout)
  // Save to localStorage only if not using Firestore (legacy mode)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasHydratedRef.current) return;
    if (presentationId && hasLoadedFromFirestore) return; // Skip if using Firestore
    window.localStorage.setItem(storageKey, JSON.stringify(slides));
  }, [slides, storageKey, presentationId, hasLoadedFromFirestore]);

  useEffect(() => {
    if (!isColorPickerOpen) return;
    const handleClickAway = (event: MouseEvent) => {
      if (!colorButtonRef.current?.contains(event.target as Node)) {
        setIsColorPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickAway);
    return () => document.removeEventListener("mousedown", handleClickAway);
  }, [isColorPickerOpen]);

  useEffect(() => {
    if (!isHighlightPickerOpen) return;
    const handleClickAway = (event: MouseEvent) => {
      if (!highlightButtonRef.current?.contains(event.target as Node)) {
        setIsHighlightPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickAway);
    return () => document.removeEventListener("mousedown", handleClickAway);
  }, [isHighlightPickerOpen]);

  useEffect(() => {
    if (!isThemePickerOpen) return;
    const handleClickAway = (event: MouseEvent) => {
      if (!themeButtonRef.current?.contains(event.target as Node)) {
        setIsThemePickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickAway);
    return () => document.removeEventListener("mousedown", handleClickAway);
  }, [isThemePickerOpen]);

  // Update content when slide changes, but don't interfere while user is typing
  const prevSlideIdRef = useRef<string | undefined>(selectedSlide?.id);
  // Use a ref to store the latest slides array to avoid dependency issues
  const slidesRef = useRef<SlideData[]>(slides);
  slidesRef.current = slides;
  
  // Extract stable values from selectedSlide to avoid object reference changes
  const selectedSlideId_stable = selectedSlide?.id;
  const selectedSlideTitle = selectedSlide?.title;
  const selectedSlideSubtitle = selectedSlide?.subtitle;
  const selectedSlideFormatting = selectedSlide?.formatting;
  
  useEffect(() => {
    if (!selectedSlide) return;
    const formatting = selectedSlideFormatting ?? DEFAULT_FORMATTING;
    const slideChanged = prevSlideIdRef.current !== selectedSlideId_stable;
    const previousSlideId = prevSlideIdRef.current;
    prevSlideIdRef.current = selectedSlideId_stable;
    
    // Capture snapshot of previous slide before switching (if it existed)
    // Use slidesRef.current to avoid dependency on slides array
    if (slideChanged && previousSlideId) {
      captureSnapshotOnSlideChange(previousSlideId, slidesRef.current);
    }
    
    // When slide changes, always update content
    // When same slide, only update if field is NOT focused (user is not typing)
    const shouldUpdateTitle = slideChanged || document.activeElement !== titleRef.current;
    const shouldUpdateSubtitle = slideChanged || document.activeElement !== subtitleRef.current;
    
    if (titleRef.current && shouldUpdateTitle) {
      const currentContent = titleRef.current.innerHTML.trim();
      const newContent = selectedSlideTitle || placeholderMap.title;
      // Only update if content actually changed
      if (currentContent !== newContent) {
        titleRef.current.innerHTML = newContent;
      }
      titleRef.current.style.lineHeight = `${formatting.title.lineHeight}`;
    }
    if (subtitleRef.current && shouldUpdateSubtitle) {
      const currentContent = subtitleRef.current.innerHTML.trim();
      const newContent = selectedSlideSubtitle || placeholderMap.subtitle;
      // Only update if content actually changed (normalize whitespace for comparison)
      const normalizedCurrent = currentContent.replace(/\s+/g, ' ').trim();
      const normalizedNew = newContent.replace(/\s+/g, ' ').trim();
      if (normalizedCurrent !== normalizedNew) {
        subtitleRef.current.innerHTML = newContent;
      }
      subtitleRef.current.style.lineHeight = `${formatting.subtitle.lineHeight}`;
    }
    if (notesRef.current) {
      notesRef.current.style.lineHeight = `${formatting.notes.lineHeight}`;
    }
  }, [selectedSlideId_stable, selectedSlideTitle, selectedSlideSubtitle, selectedSlideFormatting, slides.length, captureSnapshotOnSlideChange]); // Update when slide or content changes

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = document.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      const node = range.startContainer;

      if (titleRef.current?.contains(node)) {
        setActiveField("title");
        selectionRef.current = range.cloneRange();
        setIsColorPickerOpen(false);
        setIsHighlightPickerOpen(false);
        syncCommandState();
      } else if (subtitleRef.current?.contains(node)) {
        setActiveField("subtitle");
        selectionRef.current = range.cloneRange();
        setIsColorPickerOpen(false);
        setIsHighlightPickerOpen(false);
        syncCommandState();
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  const isEditableField = activeField === "title" || activeField === "subtitle";

  const normalizeColor = (value: string | null): string => {
    if (!value || value === "transparent") return "transparent";
    if (value.includes("0, 0, 0, 0")) return "transparent";
    if (value.startsWith("#")) {
      return value.length === 4
        ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
        : value;
    }
    const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return value;
    const [r, g, b] = match.slice(1).map((channel) => Number(channel));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b
      .toString(16)
      .padStart(2, "0")}`.toUpperCase();
  };

  const getFieldRef = (field: FieldKey) => {
    if (field === "title") return titleRef.current;
    if (field === "subtitle") return subtitleRef.current;
    return null;
  };

  const restoreSelection = () => {
    if (!isEditableField) return false;
    const range = selectionRef.current;
    const ref = getFieldRef(activeField);
    if (!ref) return false;
    ref.focus({ preventScroll: true });
    if (range) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    return true;
  };

  const syncActiveFieldContent = (field: FieldKey) => {
    const ref = getFieldRef(field);
    if (!ref) return;
    const html = ref.innerHTML;
    const placeholder = placeholderMap[field];
    const cleaned = html
      .replace(/<br\s*\/?>/gi, "")
      .replace(/&nbsp;/gi, " ")
      .trim();
    const nextValue = cleaned ? html : placeholder;
    if (!cleaned) {
      ref.innerHTML = placeholder;
    }
    updateSlideField(fieldKeyMap[field], nextValue);
  };

  const handleToolbarMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!isEditableField) return;
    event.preventDefault();
    restoreSelection();
  };

  const execWithCommand = (command: string, value?: string) => {
    if (!isEditableField) return;
    if (!restoreSelection()) return;
    document.execCommand(command, false, value ?? undefined);
    syncActiveFieldContent(activeField);
    syncCommandState();
  };

  const syncCommandState = () => {
    if (!isEditableField) {
      setCommandState((prev) => ({
        ...prev,
        bold: false,
        italic: false,
        underline: false,
        listType: "none",
      }));
      return;
    }

    const bold = document.queryCommandState("bold");
    const italic = document.queryCommandState("italic");
    const underline = document.queryCommandState("underline");

    const unordered = document.queryCommandState("insertUnorderedList");
    const ordered = document.queryCommandState("insertOrderedList");

    const align = document.queryCommandState("justifyCenter")
      ? "center"
      : document.queryCommandState("justifyRight")
      ? "right"
      : "left";

    const fontNameRaw = document.queryCommandValue("fontName") as string | null;
    const fontFamily = fontNameRaw
      ? fontNameRaw.split(",")[0].replace(/["']/g, "").trim()
      : commandState.fontFamily;

    const fontSizeCommand = (document.queryCommandValue("fontSize") as string | null) ?? "";
    const fontSize = COMMAND_TO_FONT_SIZE[fontSizeCommand] ?? commandState.fontSize;

    const color = normalizeColor(document.queryCommandValue("foreColor") as string | null);
    const highlight = normalizeColor(
      (document.queryCommandValue("hiliteColor") as string | null) ??
        (document.queryCommandValue("backColor") as string | null)
    );

    setCommandState({
      fontFamily,
      fontSize,
      bold,
      italic,
      underline,
      color: color === "transparent" ? commandState.color : color,
      highlight: highlight === "transparent" ? "transparent" : highlight,
      align,
      listType: unordered ? "bullet" : ordered ? "number" : "none",
    });
  };

  const handleContentInput = (field: FieldKey) => {
    const ref = getFieldRef(field);
    if (!ref) return;
    updateSlideField(fieldKeyMap[field], ref.innerHTML);
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      selectionRef.current = selection.getRangeAt(0).cloneRange();
    }
    // Capture snapshot with debounce
    if (selectedSlideId) {
      captureSnapshotDebounced(selectedSlideId);
    }
  };

  const handleContentBlur = (field: FieldKey) => {
    const ref = getFieldRef(field);
    if (!ref) return;
    const text = ref.textContent?.replace(/\u00a0/g, " ").trim() ?? "";
    if (!text) {
      ref.innerHTML = placeholderMap[field];
      updateSlideField(fieldKeyMap[field], placeholderMap[field]);
    }
    // Capture snapshot immediately on blur
    if (selectedSlideId) {
      captureSnapshotImmediate(selectedSlideId);
    }
  };

  const handleContentFocus = (field: FieldKey) => {
    if (isReadOnly) return;
    setActiveField(field);
    setIsColorPickerOpen(false);
    setIsHighlightPickerOpen(false);
  };

  const handleNotesChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isReadOnly) return;
    const value = event.target.value;
    setSpeakerNotes(value);
    updateSlideField("notes", value);
    autoResizeNotes(event.target);
    // Capture snapshot with debounce
    if (selectedSlideId) {
      captureSnapshotDebounced(selectedSlideId);
    }
  };

  const handleNotesFocus = () => {
    setActiveField("notes");
    setIsColorPickerOpen(false);
    setIsHighlightPickerOpen(false);
  };

  // Sync speakerNotes with selectedSlide notes
  useEffect(() => {
    setSpeakerNotes(selectedSlide?.notes ?? "");
  }, [selectedSlide?.notes]);

  // Voice Recognition Setup
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    // Check if SpeechRecognition API is available (works in Chrome, Edge, Safari, etc.)
    if (!SpeechRecognition) {
      setVoiceError("Voice notes are not supported in this browser. Please use Chrome, Edge, or Safari.");
      setIsVoiceRecording(false);
      recognitionRef.current = null;
      return;
    }

    // Clear any previous error if we have support
    setVoiceError(null);

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.continuous = true;
      recognition.interimResults = false; // only final results

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript + " ";
        }
        transcript = transcript.trim();
        if (transcript) {
          console.log("Recognized transcript:", transcript);
          setSpeakerNotes((prev) => {
            const newNotes = prev ? prev + "\n" + transcript : transcript;
            // Update the slide directly
            updateSlideField("notes", newNotes);
            return newNotes;
          });
        }
      };

      recognition.onerror = (event: any) => {
        // Handle speech recognition errors gracefully
        const errorType = event?.error || "unknown";
        const errorMessage = event?.message || "";
        
        // Handle specific error types
        if (errorType === "not-allowed") {
          setVoiceError("Microphone permission denied. Please allow microphone access in your browser settings.");
          setIsVoiceRecording(false);
          isRecordingRef.current = false;
        } else if (errorType === "no-speech") {
          // This is normal - user didn't speak, just restart silently if still recording
          if (isRecordingRef.current) {
            try {
              recognition.start();
            } catch (e) {
              // Already started or other error, ignore
            }
          }
        } else if (errorType === "aborted") {
          // User stopped or navigation occurred, this is normal
          setIsVoiceRecording(false);
          isRecordingRef.current = false;
        } else if (errorType !== "unknown") {
          // Log other errors but don't show error message for minor issues
          console.warn("Speech recognition error:", errorType, errorMessage);
          if (errorType === "network" || errorType === "service-not-allowed") {
            setVoiceError("Speech recognition service unavailable. Please check your internet connection.");
            setIsVoiceRecording(false);
            isRecordingRef.current = false;
          }
        }
      };

      recognition.onend = () => {
        console.log("Speech recognition ended");
        // Auto-restart if we're still in recording mode (use ref to avoid stale closure)
        if (isRecordingRef.current) {
          try {
            recognition.start();
          } catch (e) {
            // Already started or error, stop recording
            setIsVoiceRecording(false);
            isRecordingRef.current = false;
          }
        } else {
          setIsVoiceRecording(false);
        }
      };

      recognitionRef.current = recognition as any;
    } catch (error) {
      console.error("Failed to initialize speech recognition:", error);
      setVoiceError("Failed to initialize voice recognition. Please try refreshing the page.");
      recognitionRef.current = null;
    }

    return () => {
      try {
        if (recognitionRef.current) {
          (recognitionRef.current as any).stop();
        }
      } catch {}
    };
  }, []);

  const handleToggleVoice = async () => {
    // Check for browser support error first
    if (voiceError && !recognitionRef.current) {
      return; // Don't attempt to start if browser doesn't support it
    }

    const recognition = recognitionRef.current;
    if (!recognition) {
      setVoiceError("Voice recognition is not available. Please refresh the page.");
      return;
    }

    if (isVoiceRecording) {
      console.log("Stopping recognition");
      try {
        isRecordingRef.current = false;
        recognition.stop();
        setIsVoiceRecording(false);
      } catch (err) {
        console.warn("Error stopping recognition:", err);
        isRecordingRef.current = false;
        setIsVoiceRecording(false);
      }
    } else {
      try {
        // Request microphone permission first
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (permError: any) {
          if (permError.name === "NotAllowedError" || permError.name === "PermissionDeniedError") {
            setVoiceError("Microphone permission denied. Please allow microphone access in your browser settings.");
            return;
          } else if (permError.name === "NotFoundError" || permError.name === "DevicesNotFoundError") {
            setVoiceError("No microphone found. Please connect a microphone and try again.");
            return;
          }
          // For other errors, try to proceed anyway
          console.warn("Microphone permission check failed:", permError);
        }

        console.log("Starting recognition");
        isRecordingRef.current = true;
        recognition.start();
        setIsVoiceRecording(true);
        setVoiceError(null); // Clear any previous errors
      } catch (err: any) {
        console.warn("Error starting recognition:", err);
        isRecordingRef.current = false;
        setIsVoiceRecording(false);
        
        // Provide helpful error messages
        if (err?.message?.includes("already started") || err?.name === "InvalidStateError") {
          // Recognition is already running, just update state
          isRecordingRef.current = true;
          setIsVoiceRecording(true);
        } else {
          setVoiceError("Failed to start voice recognition. Please try again.");
        }
      }
    }
  };

  const autoResizeNotes = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 80), 400)}px`;
  };

  const handleThemeSelect = useCallback(
    (themeName: string) => {
      console.log("🎨 Theme selection triggered:", themeName);
      console.log("📊 Current state before update:", { 
        presentationTheme, 
        selectedSlideTheme: selectedSlide?.theme,
        selectedSlideId,
        slidesCount: slides.length
      });
      
      // CRITICAL: Update presentation-level theme state FIRST (this triggers immediate re-render)
      // Use flushSync to ensure the state update happens immediately (React 18)
      setPresentationTheme(themeName);
      console.log("✅ Setting presentationTheme to:", themeName);
      
      // Verify the theme exists
      const themeObj = getThemeByName(themeName);
      if (!themeObj) {
        console.error("❌ Theme not found:", themeName);
        return;
      }
      console.log("✅ Theme object found:", { id: themeObj.id, name: themeObj.name });
      
      // Apply theme to all slides in the deck (only if slides exist)
      // This updates the local state immediately for visual feedback
      setSlides((prev) => {
        if (prev.length === 0) {
          console.warn("⚠️ No slides to update");
          return prev;
        }
        
        console.log(`📝 Updating ${prev.length} slides with theme: ${themeName}`);
        
        const updatedSlides = prev.map((slide, index) => {
          const newSlideType = themeName === "SCDT" 
            ? (index === 0 ? "cover" : index === prev.length - 1 ? "ending" : "content")
            : slide.slideType; // Preserve existing slideType if not SCDT
          
          return {
            ...slide,
            theme: themeName,
            slideType: newSlideType,
          };
        });
        
        // Save all slides to Firestore in parallel
        if (presentationId) {
          const updatePromises = updatedSlides.map((slide) => {
            if (slide.id) {
              const slideRef = doc(db, "presentations", presentationId, "slides", slide.id);
              return setDoc(
                slideRef,
                {
                  theme: themeName,
                  slideType: slide.slideType || "content",
                  updatedAt: serverTimestamp(),
                },
                { merge: true }
              ).then(() => {
                console.log(`💾 Slide ${slide.id} saved with theme: ${themeName}`);
              }).catch((error) => {
                console.error(`❌ Failed to update slide ${slide.id} theme:`, error);
              });
            }
            return Promise.resolve();
          });
          
          // Also update the presentation document
          const presentationRef = doc(db, "presentations", presentationId);
          const themeObj = getThemeByName(themeName);
          updatePromises.push(
            setDoc(
              presentationRef,
              {
                theme: themeName,
                themeId: themeObj?.id || "default",
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            ).then(() => {
              console.log(`💾 Presentation saved with theme: ${themeName}`);
            }).catch((error) => {
              console.error("❌ Failed to update theme in Firestore:", error);
            })
          );
          
          // Execute all updates in parallel
          void Promise.all(updatePromises);
        } else {
          console.warn("⚠️ No presentationId available");
        }
        
        return updatedSlides;
      });
      
      // Force a re-render by logging the state after a microtask
      Promise.resolve().then(() => {
        console.log("🔄 State after update should trigger re-render");
      });
    },
    [presentationId, slides, selectedSlide]
  );

  const handleSlideTypeSelect = useCallback(
    (newSlideType: "cover" | "content" | "ending") => {
      if (!selectedSlide) return;
      
      updateSlideField("slideType", newSlideType);
      
      // Also update in Firestore if we have a presentationId
      if (presentationId && selectedSlide.id) {
        const slideRef = doc(db, "presentations", presentationId, "slides", selectedSlide.id);
        setDoc(slideRef, { slideType: newSlideType, updatedAt: serverTimestamp() }, { merge: true }).catch(console.error);
      }
    },
    [selectedSlide, presentationId]
  );

  useEffect(() => {
    if (notesRef.current) {
      autoResizeNotes(notesRef.current);
    }
  }, [selectedSlideId, selectedSlide?.notes]);

  const applyFontFamily = (font: string) => {
    execWithCommand("fontName", font);
  };

  const applyFontSize = (size: number) => {
    const commandValue = FONT_SIZE_TO_COMMAND[size];
    if (!commandValue) return;
    execWithCommand("fontSize", commandValue);
  };

  const toggleBold = () => execWithCommand("bold");
  const toggleItalic = () => execWithCommand("italic");
  const toggleUnderline = () => execWithCommand("underline");

  const applyTextColor = (color: string) => {
    setIsColorPickerOpen(false);
    execWithCommand("foreColor", color);
  };

  const applyHighlightColor = (color: string) => {
    setIsHighlightPickerOpen(false);
    if (!isEditableField || !restoreSelection()) return;
    let success = document.execCommand("hiliteColor", false, color);
    if (!success) {
      document.execCommand("backColor", false, color);
    }
    syncActiveFieldContent(activeField);
    syncCommandState();
  };

  const applyAlign = (align: AlignOption) => {
    const command = align === "center" ? "justifyCenter" : align === "right" ? "justifyRight" : "justifyLeft";
    execWithCommand(command);
  };

  const applyList = (type: "bullet" | "number") => {
    const command = type === "bullet" ? "insertUnorderedList" : "insertOrderedList";
    execWithCommand(command);
  };

  const applyLineHeight = (value: number) => {
    if (activeField === "notes") {
      if (notesRef.current) {
        notesRef.current.style.lineHeight = value.toString();
      }
    } else {
      if (!isEditableField) return;
      const ref = getFieldRef(activeField);
      if (!ref) return;
      ref.style.lineHeight = value.toString();
    }

    setSlides((prev) =>
      prev.map((slide) => {
        if (slide.id !== selectedSlideId) return slide;
        const formatting = ensureFormatting(slide.formatting);
        return {
          ...slide,
          formatting: {
            ...formatting,
            [activeField]: { lineHeight: value },
          },
        };
      })
    );

    if (activeField !== "notes") {
      syncActiveFieldContent(activeField);
    }
  };

  // New formatting handlers for whole-block formatting (title/subtitle)
  const updateSelectedSlideFormatting = useCallback(
    (updater: (prev: SlideFormatting) => SlideFormatting) => {
      if (!selectedSlideId) return;

      setSlides((prev) =>
        prev.map((slide) => {
          if (slide.id !== selectedSlideId) return slide;
          const prevFormatting = ensureFormatting(slide.formatting);
          return {
            ...slide,
            formatting: updater(prevFormatting),
          };
        })
      );

      if (presentationId && selectedSlideId) {
        const slide = slides.find((s) => s.id === selectedSlideId);
        if (slide) {
          const prevFormatting = ensureFormatting(slide.formatting);
          const nextFormatting = updater(prevFormatting);
          const slideRef = doc(db, "presentations", presentationId, "slides", selectedSlideId);
          void setDoc(
            slideRef,
            { formatting: nextFormatting, updatedAt: serverTimestamp() },
            { merge: true }
          );
        }
      }
    },
    [slides, selectedSlideId, presentationId]
  );

  const handleToggleBold = useCallback(() => {
    updateSelectedSlideFormatting((prev) => ({ ...prev, bold: !prev.bold }));
  }, [updateSelectedSlideFormatting]);

  const handleToggleItalic = useCallback(() => {
    updateSelectedSlideFormatting((prev) => ({ ...prev, italic: !prev.italic }));
  }, [updateSelectedSlideFormatting]);

  const handleToggleUnderline = useCallback(() => {
    updateSelectedSlideFormatting((prev) => ({ ...prev, underline: !prev.underline }));
  }, [updateSelectedSlideFormatting]);

  const handleSetAlign = useCallback(
    (align: "left" | "center" | "right") => {
      updateSelectedSlideFormatting((prev) => ({ ...prev, align }));
    },
    [updateSelectedSlideFormatting]
  );

  const handleSetListType = useCallback(
    (listType: "none" | "bullets" | "numbers") => {
      updateSelectedSlideFormatting((prev) => ({ ...prev, listType }));
    },
    [updateSelectedSlideFormatting]
  );

  // Image drag and resize handlers
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isResizingImage, setIsResizingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const updateImagePosition = useCallback((x: number, y: number) => {
    if (!selectedSlideId) return;
    setSlides((prev) =>
      prev.map((slide) =>
        slide.id === selectedSlideId
          ? { ...slide, imageX: x, imageY: y }
          : slide
      )
    );
  }, [selectedSlideId]);

  const updateImageSize = useCallback((width: number, height: number) => {
    if (!selectedSlideId) return;
    setSlides((prev) =>
      prev.map((slide) =>
        slide.id === selectedSlideId
          ? { ...slide, imageWidth: width, imageHeight: height }
          : slide
      )
    );
  }, [selectedSlideId]);

  // These handlers will be defined after isReadOnly is available
  const handleImageMouseDownRef = useRef<((e: React.MouseEvent, slideContainer: HTMLElement) => void) | null>(null);
  const handleImageResizeMouseDownRef = useRef<((e: React.MouseEvent, slideContainer: HTMLElement) => void) | null>(null);


  const updateSlideField = (field: keyof SlideData, value: string | "cover" | "content" | "ending") => {
    setSlides((prev) =>
      prev.map((slide) => (slide.id === selectedSlideId ? { ...slide, [field]: value } : slide))
    );
  };


  const compressImage = (file: File, maxWidth: number = 1200, maxHeight: number = 1200, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Calculate new dimensions
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            } else {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }

          // Create canvas and compress
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to base64 with compression
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          
          // Check if still too large (Firestore limit is ~1MB, but base64 is ~33% larger, so aim for ~750KB)
          if (compressedBase64.length > 750000) {
            // Try again with lower quality
            const lowerQuality = quality * 0.7;
            const moreCompressed = canvas.toDataURL('image/jpeg', lowerQuality);
            resolve(moreCompressed);
          } else {
            resolve(compressedBase64);
          }
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    setImageFile(file);

    // Compress and create preview
    try {
      const compressedBase64 = await compressImage(file);
      setImagePreview(compressedBase64);
    } catch (error) {
      console.error('Error compressing image:', error);
      alert('Error processing image. Please try another image.');
      setImageFile(null);
    }
  };

  const handleSaveImage = async () => {
    if (!selectedSlide || !imageFile) return;

    try {
      // Compress image before saving (already compressed in preview, but ensure it's ready)
      const base64Image = imagePreview || await compressImage(imageFile);
      
      if (!base64Image) {
        alert('Error processing image. Please try again.');
        return;
      }

      // Final check - ensure it's under Firestore limit
      if (base64Image.length > 1000000) {
        // Try with more aggressive compression
        const moreCompressed = await compressImage(imageFile, 800, 800, 0.6);
        if (moreCompressed.length > 1000000) {
          alert('Image is too large even after compression. Please use a smaller image.');
          return;
        }
        
        // Update local state with compressed image
        setSlides((prev) =>
          prev.map((slide) =>
            slide.id === selectedSlide.id
              ? { ...slide, imageUrl: moreCompressed }
              : slide
          )
        );

        // Save to Firestore
        if (presentationId) {
          const slideRef = doc(db, "presentations", presentationId, "slides", selectedSlide.id);
          await setDoc(
            slideRef,
            { 
              imageUrl: moreCompressed,
              updatedAt: serverTimestamp() 
            },
            { merge: true }
          );
        }
      } else {
        // Update local state - save to imageUrl field with default position/size (no encryption needed)
        setSlides((prev) =>
          prev.map((slide) =>
            slide.id === selectedSlide.id
              ? { 
                  ...slide, 
                  imageUrl: base64Image,
                  imageX: slide.imageX ?? 50,
                  imageY: slide.imageY ?? 50,
                  imageWidth: slide.imageWidth ?? 30,
                  imageHeight: slide.imageHeight ?? 30,
                }
              : slide
          )
        );

        // Save to Firestore - save imageUrl directly with position/size (no encryption)
        if (presentationId) {
          const slideRef = doc(db, "presentations", presentationId, "slides", selectedSlide.id);
          await setDoc(
            slideRef,
            { 
              imageUrl: base64Image,
              imageX: selectedSlide.imageX ?? 50,
              imageY: selectedSlide.imageY ?? 50,
              imageWidth: selectedSlide.imageWidth ?? 30,
              imageHeight: selectedSlide.imageHeight ?? 30,
              updatedAt: serverTimestamp() 
            },
            { merge: true }
          );
        }
      }

      setIsImageModalOpen(false);
      setImageFile(null);
      setImagePreview("");
    } catch (error) {
      console.error('Error saving image:', error);
      alert('Error saving image. Please try again.');
    }
  };

  const handleSetBackgroundStyle = async (style: "default" | "soft" | "dark") => {
    // Update presentation-level background
    setPresentationBackground(style);

    // Remove background from all slides (since it's now at presentation level)
    setSlides((prev) =>
      prev.map((slide) => {
        const { background, ...slideWithoutBackground } = slide;
        return slideWithoutBackground;
      })
    );

    // Save background to presentation document in Firestore
    if (presentationId) {
      const presentationRef = doc(db, "presentations", presentationId);
      await setDoc(
        presentationRef,
        { background: style, updatedAt: serverTimestamp() },
        { merge: true }
      );
    }

    setIsBackgroundModalOpen(false);
  };

  const handleSetLayout = async (layout: "layout1" | "layout2" | "layout3") => {
    if (!selectedSlide) return;

    setSlides((prev) =>
      prev.map((slide) =>
        slide.id === selectedSlide.id
          ? { ...slide, layout }
          : slide
      )
    );

    if (presentationId) {
      const slideRef = doc(db, "presentations", presentationId, "slides", selectedSlide.id);
      await setDoc(
        slideRef,
        { layout, updatedAt: serverTimestamp() },
        { merge: true }
      );
    }

    setIsLayoutModalOpen(false);
  };

  const handleAddSlide = async () => {
      const themeName = effectiveThemeName || themes[0]?.name || DEFAULT_THEME;

    if (!presentationId) {
      setSlides((prev) => {
        const nextOrder =
          prev.length > 0
            ? prev.reduce((max, slide, index) => Math.max(max, slide.order ?? index + 1), 0) + 1
            : 1;
        const newSlideId = `slide-${Date.now()}`;
        const defaultFormatting = createDefaultFormatting();
      const newSlide: SlideData = {
          id: newSlideId,
          order: nextOrder,
        title: placeholderMap.title,
        subtitle: placeholderMap.subtitle,
        notes: "",
        theme: themeName,
        slideType: "content",
          formatting: defaultFormatting,
      };
        setSelectedSlideId(newSlideId);
      return [...prev, newSlide];
    });
      return;
    }

    const nextOrder =
      slides.length > 0
        ? slides.reduce((max, slide, index) => Math.max(max, slide.order ?? index + 1), 0) + 1
        : 1;
    const newSlideId = `slide-${Date.now()}`;
    const defaultFormatting = createDefaultFormatting();
    const newSlide: SlideData = {
      id: newSlideId,
      order: nextOrder,
      title: "New slide",
      subtitle: placeholderMap.subtitle,
      notes: "",
      theme: themeName,
      slideType: "content",
      formatting: defaultFormatting,
    };

    try {
      const slideRef = doc(db, "presentations", presentationId, "slides", newSlideId);
      await setDoc(
        slideRef,
        {
          order: nextOrder,
          title: "New slide",
          content: encryptText(""),
          notes: encryptText(""),
          theme: themeName,
          slideType: "content",
          formatting: defaultFormatting,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );


      const currentUser = auth.currentUser;
      await logAuditEvent({
        presentationId,
        userId: currentUser?.uid ?? null,
        userEmail: currentUser?.email ?? null,
        action: "ADD_SLIDE",
        details: { slideId: newSlideId, order: nextOrder },
      });

      setSlides((prev) => [...prev, newSlide].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
      setSelectedSlideId(newSlideId);
      // URL will be updated by the useEffect that watches selectedSlideId
    } catch (error) {
      console.error("Failed to add slide to Firestore:", error);
    }
  };

  useEffect(() => {
    if (!presentationId) return;
    const meta = readPresentationMeta().find((item) => item.id === presentationId);
    if (meta?.status === "final" || meta?.status === "draft") {
      setStatus(meta.status);
    }
  }, [presentationId]);

  useEffect(() => {
    if (!statusMessage) return;
    const timeoutId = window.setTimeout(() => {
      setStatusMessage(null);
      setStatusToastVariant(null);
    }, 3000);
    return () => window.clearTimeout(timeoutId);
  }, [statusMessage]);

  const handleSaveSlide = async (isShared?: boolean) => {
    // Ensure isShared is a boolean (default to false)
    const shouldShare = isShared === true;
    syncActiveFieldContent("title");
    syncActiveFieldContent("subtitle");
    if (notesRef.current) {
      updateSlideField("notes", notesRef.current.value);
    }
    
    // Use user from useAuth hook, with fallback to auth.currentUser
    const currentUser = user || auth.currentUser;
    
    if (!presentationId) {
      // Fallback to localStorage if no presentationId
      const slideSummary = slides.map((slide) => ({
        id: slide.id,
        title: typeof slide.title === "string" ? slide.title : "",
        subtitle: typeof slide.subtitle === "string" ? slide.subtitle : "",
        notes: typeof slide.notes === "string" ? slide.notes : "",
      }));
      markPresentationSaved(presentationId || resolvedParams.id, presentationTitle, slideSummary, status);
      return;
    }

    try {
      // Save presentation document
      const presentationRef = doc(db, "presentations", presentationId);
      const presentationData: any = {
        title: presentationTitle,
        status: status,
        updatedAt: serverTimestamp(),
      };

      // Only set ownerId and isShared flag when sharing (for team dashboard)
      if (shouldShare && currentUser) {
        const userId = typeof currentUser.uid === 'string' ? currentUser.uid : (currentUser as any).uid;
        presentationData.ownerId = userId;
        presentationData.isShared = true; // Mark as shared for team dashboard
      } else if (currentUser) {
        // For private saves, ensure ownerId is set but mark as private
        const userId = typeof currentUser.uid === 'string' ? currentUser.uid : (currentUser as any).uid;
        presentationData.ownerId = userId;
        presentationData.isShared = false; // Mark as private
      }

      try {
        await setDoc(presentationRef, presentationData, { merge: true });
      } catch (error) {
        console.error("Firestore error (setDoc presentation):", error);
        throw error;
      }

      // Save all slides
      for (const slide of slides) {
        const slideIndex = slides.findIndex((s) => s.id === slide.id);
        const slideRef = doc(db, "presentations", presentationId, "slides", slide.id);
        const plainContent =
          typeof slide.content === "string" && slide.content.trim()
            ? slide.content
            : typeof slide.subtitle === "string" && slide.subtitle.trim()
            ? slide.subtitle
            : placeholderMap.subtitle;
        const plainNotes = typeof slide.notes === "string" ? slide.notes : "";
        const encryptedContent = encryptText(plainContent);
        const encryptedNotes = encryptText(plainNotes);

        const slideData: any = {
          order: slideIndex + 1,
          title: typeof slide.title === "string" ? slide.title : "",
          content: encryptedContent,
          notes: encryptedNotes,
          theme: slide.theme || "default",
          formatting: slide.formatting || createDefaultFormatting(),
          updatedAt: serverTimestamp(),
        };
        
        // Only include slideType if it's defined, otherwise use default
        if (slide.slideType && (slide.slideType === "cover" || slide.slideType === "content" || slide.slideType === "ending")) {
          slideData.slideType = slide.slideType;
        } else {
          slideData.slideType = "content";
        }

        try {
          await setDoc(slideRef, slideData, { merge: true });
        } catch (error) {
          console.error("Firestore error (setDoc slide):", error, "Slide ID:", slide.id);
          // Continue with other slides even if one fails
        }
      }

      // Update localStorage meta for recent presentations (always, for both save and share)
      const slideSummary = slides.map((slide) => ({
        id: slide.id,
        title: typeof slide.title === "string" ? slide.title : "",
        subtitle: typeof slide.subtitle === "string" ? slide.subtitle : "",
        notes: typeof slide.notes === "string" ? slide.notes : "",
      }));
      markPresentationSaved(presentationId, presentationTitle, slideSummary, status);

      if (currentUser) {
        const userId = typeof currentUser.uid === 'string' ? currentUser.uid : (currentUser as any).uid;
        const userEmail = typeof currentUser.email === 'string' ? currentUser.email : (currentUser as any).email;
        await logAuditEvent({
          presentationId,
          userId: userId || null,
          userEmail: userEmail || null,
          action: shouldShare ? "SHARE_PRESENTATION" : "UPDATE_SLIDE_SET",
          details: {
            slideIds: slideSummary.map((slide) => slide.id),
            count: slideSummary.length,
            isShared: shouldShare,
          },
        });
      }
    } catch (error) {
      console.error("Failed to save to Firestore:", error);
    }
  };

  const handleShare = async () => {
    if (!presentationId) {
      console.error("Cannot share: no presentation ID");
      return;
    }

    // Use user from useAuth hook, with fallback to auth.currentUser
    const currentUser = user || auth.currentUser;
    if (!currentUser) {
      console.error("Cannot share: user not authenticated");
      alert("Please sign in to share presentations.");
      return;
    }

    try {
      // Save with isShared=true to make it appear in team dashboard
      await handleSaveSlide(true);

      // Redirect to dashboard to see the shared presentation
      router.push("/dashboard");
    } catch (error) {
      console.error("Failed to share presentation:", error);
      alert("Failed to share presentation. Please try again.");
    }
  };

  const applyStatusUpdate = async (nextStatus: "draft" | "final", message: string) => {
    if (!presentationId) return;
    
    // Update Firestore
    try {
      const presentationRef = doc(db, "presentations", presentationId);
      await setDoc(
        presentationRef,
        {
          status: nextStatus,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Failed to update status in Firestore:", error);
    }
    
    // Update localStorage meta for backward compatibility
    updatePresentationStatus(presentationId, nextStatus);
    setStatus(nextStatus);
    setStatusMessage(message);
    setStatusToastVariant(nextStatus);
  };

  const markAsDraft = () => {
    applyStatusUpdate("draft", "Status: Draft");
  };

  const markAsFinal = () => {
    applyStatusUpdate("final", "Status: Finalized");
  };

  const handleDeleteSlide = async () => {
    if (!canDeleteSlide) {
      console.warn("At least one slide must remain in the presentation.");
      return;
    }

    if (!presentationId) {
    setSlides((prev) => {
      const index = prev.findIndex((slide) => slide.id === selectedSlideId);
      if (index === -1) {
        return prev;
      }
      const nextSlides = prev.filter((slide) => slide.id !== selectedSlideId);
      const nextIndex = Math.max(0, Math.min(index, nextSlides.length - 1));
      const nextSlide = nextSlides[nextIndex];
      if (nextSlide) {
        setSelectedSlideId(nextSlide.id);
      }
      return nextSlides;
    });
      return;
    }

    if (slides.length <= 1) {
      console.warn("At least one slide must remain in the presentation.");
      return;
    }

    const currentIndex = slides.findIndex((slide) => slide.id === selectedSlideId);
    if (currentIndex === -1) {
      return;
    }

    const previousSlide = slides[currentIndex - 1];
    const nextSlideCandidate = slides[currentIndex + 1];
    const nextSlide = previousSlide ?? nextSlideCandidate;

    if (!nextSlide) {
      console.warn("Unable to determine the next slide after deletion.");
      return;
    }

    const slideIdToDelete = slides[currentIndex].id;

    try {
      const slideRef = doc(db, "presentations", presentationId, "slides", slideIdToDelete);
      await deleteDoc(slideRef);
      const currentUser = auth.currentUser;
      await logAuditEvent({
        presentationId,
        userId: currentUser?.uid ?? null,
        userEmail: currentUser?.email ?? null,
        action: "DELETE_SLIDE",
        details: { slideId: slideIdToDelete },
      });
    } catch (error) {
      console.error("Failed to delete slide from Firestore:", error);
      return;
    }

    setSlides((prev) => prev.filter((slide) => slide.id !== slideIdToDelete));
    setSelectedSlideId(nextSlide.id);
    // URL will be updated by the useEffect that watches selectedSlideId
  };

  const moveSlide = async (direction: "up" | "down") => {
    // Read content directly from refs to ensure we have the latest data
    // Clean the HTML content similar to how syncActiveFieldContent does it
    const getRefContent = (ref: HTMLDivElement | null, fallback: string) => {
      if (!ref) return fallback;
      const html = ref.innerHTML;
      const cleaned = html
        .replace(/<br\s*\/?>/gi, "")
        .replace(/&nbsp;/gi, " ")
        .trim();
      return cleaned ? html : fallback;
    };

    // Get current slide data for fallback
    const currentSlide = slides.find((slide) => slide.id === selectedSlideId);
    const currentTitle = getRefContent(titleRef.current, currentSlide?.title || "");
    const currentSubtitle = getRefContent(subtitleRef.current, currentSlide?.subtitle || "");
    const currentNotes = notesRef.current?.value || currentSlide?.notes || "";

    // Use a functional update to get the latest state and update in one go
    let updatedSlides: SlideData[] = [];
    let oldIndex = 0;
    let newIndex = 0;
    
    setSlides((currentSlides) => {
      // Find the index in the current slides array
      const index = currentSlides.findIndex((slide) => slide.id === selectedSlideId);
      if (index === -1) return currentSlides;
      
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= currentSlides.length) return currentSlides;

      // Store indices for audit log
      oldIndex = index + 1;
      newIndex = targetIndex + 1;

      // First, update the selected slide with content from refs
      const slidesWithUpdatedContent = currentSlides.map((slide) => {
        if (slide.id === selectedSlideId) {
          return {
            ...slide,
            title: currentTitle || slide.title || "",
            subtitle: currentSubtitle || slide.subtitle || "",
            notes: currentNotes || slide.notes || "",
          };
        }
        return slide;
      });

      // Now reorder the slides
      const nextSlides = [...slidesWithUpdatedContent];
      const [moving] = nextSlides.splice(index, 1);
      nextSlides.splice(targetIndex, 0, moving);

      // Update order field for all slides to match their new positions
      updatedSlides = nextSlides.map((slide, idx) => ({
        ...slide,
        order: idx + 1,
      }));

      return updatedSlides;
    });

    // Save updated order to Firestore if we have a presentationId
    if (presentationId && updatedSlides.length > 0) {
      try {
        // Update all affected slides in parallel
        const updatePromises = updatedSlides.map((slide: SlideData) => {
          const slideRef = doc(db, "presentations", presentationId, "slides", slide.id);
          return setDoc(
            slideRef,
            { order: slide.order, updatedAt: serverTimestamp() },
            { merge: true }
          );
        });
        await Promise.all(updatePromises);

        // Log audit event
        const currentUser = auth.currentUser;
        if (currentUser) {
          await logAuditEvent({
            presentationId,
            userId: currentUser.uid,
            userEmail: currentUser.email,
            action: "REORDER_SLIDE",
            details: {
              slideId: selectedSlideId,
              direction,
              oldIndex,
              newIndex,
            },
          });
        }
      } catch (error) {
        console.error("Failed to update slide order in Firestore:", error);
        // Revert to original order on error
        setSlides(slides);
      }
    }
  };

  const handleMoveUp = async () => {
    if (isFirstSlide) return;
    await moveSlide("up");
  };

  const handleMoveDown = async () => {
    if (isLastSlide) return;
    await moveSlide("down");
  };

  const handleCommentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newComment.trim();
    if (!trimmed) return;

    if (!presentationId) {
    const now = new Date();
    setComments((prev) => [
      {
        id: `comment-${Date.now()}`,
        author: "You",
        message: trimmed,
        timestamp: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
      ...prev,
    ]);
    setNewComment("");
      return;
    }

    const currentUser = auth.currentUser;
    const storedUser = storedUserRecord;
    const userId =
      currentUser?.uid ??
      (typeof storedUser?.uid === "string" ? storedUser.uid : undefined) ??
      (typeof storedUser?.id === "string" ? storedUser.id : undefined);
    // Fetch displayName from Firestore
    let userName = currentUser?.displayName || currentUser?.email || "User";
    try {
      if (userId) {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();
        if (userData?.displayName) {
          userName = userData.displayName;
        } else if (userData?.email) {
          userName = userData.email;
        } else if (currentUser?.email) {
          userName = currentUser.email;
        }
      }
    } catch (err) {
      console.warn("Failed to fetch user displayName for comment:", err);
      userName = currentUser?.email || (typeof storedUser?.email === "string" ? storedUser.email : undefined) || "User";
    }

    if (!userId) {
      router.push("/login");
      return;
    }

    try {
      // Save comments as plain text (no encryption needed for comments)
      const commentRef = await addDoc(collection(db, "presentations", presentationId, "comments"), {
        userId,
        userName,
        text: trimmed, // Save as plain text
        createdAt: serverTimestamp(),
      });
      setNewComment("");

      await logAuditEvent({
        presentationId,
        userId,
        userEmail: currentUser?.email ?? null,
        action: "ADD_COMMENT",
        details: { commentId: commentRef.id },
      });
    } catch (error) {
      console.error("Failed to add comment to Firestore:", error);
    }
  };

  const handleAddCollaborator = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!presentationId) return;
    const rawValue = newCollaboratorValue.trim();
    if (!rawValue) {
      setTeamModalError("Enter a collaborator email or ID.");
      return;
    }
    const normalizedValue = rawValue.includes("@") ? rawValue.toLowerCase() : rawValue;
    if (
      (presentationOwnerId && presentationOwnerId.toLowerCase() === normalizedValue.toLowerCase()) ||
      collaboratorsLowerSet.has(normalizedValue.toLowerCase())
    ) {
      setTeamModalError("This member is already on the team.");
      return;
    }
      const nextCollaborators = [...collaborators, normalizedValue];
      try {
        setIsUpdatingTeam(true);
        // Update teamRoles to set new member as "editor"
        // Ensure owner is included in teamRoles (by both ID and email if available)
        const updatedRoles: Record<string, "owner" | "editor" | "viewer"> = { ...teamRoles, [normalizedValue]: "editor" };
        if (presentationOwnerId) {
          const ownerKey = presentationOwnerId.toLowerCase();
          updatedRoles[ownerKey] = "owner";
          // Also store by owner email if we have it
          if (ownerDisplayName && ownerDisplayName.includes("@")) {
            updatedRoles[ownerDisplayName.toLowerCase()] = "owner";
          }
        }
        await setDoc(
          doc(db, "presentations", presentationId),
          {
            collaboratorIds: nextCollaborators,
            teamRoles: updatedRoles,
          },
          { merge: true }
        );
        setTeamRoles(updatedRoles);
      setPresentationCollaboratorIds(nextCollaborators);
      // Fetch displayName for the newly added collaborator
      try {
        const collabRef = doc(db, "users", normalizedValue);
        const collabSnap = await getDoc(collabRef);
        if (collabSnap.exists()) {
          const collabData = collabSnap.data();
          setCollaboratorDisplayNames((prev) => ({
            ...prev,
            [normalizedValue]: collabData?.displayName || collabData?.email || normalizedValue,
          }));
        } else {
          // If not found in users collection, treat as email/ID string
          setCollaboratorDisplayNames((prev) => ({
            ...prev,
            [normalizedValue]: normalizedValue,
          }));
        }
      } catch (err) {
        console.warn(`Failed to fetch displayName for ${normalizedValue}:`, err);
        setCollaboratorDisplayNames((prev) => ({
          ...prev,
          [normalizedValue]: normalizedValue,
        }));
      }
      setNewCollaboratorValue("");
      setTeamModalError(null);
    } catch (error) {
      console.error("Failed to add collaborator:", error);
      setTeamModalError("Unable to add collaborator. Try again.");
    } finally {
      setIsUpdatingTeam(false);
    }
  };

  const handleUpdateRole = async (member: string, newRole: "editor" | "viewer") => {
    if (!presentationId) return;
    try {
      // Ensure owner is included in teamRoles (by both ID and email if available)
      const updatedRoles: Record<string, "owner" | "editor" | "viewer"> = { ...teamRoles, [member]: newRole };
      if (presentationOwnerId) {
        const ownerKey = presentationOwnerId.toLowerCase();
        updatedRoles[ownerKey] = "owner";
        // Also store by owner email if we have it
        if (ownerDisplayName && ownerDisplayName.includes("@")) {
          updatedRoles[ownerDisplayName.toLowerCase()] = "owner";
        }
      }
      await setDoc(
        doc(db, "presentations", presentationId),
        {
          teamRoles: updatedRoles,
        },
        { merge: true }
      );
      setTeamRoles(updatedRoles);
    } catch (error) {
      console.error("Failed to update role:", error);
      setTeamModalError("Unable to update role. Try again.");
    }
  };

  const handleRemoveCollaborator = async (member: string) => {
    if (!presentationId) return;
      const nextCollaborators = collaborators.filter((value) => value !== member);
      try {
        setIsUpdatingTeam(true);
        // Remove from teamRoles
        const updatedRoles: Record<string, "owner" | "editor" | "viewer"> = { ...teamRoles };
        delete updatedRoles[member];
        // Ensure owner is included in teamRoles (by both ID and email if available)
        if (presentationOwnerId) {
          const ownerKey = presentationOwnerId.toLowerCase();
          updatedRoles[ownerKey] = "owner";
          // Also store by owner email if we have it
          if (ownerDisplayName && ownerDisplayName.includes("@")) {
            updatedRoles[ownerDisplayName.toLowerCase()] = "owner";
          }
        }
        await setDoc(
          doc(db, "presentations", presentationId),
          {
            collaboratorIds: nextCollaborators,
            teamRoles: updatedRoles,
          },
          { merge: true }
        );
        setPresentationCollaboratorIds(nextCollaborators);
        setTeamRoles(updatedRoles);
      // Remove displayName from state
      setCollaboratorDisplayNames((prev) => {
        const updated = { ...prev };
        delete updated[member];
        return updated;
      });
      setTeamModalError(null);
    } catch (error) {
      console.error("Failed to remove collaborator:", error);
      setTeamModalError("Unable to remove collaborator. Try again.");
    } finally {
      setIsUpdatingTeam(false);
    }
  };

  const handleSaveVersion = useCallback(
    async (summary?: string) => {
      if (isSavingVersion) return;
      if (!presentationId) return;

      const currentUser = auth.currentUser;
      const storedUser = storedUserRecord;
      const userId =
        currentUser?.uid ??
        (typeof storedUser?.uid === "string" ? storedUser.uid : undefined) ??
        (typeof storedUser?.id === "string" ? storedUser.id : undefined);

      if (!userId) {
        router.push("/login");
        return;
      }

      const slidesSnapshot: VersionSnapshotSlide[] = slides.map((slide, index) => ({
        slideId: slide.id,
        order: slide.order ?? index + 1,
        title: typeof slide.title === "string" ? slide.title : "",
        encryptedContent: encryptText(typeof slide.subtitle === "string" ? slide.subtitle : ""),
        encryptedNotes: encryptText(typeof slide.notes === "string" ? slide.notes : ""),
        theme: slide.theme || "default",
        slideType: slide.slideType || "content",
      }));

      try {
        setIsSavingVersion(true);
        const versionRef = await addDoc(collection(db, "presentations", presentationId, "versions"), {
          createdAt: serverTimestamp(),
          createdBy: userId,
          summary: summary && summary.trim().length > 0 ? summary.trim() : "",
          slidesSnapshot,
        });

        await logAuditEvent({
          presentationId,
          userId,
          userEmail: currentUser?.email ?? null,
          action: "SAVE_VERSION",
          details: {
            versionId: versionRef.id,
            slideCount: slidesSnapshot.length,
          },
        });
      } catch (error) {
        console.error("Failed to save presentation version:", error);
      } finally {
        setIsSavingVersion(false);
      }
    },
    [isSavingVersion, presentationId, slides, user, router]
  );

  const handleRestoreVersion = useCallback(
    async (versionId: string) => {
      if (isRestoringVersion) return;
      if (!presentationId) return;

      const versionRecord = versions.find((record) => record.id === versionId);
      if (!versionRecord) return;

      const orderedSnapshot = versionRecord.slidesSnapshot
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      if (orderedSnapshot.length === 0) {
        console.warn("Version snapshot is empty; nothing to restore.");
        return;
      }

      const firstSlideId = orderedSnapshot[0]?.slideId;

      try {
        setIsRestoringVersion(true);

        await Promise.all(
          orderedSnapshot.map((snapshot) => {
            const slideRef = doc(db, "presentations", presentationId, "slides", snapshot.slideId);
            return setDoc(
              slideRef,
              {
                order: snapshot.order,
                title: snapshot.title,
                content: snapshot.encryptedContent,
                notes: snapshot.encryptedNotes,
                theme: snapshot.theme || "default",
                slideType: snapshot.slideType,
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          })
        );

        const snapshotIds = new Set(orderedSnapshot.map((item) => item.slideId));
        const slidesToDelete = slides.filter((slide) => !snapshotIds.has(slide.id));
        await Promise.all(
          slidesToDelete.map((slide) =>
            deleteDoc(doc(db, "presentations", presentationId, "slides", slide.id))
          )
        );

        const presentationRef = doc(db, "presentations", presentationId);
        await setDoc(
          presentationRef,
          {
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        if (firstSlideId) {
          setSelectedSlideId(firstSlideId);
          // URL will be updated by the useEffect that watches selectedSlideId
        }

        setHasLoadedFromFirestore(false);
        await loadFromFirestore({ force: true, selectSlideId: firstSlideId });
        if (firstSlideId) {
          setSelectedSlideId(firstSlideId);
        }

        await logAuditEvent({
          presentationId,
          userId: auth.currentUser?.uid ?? null,
          userEmail: auth.currentUser?.email ?? null,
          action: "RESTORE_VERSION",
          details: {
            versionId,
            restoredSlideCount: orderedSnapshot.length,
          },
        });
      } catch (error) {
        console.error("Failed to restore version:", error);
      } finally {
        setIsRestoringVersion(false);
      }
    },
    [isRestoringVersion, presentationId, versions, slides, router, loadFromFirestore]
  );

  // Memoize versions length to avoid dependency on entire array
  const versionsLength = versions.length;
  
  useEffect(() => {
    if (typeof window === "undefined") return;

    const extendedWindow = window as typeof window & {
      __editorVersions?: {
        saveVersion: (summary?: string) => Promise<void>;
        restoreVersion: (versionId: string) => Promise<void>;
        getVersions: () => PresentationVersion[];
        isSavingVersion: boolean;
        isRestoringVersion: boolean;
      };
    };

    extendedWindow.__editorVersions = {
      saveVersion: handleSaveVersion,
      restoreVersion: handleRestoreVersion,
      getVersions: () => versions,
      isSavingVersion,
      isRestoringVersion,
    };

    return () => {
      delete extendedWindow.__editorVersions;
    };
  }, [handleSaveVersion, handleRestoreVersion, versionsLength, isSavingVersion, isRestoringVersion]);

  // Allow toolbar buttons to work even when no slide is selected (for Theme, AI Assistant, etc.)
  // Only disable editing-specific buttons when no slide is selected or status is final
  const toolbarDisabled = (selectedSlide == null && slides.length > 0) || status === "final";

  const highlightIndicatorStyle: CSSProperties =
    commandState.highlight === "transparent"
      ? {}
      : { backgroundColor: commandState.highlight };

  const toolbarActions: Record<string, () => void> = {
    Undo: applyUndo,
    Redo: applyRedo,
      Image: () => {
      // Reset image file and preview when opening modal
      setImageFile(null);
      setImagePreview(selectedSlide?.imageUrl || "");
      setIsImageModalOpen(true);
    },
    Background: () => {
      setIsBackgroundModalOpen(true);
    },
    Layout: () => {
      setIsLayoutModalOpen(true);
    },
    Theme: () => {
      toggleThemePicker();
    },
    "AI Assistant": () => setShowAssistant((prev) => !prev),
  };

  const currentFormatting = selectedSlide ? ensureFormatting(selectedSlide.formatting) : DEFAULT_FORMATTING;

  const isAITemplate = selectedSlide?.templateId === "ai-modern";
  const aiStyles = isAITemplate ? getAITemplateStyles() : null;

  const getTextStyle = (field: FieldKey): CSSProperties => {
    const baseStyle: CSSProperties = {
    lineHeight: `${currentFormatting[field]?.lineHeight ?? DEFAULT_FORMATTING[field].lineHeight}`,
    whiteSpace: "pre-wrap",
    fontFamily: "Inter, Calibri, Arial, sans-serif",
    };

    // For SCDT theme: use theme colors
    const textColor = field === "title" ? activeThemeObj.titleColor : activeThemeObj.bulletColor;

    // Apply theme styles
    if (field === "title") {
      return {
        ...baseStyle,
        fontSize: activeThemeObj.titleFontSize,
        fontWeight: activeThemeObj.titleFontWeight,
        color: textColor,
        lineHeight: activeThemeObj.titleLineHeight,
        textAlign: "center" as const,
        marginBottom: "clamp(16px, 2vw, 24px)",
      };
    } else if (field === "subtitle") {
      return {
        ...baseStyle,
        fontSize: activeThemeObj.bulletFontSize,
        fontWeight: activeThemeObj.bulletFontWeight,
        color: textColor,
        lineHeight: activeThemeObj.bulletLineHeight,
        textAlign: "center" as const,
        marginBottom: "clamp(24px, 3vw, 40px)",
      };
    }

    return baseStyle;
  };

  const handleOpenSlideshow = () => {
    if (!presentationId) {
      console.warn("Cannot open slideshow: no presentationId");
      return;
    }
    
    // Find the currently selected slide
    const currentSlide = slides.find((slide) => slide.id === selectedSlideId);
    const slideId = currentSlide?.id || (slides.length > 0 ? slides[0].id : null);
    
    // Prepare slides data for viewer (include image data)
    const viewerSlides = slides.map((slide) => ({
      id: slide.id,
      title: typeof slide.title === "string" ? slide.title : "Untitled slide",
      subtitle: typeof slide.subtitle === "string" ? slide.subtitle : "",
      notes: typeof slide.notes === "string" ? slide.notes : "",
      presentationId: presentationId,
      imageUrl: slide.imageUrl,
      imageX: slide.imageX,
      imageY: slide.imageY,
      imageWidth: slide.imageWidth,
      imageHeight: slide.imageHeight,
    }));

    // Store viewer state in sessionStorage
    if (typeof window !== "undefined") {
      const viewerState = {
        presentationId: presentationId,
        slideId: slideId,
        presentationTitle: presentationTitle,
        presentationBackground: presentationBackground,
        slides: viewerSlides,
      };
      window.sessionStorage.setItem(VIEWER_STATE_KEY, JSON.stringify(viewerState));
      window.sessionStorage.setItem(VIEWER_RETURN_KEY, `${window.location.pathname}${window.location.search}`);
    }
    
    // Navigate to viewer with presentationId and slideId
    const viewerUrl = slideId 
      ? `/viewer?presentationId=${encodeURIComponent(presentationId)}&slideId=${encodeURIComponent(slideId)}`
      : `/viewer?presentationId=${encodeURIComponent(presentationId)}`;
    router.push(viewerUrl);
  };

  const toggleColorPicker = () => setIsColorPickerOpen((prev) => !prev);
  const toggleHighlightPicker = () => setIsHighlightPickerOpen((prev) => !prev);
  const toggleThemePicker = () => setIsThemePickerOpen((prev) => !prev);
  const currentLineHeight =
    currentFormatting[activeField]?.lineHeight ?? DEFAULT_FORMATTING[activeField]?.lineHeight ?? 1.2;

  const isReadOnly = status === "final";

  // Define image handlers after isReadOnly is available
  const handleImageMouseDownCallback = useCallback((e: React.MouseEvent, slideContainer: HTMLElement) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.stopPropagation();
    
    const rect = slideContainer.getBoundingClientRect();
    const currentX = selectedSlide?.imageX ?? 50;
    const currentY = selectedSlide?.imageY ?? 50;
    
    // Calculate initial mouse position relative to container
    const startMouseX = e.clientX - rect.left;
    const startMouseY = e.clientY - rect.top;
    
    // Calculate initial image center position in pixels
    const startImageCenterX = (currentX / 100) * rect.width;
    const startImageCenterY = (currentY / 100) * rect.height;
    
    // Calculate offset from image center to mouse position
    const offsetX = startMouseX - startImageCenterX;
    const offsetY = startMouseY - startImageCenterY;
    
    setDragStart({ x: offsetX, y: offsetY });
    setIsDraggingImage(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Calculate new mouse position relative to container
      const newMouseX = moveEvent.clientX - rect.left;
      const newMouseY = moveEvent.clientY - rect.top;
      
      // Calculate new image center position (mouse position minus offset)
      const newImageCenterX = newMouseX - offsetX;
      const newImageCenterY = newMouseY - offsetY;
      
      // Convert to percentage
      const newX = (newImageCenterX / rect.width) * 100;
      const newY = (newImageCenterY / rect.height) * 100;
      
      // Get current image size to constrain properly
      const imageWidth = selectedSlide?.imageWidth ?? 30;
      const imageHeight = selectedSlide?.imageHeight ?? 30;
      
      // Constrain to slide bounds - account for image size
      // Image center can't be closer than half the image size from edges
      const minX = (imageWidth / 2);
      const maxX = 100 - (imageWidth / 2);
      const minY = (imageHeight / 2);
      const maxY = 100 - (imageHeight / 2);
      
      const constrainedX = Math.max(minX, Math.min(maxX, newX));
      const constrainedY = Math.max(minY, Math.min(maxY, newY));
      
      updateImagePosition(constrainedX, constrainedY);
    };

    const handleMouseUp = () => {
      setIsDraggingImage(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // Save to Firestore
      if (presentationId && selectedSlideId) {
        const slide = slides.find(s => s.id === selectedSlideId);
        if (slide) {
          const slideRef = doc(db, "presentations", presentationId, "slides", selectedSlideId);
          setDoc(
            slideRef,
            { 
              imageX: slide.imageX ?? 50,
              imageY: slide.imageY ?? 50,
              updatedAt: serverTimestamp() 
            },
            { merge: true }
          ).catch(console.error);
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [selectedSlide, isReadOnly, presentationId, selectedSlideId, slides, updateImagePosition]);

  const handleImageResizeMouseDownCallback = useCallback((e: React.MouseEvent, slideContainer: HTMLElement) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.stopPropagation();
    
    const rect = slideContainer.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    
    const currentWidth = selectedSlide?.imageWidth ?? 30;
    const currentHeight = selectedSlide?.imageHeight ?? 30;
    const currentX = selectedSlide?.imageX ?? 50;
    const currentY = selectedSlide?.imageY ?? 50;
    
    setResizeStart({ x: startX, y: startY, width: currentWidth, height: currentHeight });
    setIsResizingImage(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = ((moveEvent.clientX - startX) / rect.width) * 100;
      const deltaY = ((moveEvent.clientY - startY) / rect.height) * 100;
      
      const newWidth = Math.max(10, Math.min(80, currentWidth + deltaX));
      const newHeight = Math.max(10, Math.min(80, currentHeight + deltaY));
      
      updateImageSize(newWidth, newHeight);
    };

    const handleMouseUp = () => {
      setIsResizingImage(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // Save to Firestore
      if (presentationId && selectedSlideId) {
        const slide = slides.find(s => s.id === selectedSlideId);
        if (slide) {
          const slideRef = doc(db, "presentations", presentationId, "slides", selectedSlideId);
          setDoc(
            slideRef,
            { 
              imageWidth: slide.imageWidth ?? 30,
              imageHeight: slide.imageHeight ?? 30,
              updatedAt: serverTimestamp() 
            },
            { merge: true }
          ).catch(console.error);
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [selectedSlide, isReadOnly, presentationId, selectedSlideId, slides, updateImageSize]);

  // Update refs when callbacks change
  useEffect(() => {
    handleImageMouseDownRef.current = handleImageMouseDownCallback;
  }, [handleImageMouseDownCallback]);

  useEffect(() => {
    handleImageResizeMouseDownRef.current = handleImageResizeMouseDownCallback;
  }, [handleImageResizeMouseDownCallback]);

  // Delete image handler
  const handleDeleteImage = useCallback(async () => {
    if (!selectedSlideId || isReadOnly) return;
    
    setSlides((prev) =>
      prev.map((slide) =>
        slide.id === selectedSlideId
          ? { ...slide, imageUrl: undefined, imageX: undefined, imageY: undefined, imageWidth: undefined, imageHeight: undefined }
          : slide
      )
    );

    if (presentationId) {
      const slideRef = doc(db, "presentations", presentationId, "slides", selectedSlideId);
      await setDoc(
        slideRef,
        { 
          imageUrl: null,
          imageX: null,
          imageY: null,
          imageWidth: null,
          imageHeight: null,
          updatedAt: serverTimestamp() 
        },
        { merge: true }
      );
    }
  }, [selectedSlideId, isReadOnly, presentationId]);

  const resolvedUserId = firebaseUserId ?? (typeof storedUserRecord?.uid === "string" ? storedUserRecord.uid : null);
  const resolvedUserEmail =
    firebaseUserEmail ?? (typeof storedUserRecord?.email === "string" ? storedUserRecord.email : null);
  const collaborators = useMemo(
    () => (Array.isArray(presentationCollaboratorIds) ? presentationCollaboratorIds : []),
    [presentationCollaboratorIds]
  );
  const collaboratorsLowerSet = useMemo(
    () => new Set(collaborators.map((value) => (typeof value === "string" ? value.toLowerCase() : value))),
    [collaborators]
  );
  const canChat = useMemo(() => {
    if (!presentationId) return false;
    
    // Check teamRoles first (primary source of truth)
    if (resolvedUserEmail) {
      const emailLower = resolvedUserEmail.toLowerCase();
      if (teamRoles[emailLower] === "owner" || teamRoles[emailLower] === "editor" || teamRoles[emailLower] === "viewer") {
        return true;
      }
    }
    if (resolvedUserId) {
      const userIdLower = resolvedUserId.toLowerCase();
      if (teamRoles[userIdLower] === "owner" || teamRoles[userIdLower] === "editor" || teamRoles[userIdLower] === "viewer") {
        return true;
      }
    }
    
    // Fallback to legacy checks for backward compatibility
    if (presentationOwnerId && resolvedUserId && resolvedUserId === presentationOwnerId) return true;
    if (resolvedUserId && (collaborators.includes(resolvedUserId) || collaboratorsLowerSet.has(resolvedUserId.toLowerCase()))) {
      return true;
    }
    if (resolvedUserEmail) {
      const emailLower = resolvedUserEmail.toLowerCase();
      if (collaborators.includes(resolvedUserEmail) || collaboratorsLowerSet.has(emailLower)) {
        return true;
      }
    }
    return false;
  }, [presentationId, presentationOwnerId, resolvedUserId, resolvedUserEmail, collaborators, collaboratorsLowerSet, teamRoles]);
  const isOwner = Boolean(presentationOwnerId && resolvedUserId && resolvedUserId === presentationOwnerId);

  return (
    <div data-theme={isDark ? "dark" : "light"}>
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
          <button
            type="button"
            aria-label="Toggle dark mode"
            onClick={toggleTheme}
            className={styles.themeToggle}
          >
            {!mounted ? (
              // Render moon icon during SSR to avoid hydration mismatch
              <svg
                className={`${styles.icon} ${styles.iconSpin}`}
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  fill="none"
                />
              </svg>
            ) : isDark ? (
              <svg
                className={`${styles.icon} ${styles.iconSpin}`}
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg
                className={`${styles.icon} ${styles.iconSpin}`}
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  fill="none"
                />
              </svg>
            )}
          </button>
          {!loading && !user ? (
            <button className={styles.primary} type="button" onClick={() => router.push("/login")}>
            Sign in
            </button>
          ) : null}
          {!loading && user ? (
            <>
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
                className={styles.secondary}
                type="button"
                onClick={async () => {
                  await signOut(auth);
                  router.push("/login");
                }}
              >
                Sign out
              </button>
            </>
          ) : null}
        </div>
      </nav>
      {isLoadingSlides && (
        <div className={styles.loadingOverlay}>
          Loading presentation...
        </div>
      )}

      {!isLoadingSlides && slides.length === 0 && presentationId && hasLoadedFromFirestore && (
        <div className={styles.loadingOverlay}>
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <p>No slides found. Creating a new slide...</p>
          </div>
        </div>
      )}

      <main className={styles.main}>
        <div className={styles.container} style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
          <div className={styles.editorShell} style={{ flex: "1 1 auto", minWidth: 0 }}>
            <header className={styles.editorHeader}>
              <div className={styles.headerRow}>
                <div className={styles.editorTitleBlock}>
                  <div className={styles.miniLogo}>AD</div>
                  <div className={styles.titleInputs}>
                    <div className={styles.titleLine}>
                      <input
                        className={styles.titleInput}
                        type="text"
                        value={presentationTitle}
                        onChange={(event) => setPresentationTitle(event.target.value)}
                        onBlur={() => {
                          // Auto-save title when user finishes editing
                          if (presentationId) {
                            const presentationRef = doc(db, "presentations", presentationId);
                            setDoc(presentationRef, { title: presentationTitle, updatedAt: serverTimestamp() }, { merge: true }).catch(console.error);
                          }
                        }}
                        placeholder="Enter presentation title"
                        aria-label="Presentation title"
                        disabled={isReadOnly}
                      />
                      <span
                        className={`${styles.statusBadge} ${
                          status === "final" ? styles.statusFinal : styles.statusDraft
                        }`}
                      >
                        {status === "final" ? "Final" : "Draft"}
                      </span>
                      <div className={styles.statusActions}>
                        <button
                          type="button"
                          className={styles.statusToggle}
                          onClick={markAsDraft}
                          disabled={status === "draft"}
                        >
                          Draft
                        </button>
                        <button
                          type="button"
                          className={`${styles.statusToggle} ${styles.statusTogglePrimary}`}
                          onClick={markAsFinal}
                          disabled={status === "final"}
                        >
                          Mark as Final
                      </button>
                      </div>
                    </div>
                    <span className={styles.productName}>Secure Presentation Tool</span>
                  </div>
                </div>

                {statusMessage ? (
                  <div
                    className={`${styles.statusToast} ${
                      statusToastVariant === "final"
                        ? styles.statusToastFinal
                        : styles.statusToastDraft
                    }`}
                  >
                    {statusToastVariant === "final" ? "🟢" : "🟡"} {statusMessage}
                  </div>
                ) : null}

                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.slideshowButton}
                    onClick={() => {
                      router.push("/presentations");
                    }}
                  >
                    Slides Home
                  </button>
                  {isOwner ? (
                    <button
                      type="button"
                      className={styles.slideshowButton}
                      onClick={() => {
                        setTeamModalError(null);
                        setNewCollaboratorValue("");
                        setIsTeamModalOpen(true);
                      }}
                    >
                      Manage Team
                    </button>
                  ) : null}
                </div>
              </div>
            </header>

            <div className={styles.workspaceFrame}>
              <header className={styles.workspaceToolbar}>
                <EditorToolbar
                  fontFamilies={fontFamilies}
                  fontSizes={fontSizes}
                  lineSpacingOptions={lineSpacingOptions}
                  formattingButtons={formattingButtons}
                  toolbarActions={toolbarActions}
                  toolbarDisabled={toolbarDisabled}
                  commandState={commandState}
                  highlightIndicatorStyle={highlightIndicatorStyle}
                  colorOptions={colorOptions}
                  highlightOptions={highlightOptions}
                  isColorPickerOpen={isColorPickerOpen}
                  isHighlightPickerOpen={isHighlightPickerOpen}
                  isThemePickerOpen={isThemePickerOpen}
                  onToggleColorPicker={toggleColorPicker}
                  onToggleHighlightPicker={toggleHighlightPicker}
                  onToggleThemePicker={toggleThemePicker}
                  colorButtonRef={colorButtonRef}
                  highlightButtonRef={highlightButtonRef}
                  themeButtonRef={themeButtonRef}
                  onFontFamilyChange={applyFontFamily}
                  onFontSizeChange={applyFontSize}
                  onBold={handleToggleBold}
                  onItalic={handleToggleItalic}
                  onUnderline={handleToggleUnderline}
                  onTextColorSelect={applyTextColor}
                  onHighlightColorSelect={applyHighlightColor}
                  onAlign={(align) => handleSetAlign(align)}
                  onList={(type) => handleSetListType(type === "bullet" ? "bullets" : "numbers")}
                  currentFormatting={selectedSlide ? ensureFormatting(selectedSlide.formatting) : undefined}
                  onLineHeightChange={applyLineHeight}
                  onUndo={applyUndo}
                  onRedo={applyRedo}
                  onToolbarMouseDown={handleToolbarMouseDown}
                  onRestoreSelection={restoreSelection}
                  lineHeightValue={currentLineHeight}
                  themes={themes}
                  selectedTheme={effectiveThemeName}
                  onThemeSelect={handleThemeSelect}
                  isSCDT={isSCDT}
                  slideType={slideType}
                  onSlideTypeSelect={handleSlideTypeSelect}
                  isAIAssistantOpen={showAssistant}
                  onCloseAIAssistant={() => setShowAssistant(false)}
                  assistantPresentationContext={assistantPresentationContext || undefined}
                  assistantCurrentSlide={assistantCurrentSlide || undefined}
                  assistantAllSlides={assistantAllSlides || undefined}
                  onApplyToSlide={(data) => {
                    if (!selectedSlide) return;
                    if (data.content !== undefined) {
                      updateSlideField("subtitle", data.content);
                      updateSlideField("content", data.content);
                    }
                    if (data.notes !== undefined) {
                      updateSlideField("notes", data.notes);
                    }
                  }}
                />
              </header>

              <div className={styles.workspaceBody}>
                <aside className={styles.slideRail}>
                  <div className={styles.slideRailList}>
                    {slides.map((slide, index) => {
                      const isActive = slide.id === selectedSlideId;
                      return (
                        <button
                          type="button"
                          key={slide.id}
                          className={cx(
                            styles.slideRailItem,
                            isActive ? styles.slideRailItemActive : styles.slideRailItemInactive
                          )}
                          onClick={() => {
                            setSelectedSlideId(slide.id);
                          }}
                        >
                          <span
                            className={cx(
                              styles.slideRailIndex,
                              isActive ? styles.slideRailIndexActive : styles.slideRailIndexInactive
                            )}
                          >
                            {index + 1}
                          </span>
                          <div className={styles.slideRailThumbnail} />
                        </button>
                      );
                    })}
                  </div>
                  <button type="button" className={styles.newSlideButton} onClick={handleAddSlide}>
                    + New slide
                  </button>
                </aside>

                <section className={styles.canvasRegion}>
                  <div className={styles.canvasShell}>
                    <div 
                      key={`slide-${selectedSlideId}-theme-${effectiveThemeName}-${slideType}`}
                      className={cx(
                        styles.canvasSurface,
                        themeSlideClass && styles[themeSlideClass],
                        backgroundClass
                      )}
                      style={{
                        // Only apply theme background if no custom background is set
                        background: background === "default" && !isSCDT && !isDigitalSolutions && !isAramcoClassic ? activeThemeObj.slideBackground : undefined,
                        border: activeThemeObj.canvasBorder,
                        boxShadow: activeThemeObj.canvasShadow,
                        position: "relative",
                        overflow: "hidden",
                        ...(isSCDT || isDigitalSolutions || isAramcoClassic ? {} : {
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "flex-start",
                          padding: "clamp(48px, 5vw, 72px)",
                          gap: "clamp(16px, 2vw, 24px)",
                        }),
                      }}
                    >
                      {isSCDT && slideType === "cover" ? (
                        /* SCDT Cover Slide */
                        <div className={styles.scdtCoverLayout}>
                          {/* SCDT Logo in top left */}
                          <div className={styles.scdtCoverLogoTopLeft}>
                            <img 
                              src="/themes/scdt/scdt-logo.png" 
                              alt="SCDT Logo" 
                              className={styles.scdtCoverLogoImage}
                              onError={(e) => {
                                // Fallback if logo doesn't exist
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                            <div className={styles.scdtCoverLogoText}>SCDT</div>
                            <div className={styles.scdtCoverLogoTagline}>SUPPLY CHAIN DIGITAL TWIN</div>
                          </div>
                          
                          {/* Saudi Aramco Logo in top right */}
                          <div className={styles.themeLogoTopRight}>
                            <img src="/aramco-digital.png" alt="Saudi Aramco" />
                          </div>
                          
                          <div className={styles.scdtCoverTitleArea}>
                            <div
                              ref={titleRef}
                              className={styles.scdtCoverTitle}
                              contentEditable={!isReadOnly}
                              suppressContentEditableWarning
                              role="textbox"
                              aria-label="Slide title"
                              onInput={(e) => {
                                e.preventDefault();
                                handleContentInput("title");
                              }}
                              onFocus={() => handleContentFocus("title")}
                              onBlur={() => handleContentBlur("title")}
                              data-readonly={isReadOnly}
                            >
                              {selectedSlide?.title || "SCDT Phase 3"}
                            </div>
                            <div className={styles.scdtCoverTitleUnderline} />
                            <div
                              ref={subtitleRef}
                              className={styles.scdtCoverSubtitle}
                              contentEditable={!isReadOnly}
                              suppressContentEditableWarning
                              role="textbox"
                              aria-label="Slide subtitle"
                              onInput={(e) => {
                                e.preventDefault();
                                handleContentInput("subtitle");
                              }}
                              onFocus={() => handleContentFocus("subtitle")}
                              onBlur={() => handleContentBlur("subtitle")}
                              data-readonly={isReadOnly}
                            >
                              {selectedSlide?.subtitle || "Aramco Digital team setup and project management"}
                            </div>
                            <div className={styles.scdtCoverDate}>
                              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </div>
                          </div>
                          
                          {/* Tagline in bottom right */}
                          <div className={styles.scdtCoverTagline}>
                            where energy is opportunity
                          </div>
                        </div>
                      ) : isSCDT && slideType === "content" ? (
                        /* SCDT Content Slide */
                        <>
                          <div className={styles.scdtContentLeft}>
                            <div className={styles.scdtContentLeftTitleBox}>
                              <div
                                ref={titleRef}
                                className={styles.slideTitleInput}
                                contentEditable={!isReadOnly}
                                suppressContentEditableWarning
                                role="textbox"
                                aria-label="Slide title"
                                onInput={(e) => {
                                  e.preventDefault();
                                  handleContentInput("title");
                                }}
                                onFocus={() => handleContentFocus("title")}
                                onBlur={() => handleContentBlur("title")}
                                data-readonly={isReadOnly}
                              >
                                {selectedSlide?.title || "Click to add title"}
                              </div>
                            </div>
                            <div className={styles.scdtContentLeftPageNumber}>
                              {currentSlideIndex + 1}
                            </div>
                          </div>
                          <div className={styles.scdtContentRight}>
                            <div
                              ref={subtitleRef}
                              className={styles.slideSubtitleInput}
                              contentEditable={!isReadOnly}
                              suppressContentEditableWarning
                              role="textbox"
                              aria-label="Slide content"
                              onInput={(e) => {
                                e.preventDefault();
                                handleContentInput("subtitle");
                              }}
                              onFocus={() => handleContentFocus("subtitle")}
                              onBlur={() => handleContentBlur("subtitle")}
                              data-readonly={isReadOnly}
                            >
                              {selectedSlide?.subtitle || selectedSlide?.content || ""}
                            </div>
                          </div>
                        </>
                      ) : isSCDT && slideType === "ending" ? (
                        /* SCDT Ending Slide - Background image only, no text */
                        <div style={{ 
                          width: "100%", 
                          height: "100%",
                          position: "relative"
                        }}>
                          {/* Empty - only background image shows */}
                        </div>
                      ) : isDigitalSolutions && slideType === "cover" ? (
                        /* Digital Solutions Cover Slide */
                        <div className={styles.digitalSolutionsTitleLayout}>
                          {/* Logo in top right */}
                          <div className={styles.themeLogoTopRight}>
                            <img src="/aramco-digital.png" alt="Aramco Digital" />
                          </div>
                          
                          <div className={styles.digitalSolutionsTitleText}>
                            <div
                              ref={titleRef}
                              className={styles.digitalSolutionsMainTitle}
                              contentEditable={!isReadOnly}
                              suppressContentEditableWarning
                              role="textbox"
                              aria-label="Slide title"
                              onInput={(e) => {
                                e.preventDefault();
                                handleContentInput("title");
                              }}
                              onFocus={() => handleContentFocus("title")}
                              onBlur={() => handleContentBlur("title")}
                              data-readonly={isReadOnly}
                            >
                              {selectedSlide?.title || "ADOS"}
                            </div>
                            <div
                              ref={subtitleRef}
                              className={styles.digitalSolutionsSubtitle}
                              contentEditable={!isReadOnly}
                              suppressContentEditableWarning
                              role="textbox"
                              aria-label="Slide subtitle"
                              onInput={(e) => {
                                e.preventDefault();
                                handleContentInput("subtitle");
                              }}
                              onFocus={() => handleContentFocus("subtitle")}
                              onBlur={() => handleContentBlur("subtitle")}
                              data-readonly={isReadOnly}
                            >
                              {selectedSlide?.subtitle || "Project Status Update"}
                            </div>
                          </div>
                          <div className={styles.digitalSolutionsDateWrapper}>
                            <div className={styles.digitalSolutionsDate}>
                              {(() => {
                                const date = new Date();
                                const day = date.getDate();
                                const month = date.toLocaleDateString('en-US', { month: 'long' });
                                const year = date.getFullYear();
                                const suffix = day === 1 || day === 21 || day === 31 ? 'st' :
                                             day === 2 || day === 22 ? 'nd' :
                                             day === 3 || day === 23 ? 'rd' : 'th';
                                return `${month} ${day}${suffix}, ${year}`;
                              })()}
                            </div>
                          </div>
                          
                          {/* Footer text */}
                          <div className={styles.digitalSolutionsCoverFooter}>
                            Aramco Digital: General Use
                          </div>
                        </div>
                      ) : isDigitalSolutions && slideType === "content" ? (
                        /* Digital Solutions Content Slide */
                        <div className={styles.digitalSolutionsContentLayout}>
                          {/* Logo in top right */}
                          <div className={styles.themeLogoTopRight}>
                            <img src="/aramco-digital.png" alt="Aramco Digital" />
                          </div>
                          
                          <div
                            ref={titleRef}
                            className={styles.slideTitleInput}
                            contentEditable={!isReadOnly}
                            suppressContentEditableWarning
                            role="textbox"
                            aria-label="Slide title"
                            onInput={(e) => {
                              e.preventDefault();
                              handleContentInput("title");
                            }}
                            onFocus={() => handleContentFocus("title")}
                            onBlur={() => handleContentBlur("title")}
                            data-readonly={isReadOnly}
                            style={{
                              ...getTextStyle("title"),
                              width: "100%",
                              textAlign: "left",
                              color: "#1e293b",
                              fontSize: "clamp(28px, 3vw, 36px)",
                              fontWeight: 700,
                              marginBottom: "24px",
                            }}
                          />
                          
                          <div
                            ref={subtitleRef}
                            className={styles.slideSubtitleInput}
                            contentEditable={!isReadOnly}
                            suppressContentEditableWarning
                            role="textbox"
                            aria-label="Slide content"
                            onInput={(e) => {
                              e.preventDefault();
                              handleContentInput("subtitle");
                            }}
                            onFocus={() => handleContentFocus("subtitle")}
                            onBlur={() => handleContentBlur("subtitle")}
                            data-readonly={isReadOnly}
                            style={{
                              ...getTextStyle("subtitle"),
                              width: "100%",
                              textAlign: "left",
                              color: "#555555",
                              fontSize: "clamp(16px, 1.8vw, 20px)",
                              flex: 1,
                            }}
                          />
                          
                          {/* Footer */}
                          <div className={styles.digitalSolutionsContentFooter}>
                            <div className={styles.digitalSolutionsContentFooterLeft}>
                              <div>© All rights Reserved</div>
                              <div>Aramco Digital: General Use</div>
                            </div>
                            <div className={styles.digitalSolutionsContentFooterCenter}>
                              This content has been classified as Aramco Digital: Confidential Use
                            </div>
                            <div className={styles.digitalSolutionsContentFooterRight}>
                              {currentSlideIndex + 1}
                            </div>
                          </div>
                        </div>
                      ) : isDigitalSolutions && slideType === "ending" ? (
                        /* Digital Solutions Ending Slide */
                        <>
                          <div
                            ref={titleRef}
                            className={styles.slideTitleInput}
                            contentEditable={!isReadOnly}
                            suppressContentEditableWarning
                            role="textbox"
                            aria-label="Slide title"
                            onInput={(e) => {
                              e.preventDefault();
                              handleContentInput("title");
                            }}
                            onFocus={() => handleContentFocus("title")}
                            onBlur={() => handleContentBlur("title")}
                            style={{
                              ...getTextStyle("title"),
                              width: "100%",
                              textAlign: "center",
                              color: "#ffffff",
                            }}
                            data-readonly={isReadOnly}
                          />
                        </>
                      ) : isAramcoClassic && slideType === "cover" ? (
                        /* Aramco Classic Cover Slide */
                        <div className={styles.aramcoClassicCoverLayout}>
                          {/* Logo in top right */}
                          <div className={styles.themeLogoTopRight}>
                            <img src="/aramco-digital.png" alt="Aramco Digital" />
                          </div>
                          
                          <div className={styles.aramcoClassicCoverTitleArea}>
                            <div
                              ref={titleRef}
                              className={styles.aramcoClassicCoverTitle}
                              contentEditable={!isReadOnly}
                              suppressContentEditableWarning
                              role="textbox"
                              aria-label="Slide title"
                              onInput={(e) => {
                                e.preventDefault();
                                handleContentInput("title");
                              }}
                              onFocus={() => handleContentFocus("title")}
                              onBlur={() => handleContentBlur("title")}
                              data-readonly={isReadOnly}
                            >
                              {selectedSlide?.title || "project title (50pt)"}
                            </div>
                            <div
                              ref={subtitleRef}
                              className={styles.aramcoClassicCoverDescriptor}
                              contentEditable={!isReadOnly}
                              suppressContentEditableWarning
                              role="textbox"
                              aria-label="Presentation descriptor"
                              onInput={(e) => {
                                e.preventDefault();
                                handleContentInput("subtitle");
                              }}
                              onFocus={() => handleContentFocus("subtitle")}
                              onBlur={() => handleContentBlur("subtitle")}
                              data-readonly={isReadOnly}
                            >
                              {selectedSlide?.subtitle || "Presentation descriptor (12pt)"}
                            </div>
                            <div className={styles.aramcoClassicCoverDate}>
                              {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </div>
                          </div>
                          
                          {/* Wave pattern at bottom */}
                          <div className={styles.aramcoClassicCoverWave} />
                        </div>
                      ) : isAramcoClassic && slideType === "content" ? (
                        /* Aramco Classic Content Slide */
                        <div className={styles.aramcoClassicContentLayout}>
                          {/* Logo in top right */}
                          <div className={styles.themeLogoTopRight}>
                            <img src="/aramco-digital.png" alt="Aramco Digital" />
                          </div>
                          
                          <div className={styles.aramcoClassicContentHeader}>
                            <div
                              ref={titleRef}
                              className={styles.aramcoClassicContentPageTitle}
                              contentEditable={!isReadOnly}
                              suppressContentEditableWarning
                              role="textbox"
                              aria-label="Page title"
                              onInput={(e) => {
                                e.preventDefault();
                                handleContentInput("title");
                              }}
                              onFocus={() => handleContentFocus("title")}
                              onBlur={() => handleContentBlur("title")}
                              data-readonly={isReadOnly}
                            >
                              {selectedSlide?.title || "Page title (24pt)"}
                            </div>
                            <div
                              className={styles.aramcoClassicContentPageSubtitle}
                              contentEditable={!isReadOnly}
                              suppressContentEditableWarning
                              role="textbox"
                              aria-label="Page subtitle"
                              onInput={(e) => {
                                e.preventDefault();
                                const subtitleDiv = e.currentTarget;
                                updateSlideField("subtitle", subtitleDiv.innerHTML);
                              }}
                              onFocus={() => setActiveField("subtitle")}
                              onBlur={(e) => {
                                const subtitleDiv = e.currentTarget;
                                const text = subtitleDiv.textContent?.replace(/\u00a0/g, " ").trim() ?? "";
                                if (!text) {
                                  subtitleDiv.innerHTML = "";
                                  updateSlideField("subtitle", "");
                                } else {
                                  updateSlideField("subtitle", subtitleDiv.innerHTML);
                                }
                              }}
                              data-readonly={isReadOnly}
                              suppressHydrationWarning
                            >
                              {selectedSlide?.subtitle || "Page subtitle (24pt)"}
                            </div>
                          </div>
                          
                          {/* Content body area */}
                          <div
                            ref={subtitleRef}
                            className={styles.aramcoClassicContentBody}
                            contentEditable={!isReadOnly}
                            suppressContentEditableWarning
                            role="textbox"
                            aria-label="Slide content"
                            onInput={(e) => {
                              e.preventDefault();
                              handleContentInput("subtitle");
                            }}
                            onFocus={() => handleContentFocus("subtitle")}
                            onBlur={() => handleContentBlur("subtitle")}
                            data-readonly={isReadOnly}
                          >
                            {selectedSlide?.content || "This is Body Copy"}
                          </div>
                          
                          {/* Footer with gradient line */}
                          <div className={styles.aramcoClassicContentFooter}>
                            <div className={styles.aramcoClassicContentFooterLine}>
                              {currentSlideIndex + 1}
                            </div>
                            <div className={styles.aramcoClassicContentFooterLine}>
                              {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </div>
                            <div className={styles.aramcoClassicContentFooterLine}>
                              Copyright note text (8pt)
                            </div>
                            <div className={styles.aramcoClassicContentFooterLine}>
                              Aramco Digital: General Use
                            </div>
                          </div>
                        </div>
                      ) : isAramcoClassic && slideType === "ending" ? (
                        /* Aramco Classic Logo Slide */
                        <div className={styles.plainAramcoLogoContainer}>
                          <img src="/themes/aramco-logo-classic.png" alt="Aramco" />
                        </div>
                      ) : selectedSlide ? (
                        /* Default / Normal Slide Layout with Aramco Digital Styling */
                        (() => {
                          const layout = selectedSlide.layout ?? "layout2";
                          const formatting = ensureFormatting(selectedSlide.formatting);
                          const alignClass =
                            formatting.align === "center"
                              ? styles.textAlignCenter
                              : formatting.align === "right"
                              ? styles.textAlignRight
                              : styles.textAlignLeft;
                          const titleClass = cx(
                            styles.slideTitleInput,
                            formatting.bold && styles.textBold,
                            formatting.italic && styles.textItalic,
                            formatting.underline && styles.textUnderline,
                            alignClass
                          );
                          const subtitleClass = cx(
                            styles.slideSubtitleInput,
                            formatting.bold && styles.textBold,
                            formatting.italic && styles.textItalic,
                            formatting.underline && styles.textUnderline,
                            alignClass
                          );
                          
                          // Layout 1: Title only
                          if (layout === "layout1") {
                            return (
                              <>
                                {/* Aramco Digital Logo in top right */}
                                <div className={styles.themeLogoTopRight}>
                                  <img src="/aramco-digital.png" alt="Aramco Digital" />
                                </div>
                                <div className={styles.layout1}>
                                  <div
                                    ref={titleRef}
                                    className={titleClass}
                                    contentEditable={!isReadOnly}
                                    suppressContentEditableWarning
                                    role="textbox"
                                    aria-label="Slide title"
                                    onInput={(e) => {
                                      e.preventDefault();
                                      handleContentInput("title");
                                    }}
                                    onFocus={() => handleContentFocus("title")}
                                    onBlur={() => handleContentBlur("title")}
                                    style={{
                                      ...getTextStyle("title"),
                                      width: "100%",
                                      textAlign: "center",
                                    }}
                                    data-readonly={isReadOnly}
                                  />
                                </div>
                              </>
                            );
                          }
                          
                          // Layout 3: Two-column text
                          if (layout === "layout3") {
                            const content = selectedSlide?.content || "";
                            
                            // Check if content contains HTML (img tags)
                            if (content.includes('<img')) {
                              // For HTML content, split by double newlines and render in two columns
                              const parts = content.split(/\n\n+/).filter(part => part.trim().length > 0);
                              const midPoint = Math.ceil(parts.length / 2);
                              const leftContent = parts.slice(0, midPoint).join('\n\n');
                              const rightContent = parts.slice(midPoint).join('\n\n');
                              
                              return (
                                <>
                                  {/* Aramco Digital Logo in top right */}
                                  <div className={styles.themeLogoTopRight}>
                                    <img src="/aramco-digital.png" alt="Aramco Digital" />
                                  </div>
                                  <div className={styles.layout3}>
                                    <div
                                      ref={titleRef}
                                      className={styles.slideTitleInput}
                                      contentEditable={!isReadOnly}
                                      suppressContentEditableWarning
                                      role="textbox"
                                      aria-label="Slide title"
                                      onInput={(e) => {
                                        e.preventDefault();
                                        handleContentInput("title");
                                      }}
                                      onFocus={() => handleContentFocus("title")}
                                      onBlur={() => handleContentBlur("title")}
                                      style={{
                                        ...getTextStyle("title"),
                                        width: "100%",
                                        textAlign: "center",
                                        marginBottom: "clamp(24px, 3vw, 40px)",
                                      }}
                                      data-readonly={isReadOnly}
                                    />
                                    <div className={styles.layout3Columns}>
                                      <div className={styles.layout3Column}>
                                        <div
                                          className={styles.slideContentHtml}
                                          dangerouslySetInnerHTML={{ __html: leftContent || "" }}
                                          style={{
                                            fontSize: activeThemeObj.bulletFontSize,
                                            fontWeight: activeThemeObj.bulletFontWeight,
                                            color: activeThemeObj.bulletColor,
                                            lineHeight: activeThemeObj.bulletLineHeight,
                                          }}
                                        />
                                      </div>
                                      <div className={styles.layout3Column}>
                                        <div
                                          className={styles.slideContentHtml}
                                          dangerouslySetInnerHTML={{ __html: rightContent || "" }}
                                          style={{
                                            fontSize: activeThemeObj.bulletFontSize,
                                            fontWeight: activeThemeObj.bulletFontWeight,
                                            color: activeThemeObj.bulletColor,
                                            lineHeight: activeThemeObj.bulletLineHeight,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </>
                              );
                            }
                            
                            // For text content, split into two columns
                            const lines = content.split('\n').filter(line => line.trim().length > 0);
                            const midPoint = Math.ceil(lines.length / 2);
                            const leftColumn = lines.slice(0, midPoint);
                            const rightColumn = lines.slice(midPoint);
                            
                            return (
                              <>
                                {/* Aramco Digital Logo in top right */}
                                <div className={styles.themeLogoTopRight}>
                                  <img src="/aramco-digital.png" alt="Aramco Digital" />
                                </div>
                                <div className={styles.layout3}>
                                  <div
                                    ref={titleRef}
                                    className={titleClass}
                                    contentEditable={!isReadOnly}
                                    suppressContentEditableWarning
                                    role="textbox"
                                    aria-label="Slide title"
                                    onInput={(e) => {
                                      e.preventDefault();
                                      handleContentInput("title");
                                    }}
                                    onFocus={() => handleContentFocus("title")}
                                    onBlur={() => handleContentBlur("title")}
                                    style={{
                                      ...getTextStyle("title"),
                                      width: "100%",
                                      marginBottom: "clamp(24px, 3vw, 40px)",
                                    }}
                                    data-readonly={isReadOnly}
                                  />
                                  <div className={styles.layout3Columns}>
                                    <div className={styles.layout3Column}>
                                      {leftColumn.map((line, index) => {
                                        const trimmed = line.trim();
                                        if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
                                          const text = trimmed.substring(1).trim();
                                          return (
                                            <div key={`left-${index}`} style={{ marginBottom: "clamp(12px, 1.5vw, 20px)", display: "flex", alignItems: "flex-start" }}>
                                              <span style={{ marginRight: "0.75rem", fontSize: "1.5em", lineHeight: "1", marginTop: "0.1em", flexShrink: 0, fontWeight: "bold", color: activeThemeObj.titleColor }}>•</span>
                                              <span style={{ flex: 1, wordBreak: "break-word", fontSize: activeThemeObj.bulletFontSize, fontWeight: activeThemeObj.bulletFontWeight, color: activeThemeObj.bulletColor, lineHeight: activeThemeObj.bulletLineHeight }}>{text}</span>
                                            </div>
                                          );
                                        }
                                        return (
                                          <div key={`left-${index}`} style={{ marginBottom: "clamp(12px, 1.5vw, 20px)", fontSize: activeThemeObj.bulletFontSize, fontWeight: activeThemeObj.bulletFontWeight, color: activeThemeObj.bulletColor, lineHeight: activeThemeObj.bulletLineHeight, wordBreak: "break-word" }}>
                                            {trimmed}
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div className={styles.layout3Column}>
                                      {rightColumn.map((line, index) => {
                                        const trimmed = line.trim();
                                        if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
                                          const text = trimmed.substring(1).trim();
                                          return (
                                            <div key={`right-${index}`} style={{ marginBottom: "clamp(12px, 1.5vw, 20px)", display: "flex", alignItems: "flex-start" }}>
                                              <span style={{ marginRight: "0.75rem", fontSize: "1.5em", lineHeight: "1", marginTop: "0.1em", flexShrink: 0, fontWeight: "bold", color: activeThemeObj.titleColor }}>•</span>
                                              <span style={{ flex: 1, wordBreak: "break-word", fontSize: activeThemeObj.bulletFontSize, fontWeight: activeThemeObj.bulletFontWeight, color: activeThemeObj.bulletColor, lineHeight: activeThemeObj.bulletLineHeight }}>{text}</span>
                                            </div>
                                          );
                                        }
                                        return (
                                          <div key={`right-${index}`} style={{ marginBottom: "clamp(12px, 1.5vw, 20px)", fontSize: activeThemeObj.bulletFontSize, fontWeight: activeThemeObj.bulletFontWeight, color: activeThemeObj.bulletColor, lineHeight: activeThemeObj.bulletLineHeight, wordBreak: "break-word" }}>
                                            {trimmed}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </>
                            );
                          }
                          
                          // Layout 2: Title + Subtitle (default)
                          return (
                            <>
                              {/* Aramco Digital Logo in top right */}
                              <div className={styles.themeLogoTopRight}>
                                <img src="/aramco-digital.png" alt="Aramco Digital" />
                              </div>
                              <div className={styles.layout2}>
                              <div
                                ref={titleRef}
                                className={titleClass}
                                contentEditable={!isReadOnly}
                                suppressContentEditableWarning
                                role="textbox"
                                aria-label="Slide title"
                                onInput={(e) => {
                                  e.preventDefault();
                                  handleContentInput("title");
                                }}
                                onFocus={() => handleContentFocus("title")}
                                onBlur={() => handleContentBlur("title")}
                                style={{
                                  ...getTextStyle("title"),
                                  width: "100%",
                                }}
                                data-readonly={isReadOnly}
                              />
                              {/* For AI template: Show subtitle only for title slide, content for other slides */}
                              {isAITemplate ? (
                            <>
                              {/* Title slide: show subtitle */}
                              {selectedSlide?.subtitle && (
                                formatting.listType === "bullets" || formatting.listType === "numbers" ? (
                                  formatting.listType === "bullets" ? (
                                    <ul className={cx(styles.slideList, alignClass)}>
                                      {(selectedSlide.subtitle || "").split(/\r?\n/).filter(Boolean).map((line, idx) => (
                                        <li key={idx}>{line}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <ol className={cx(styles.slideList, alignClass)}>
                                      {(selectedSlide.subtitle || "").split(/\r?\n/).filter(Boolean).map((line, idx) => (
                                        <li key={idx}>{line}</li>
                                      ))}
                                    </ol>
                                  )
                                ) : (
                                  <div
                                    ref={subtitleRef}
                                    className={subtitleClass}
                                    contentEditable={!isReadOnly}
                                    suppressContentEditableWarning
                                    role="textbox"
                                    aria-label="Slide subtitle"
                                    onInput={(e) => {
                                      e.preventDefault();
                                      handleContentInput("subtitle");
                                    }}
                                    onFocus={() => handleContentFocus("subtitle")}
                                    onBlur={() => handleContentBlur("subtitle")}
                                    style={{
                                      ...getTextStyle("subtitle"),
                                      width: "100%",
                                    }}
                                    data-readonly={isReadOnly}
                                  />
                                )
                              )}
                        {/* Outline slide: show numbered sections */}
                        {selectedSlide?.title === "Outline" && selectedSlide?.content && (
                          <div
                            className={styles.slideContent}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "clamp(16px, 2vw, 24px)",
                              marginTop: "auto",
                              width: "100%",
                              maxWidth: "75%",
                              alignItems: "flex-start",
                            }}
                          >
                            {(() => {
                              const content = selectedSlide.content;
                              
                              // Check if content contains HTML (img tags)
                              if (content.includes('<img')) {
                                // Render HTML content
                                return (
                                  <div
                                    className={styles.slideContentHtml}
                                    dangerouslySetInnerHTML={{ __html: content }}
                                    style={{
                                      width: "100%",
                                      fontSize: activeThemeObj.bulletFontSize,
                                      fontWeight: activeThemeObj.bulletFontWeight,
                                      color: activeThemeObj.bulletColor,
                                      lineHeight: activeThemeObj.bulletLineHeight,
                                    }}
                                  />
                                );
                              }
                              
                              // Parse numbered sections (e.g., "1. Overview", "2. Key Concepts")
                              const lines = content
                                .split('\n')
                                .map(line => line.trim())
                                .filter(line => line.length > 0);
                              
                              return lines.map((line, index) => {
                                // Check if line starts with a number (e.g., "1. ", "2. ")
                                const numberedMatch = line.match(/^(\d+)\.\s*(.+)$/);
                                
                                if (numberedMatch) {
                                  const [, number, text] = numberedMatch;
                                  return (
                                    <div
                                      key={`outline-${index}`}
                                      style={{
                                        display: "flex",
                                        alignItems: "flex-start",
                                        marginBottom: index < lines.length - 1 ? "clamp(16px, 2vw, 24px)" : "0",
                                        lineHeight: activeThemeObj.bulletLineHeight,
                                        minHeight: "1.5em",
                                        width: "100%",
                                      }}
                                    >
                                      <span 
                                        style={{ 
                                          marginRight: "1rem", 
                                          color: activeThemeObj.titleColor,
                                          fontSize: activeThemeObj.bulletFontSize,
                                          fontWeight: 600,
                                          lineHeight: activeThemeObj.bulletLineHeight,
                                          flexShrink: 0,
                                          minWidth: "2rem",
                                        }}
                                      >
                                        {number}.
                                      </span>
                                      <span 
                                        style={{ 
                                          flex: 1, 
                                          wordBreak: "break-word",
                                          fontSize: activeThemeObj.bulletFontSize,
                                          fontWeight: activeThemeObj.bulletFontWeight,
                                          color: activeThemeObj.bulletColor,
                                          lineHeight: activeThemeObj.bulletLineHeight,
                                        }}
                                      >
                                        {text}
                                      </span>
                                    </div>
                                  );
                                }
                                
                                // Fallback: render as regular line
                                return (
                                  <div
                                    key={`line-${index}`}
                                    style={{
                                      marginBottom: index < lines.length - 1 ? "clamp(16px, 2vw, 24px)" : "0",
                                          lineHeight: activeThemeObj.bulletLineHeight,
                                      wordBreak: "break-word",
                                      minHeight: "1.5em",
                                      width: "100%",
                                      fontSize: activeThemeObj.bulletFontSize,
                                      fontWeight: activeThemeObj.bulletFontWeight,
                                      color: activeThemeObj.bulletColor,
                                    }}
                                  >
                                    {line}
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        )}
                        {/* Content slides: show content (only if no subtitle and not outline slide) */}
                        {selectedSlide?.content && !selectedSlide?.subtitle && selectedSlide?.title !== "Outline" && (
                          <div
                            className={styles.slideContent}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "clamp(12px, 1.5vw, 20px)",
                              marginTop: selectedSlide?.subtitle ? "0" : "auto",
                              width: "100%",
                              maxWidth: "85%",
                              alignItems: "flex-start",
                            }}
                          >
                            {(() => {
                              const content = selectedSlide.content;
                              
                              // Check if content contains HTML (img tags)
                              if (content.includes('<img')) {
                                // Render HTML content
                                return (
                                  <div
                                    className={styles.slideContentHtml}
                                    dangerouslySetInnerHTML={{ __html: content }}
                                    style={{
                                      width: "100%",
                                      fontSize: activeThemeObj.bulletFontSize,
                                      fontWeight: activeThemeObj.bulletFontWeight,
                                      color: activeThemeObj.bulletColor,
                                      lineHeight: activeThemeObj.bulletLineHeight,
                                    }}
                                  />
                                );
                              }
                              
                              // Original text rendering logic
                              const lines = content
                                .split('\n')
                                .map(line => line.trim())
                                .filter(line => line.length > 0);
                              
                              // Remove duplicates
                              const uniqueLines = Array.from(new Set(lines));
                              
                              return uniqueLines.map((line, index) => {
                                // Convert bullet points
                                if (line.startsWith('•') || line.startsWith('-')) {
                                  const text = line.substring(1).trim();
                                  if (!text) return null;
                                  
                                  return (
                                    <div
                                      key={`bullet-${index}`}
                                      style={{
                                        display: "flex",
                                        alignItems: "flex-start",
                                        marginBottom: index < uniqueLines.length - 1 ? "clamp(12px, 1.5vw, 20px)" : "0",
                                        lineHeight: activeThemeObj.bulletLineHeight,
                                        minHeight: "1.5em",
                                        width: "100%",
                                      }}
                                    >
                                      <span 
                                        style={{ 
                                          marginRight: "0.75rem", 
                                          color: activeThemeObj.titleColor,
                                          fontSize: "1.5em",
                                          lineHeight: "1",
                                          marginTop: "0.1em",
                                          flexShrink: 0,
                                          fontWeight: "bold",
                                        }}
                                      >
                                        •
                                      </span>
                                      <span 
                                        style={{ 
                                          flex: 1, 
                                          wordBreak: "break-word",
                                          fontSize: activeThemeObj.bulletFontSize,
                                          fontWeight: activeThemeObj.bulletFontWeight,
                                          color: activeThemeObj.bulletColor,
                                          lineHeight: activeThemeObj.bulletLineHeight,
                                        }}
                                      >
                                        {text}
                                      </span>
                                    </div>
                                  );
                                }
                                
                                return (
                                  <div
                                    key={`line-${index}`}
                                    style={{
                                      marginBottom: index < uniqueLines.length - 1 ? "clamp(12px, 1.5vw, 20px)" : "0",
                                          lineHeight: activeThemeObj.bulletLineHeight,
                                      wordBreak: "break-word",
                                      minHeight: "1.5em",
                                      width: "100%",
                                      fontSize: activeThemeObj.bulletFontSize,
                                      fontWeight: activeThemeObj.bulletFontWeight,
                                      color: activeThemeObj.bulletColor,
                                    }}
                                  >
                                    {line}
                                  </div>
                                );
                              }).filter(Boolean);
                            })()}
                            </div>
                          )}
                            </>
                          ) : (
                            /* Non-AI template: show subtitle normally */
                            selectedSlide?.subtitle && (
                              formatting.listType === "bullets" || formatting.listType === "numbers" ? (
                                formatting.listType === "bullets" ? (
                                  <ul className={cx(styles.slideList, alignClass)}>
                                    {(selectedSlide.subtitle || "").split(/\r?\n/).filter(Boolean).map((line, idx) => (
                                      <li key={idx}>{line}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <ol className={cx(styles.slideList, alignClass)}>
                                    {(selectedSlide.subtitle || "").split(/\r?\n/).filter(Boolean).map((line, idx) => (
                                      <li key={idx}>{line}</li>
                                    ))}
                                  </ol>
                                )
                              ) : (
                                <div
                                  ref={subtitleRef}
                                  className={subtitleClass}
                                  contentEditable={!isReadOnly}
                                  suppressContentEditableWarning
                                  role="textbox"
                                  aria-label="Slide subtitle"
                                  onInput={(e) => {
                                    e.preventDefault();
                                    handleContentInput("subtitle");
                                  }}
                                  onFocus={() => handleContentFocus("subtitle")}
                                  onBlur={() => handleContentBlur("subtitle")}
                                  style={getTextStyle("subtitle")}
                                  data-readonly={isReadOnly}
                                />
                              )
                            )
                          )}
                            </div>
                            </>
                          );
                        })()
                      ) : (
                        /* No slide selected - show placeholder */
                        <div style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "center", 
                          height: "100%",
                          color: "#64748b",
                          fontSize: "18px"
                        }}>
                          No slide selected
                        </div>
                      )}

                      {/* Draggable/Resizable Image - positioned relative to canvasSurface */}
                      {selectedSlide?.imageUrl && (() => {
                        const imageX = selectedSlide.imageX ?? 50;
                        const imageY = selectedSlide.imageY ?? 50;
                        const imageWidth = selectedSlide.imageWidth ?? 30;
                        const imageHeight = selectedSlide.imageHeight ?? 30;
                        
                        // Only show border and handles when actively dragging/resizing
                        const isEditing = isDraggingImage || isResizingImage;
                        
                        return (
                          <div
                            style={{
                              position: "absolute",
                              left: `${imageX}%`,
                              top: `${imageY}%`,
                              transform: "translate(-50%, -50%)",
                              width: `${imageWidth}%`,
                              height: `${imageHeight}%`,
                              cursor: isReadOnly ? "default" : isEditing ? "move" : "grab",
                              zIndex: isEditing ? 20 : 10,
                            }}
                            onMouseDown={(e) => {
                              if (isReadOnly) return;
                              // Image is a direct child of canvasSurface, so parentElement should be it
                              const container = e.currentTarget.parentElement;
                              if (container && container.classList.contains(styles.canvasSurface) && handleImageMouseDownRef.current) {
                                handleImageMouseDownRef.current(e, container as HTMLElement);
                              } else {
                                // Fallback: search up the tree
                                let parent = e.currentTarget.parentElement;
                                while (parent && !parent.classList.contains(styles.canvasSurface)) {
                                  parent = parent.parentElement;
                                }
                                if (parent && handleImageMouseDownRef.current) {
                                  handleImageMouseDownRef.current(e, parent as HTMLElement);
                                }
                              }
                            }}
                            onMouseEnter={(e) => {
                              if (!isReadOnly && !isEditing) {
                                e.currentTarget.style.cursor = "grab";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isEditing) {
                                e.currentTarget.style.cursor = "default";
                              }
                            }}
                          >
                            <img 
                              src={selectedSlide.imageUrl} 
                              alt="" 
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                                borderRadius: "8px",
                                border: isReadOnly || !isEditing ? "none" : "2px solid #6366f1",
                                pointerEvents: "none",
                                userSelect: "none",
                              }}
                            />
                            {!isReadOnly && isEditing && (
                              <>
                                {/* Resize handle - only show when editing */}
                                <div
                                  style={{
                                    position: "absolute",
                                    bottom: "-8px",
                                    right: "-8px",
                                    width: "16px",
                                    height: "16px",
                                    backgroundColor: "#6366f1",
                                    border: "2px solid white",
                                    borderRadius: "50%",
                                    cursor: "nwse-resize",
                                    zIndex: 21,
                                    pointerEvents: "auto",
                                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                                  }}
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    // Resize handle -> image div -> canvasSurface
                                    const imageDiv = e.currentTarget.parentElement?.parentElement;
                                    const container = imageDiv?.parentElement;
                                    if (container && container.classList.contains(styles.canvasSurface) && handleImageResizeMouseDownRef.current) {
                                      handleImageResizeMouseDownRef.current(e, container as HTMLElement);
                                    } else {
                                      // Fallback: search up the tree
                                      let parent = e.currentTarget.parentElement;
                                      while (parent && !parent.classList.contains(styles.canvasSurface)) {
                                        parent = parent.parentElement;
                                      }
                                      if (parent && handleImageResizeMouseDownRef.current) {
                                        handleImageResizeMouseDownRef.current(e, parent as HTMLElement);
                                      }
                                    }
                                  }}
                                />
                                {/* Delete button - only show when editing */}
                                <div
                                  style={{
                                    position: "absolute",
                                    top: "-8px",
                                    right: "-8px",
                                    width: "20px",
                                    height: "20px",
                                    backgroundColor: "#ef4444",
                                    border: "2px solid white",
                                    borderRadius: "50%",
                                    cursor: "pointer",
                                    zIndex: 21,
                                    pointerEvents: "auto",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "12px",
                                    color: "white",
                                    fontWeight: "bold",
                                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm("Delete this image?")) {
                                      void handleDeleteImage();
                                    }
                                  }}
                                  title="Delete image"
                                >
                                  ×
                                </div>
                              </>
                            )}
                            {/* Delete button - always visible but subtle when not editing */}
                            {!isReadOnly && !isEditing && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "-8px",
                                  right: "-8px",
                                  width: "20px",
                                  height: "20px",
                                  backgroundColor: "rgba(239, 68, 68, 0.7)",
                                  border: "1px solid rgba(255, 255, 255, 0.8)",
                                  borderRadius: "50%",
                                  cursor: "pointer",
                                  zIndex: 11,
                                  pointerEvents: "auto",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "12px",
                                  color: "white",
                                  fontWeight: "bold",
                                  opacity: 0,
                                  transition: "opacity 0.2s ease",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.opacity = "1";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.opacity = "0";
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm("Delete this image?")) {
                                    void handleDeleteImage();
                                  }
                                }}
                                title="Delete image"
                              >
                                ×
                              </div>
                            )}
                          </div>
                        );
                      })()}

                    </div>
                    <div className={styles.canvasActionBar}>
                      <button 
                        type="button" 
                        onClick={() => handleSaveSlide(false)} 
                        className={`${styles.canvasActionButton} ${styles.canvasActionPrimary}`}
                        style={{
                          backgroundColor: activeThemeObj.buttonPrimaryBg,
                          color: activeThemeObj.buttonPrimaryColor,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = activeThemeObj.buttonPrimaryHover || activeThemeObj.buttonPrimaryBg || "";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = activeThemeObj.buttonPrimaryBg || "";
                        }}
                      >
                        Save
                      </button>
                      <button 
                        type="button" 
                        onClick={handleShare}
                        className={`${styles.canvasActionButton} ${styles.canvasActionSecondary}`}
                        style={{
                          backgroundColor: activeThemeObj.buttonSecondaryBg,
                          color: activeThemeObj.buttonSecondaryColor,
                          borderColor: activeThemeObj.buttonSecondaryBorder,
                        }}
                      >
                        Share
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenSlideshow}
                        style={{
                          backgroundColor: activeThemeObj.buttonPrimaryBg,
                          color: activeThemeObj.buttonPrimaryColor,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = activeThemeObj.buttonPrimaryHover || activeThemeObj.buttonPrimaryBg || "";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = activeThemeObj.buttonPrimaryBg || "";
                        }}
                        className={`${styles.canvasActionButton} ${styles.canvasActionSecondary}`}
                      >
                        Slideshow
                      </button>
                      <button
                        type="button"
                        onClick={handleMoveUp}
                        disabled={isFirstSlide}
                        className={`${styles.canvasActionButton} ${styles.canvasActionSecondary}`}
                      >
                        Move Up
                      </button>
                      <button
                        type="button"
                        onClick={handleMoveDown}
                        disabled={isLastSlide}
                        className={`${styles.canvasActionButton} ${styles.canvasActionSecondary}`}
                      >
                        Move Down
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteSlide}
                        disabled={!canDeleteSlide}
                        className={`${styles.canvasActionButton} ${styles.canvasActionDanger}`}
                      >
                        Delete Slide
                      </button>
                    </div>
                    <div className={styles.notesRibbon}>
                      <header className={styles.notesHeader}>
                        <div>
                          <h2 className={styles.notesTitle}>Speaker Notes</h2>
                          <span className={styles.notesSubtitle}>Keep presenter notes handy for this slide.</span>
                        </div>
                        <div className={styles.notesModeSwitcher}>
                          <button
                            className={styles.notesModeButtonActive}
                            type="button"
                          >
                            Private
                          </button>
                          <button
                            type="button"
                            onClick={handleToggleVoice}
                            className={
                              isVoiceRecording
                                ? styles.notesModeButtonVoiceActive
                                : styles.notesModeButtonVoice
                            }
                          >
                            <span className={styles.voiceIndicator} />
                            Voice
                          </button>
                        </div>
                      </header>
                      {voiceError && (
                        <div className={styles.voiceRecordingHint} style={{ color: "#d32f2f", backgroundColor: "#ffebee" }}>
                          {voiceError}
                        </div>
                      )}
                      {isVoiceRecording && !voiceError && (
                        <div className={styles.voiceRecordingHint}>
                          Recording… speak and we'll convert your voice into notes.
                        </div>
                      )}
                      <textarea
                        id="speaker-notes"
                        ref={notesRef}
                        className={styles.notesTextarea}
                        value={speakerNotes}
                        onChange={handleNotesChange}
                        onFocus={handleNotesFocus}
                        onInput={(event) => autoResizeNotes(event.currentTarget)}
                        aria-label="Slide notes"
                        placeholder="Click to add speaker notes"
                        readOnly={isReadOnly}
                      />
                    </div>
                  </div>
                </section>
              </div>

              <section className={styles.bottomSection}>
                <div className={styles.bottomGrid}>
                  <section className={`${styles.bottomCard} ${styles.commentsPanel}`}>
                    <header className={styles.bottomCardHeader}>
                      <div>
                        <h2 className="text-xl font-semibold text-cyan-700">Comments</h2>
                        <p className="text-sm text-gray-600">Collaborate with your team in real time.</p>
                      </div>
                      <span className={styles.badge}>Team</span>
                    </header>
                    <div className={styles.commentsList}>
                      {comments.length === 0 ? (
                        <div className={styles.commentCard} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                          <p>No comments yet. Start the discussion with your team.</p>
                        </div>
                      ) : (
                        comments.map((comment) => (
                          <div key={comment.id} className={styles.commentCard}>
                            <div className={styles.commentMeta}>
                              <span>{comment.author}</span>
                              <span>{comment.timestamp}</span>
                            </div>
                            <p className="mt-3 text-slate-700 leading-relaxed">{comment.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <form className={styles.commentForm} onSubmit={handleCommentSubmit}>
                      <label htmlFor="new-comment" className="text-sm font-medium text-slate-700">
                        Add a comment
                      </label>
                      <textarea
                        id="new-comment"
                        className={styles.commentTextarea}
                        value={newComment}
                        onChange={(event) => setNewComment(event.target.value)}
                        placeholder="Share feedback for the team..."
                        rows={3}
                      />
                      <button type="submit" className={styles.commentButton}>
                        Add Comment
                      </button>
                    </form>
                  </section>
                </div>
              </section>
            </div>

          <footer className={styles.footer}>© 2025 Aramco Digital – Secure Presentation Tool</footer>
          </div>

        </div>
      </main>

      {isTeamModalOpen ? (
        <div className={styles.teamModalOverlay} role="dialog" aria-modal="true" aria-labelledby="team-management-title">
          <div className={styles.teamModal}>
            <div className={styles.teamModalHeader}>
              <h2 id="team-management-title">Manage Team</h2>
              <button
                type="button"
                className={styles.teamModalClose}
                onClick={() => {
                  if (isUpdatingTeam) return;
                  setIsTeamModalOpen(false);
                }}
                aria-label="Close team management"
              >
                ✕
              </button>
            </div>

            <div className={styles.teamModalSection}>
              <h3 className={styles.teamSectionTitle}>Current Members</h3>
              <ul className={styles.teamMemberList}>
                <li className={styles.teamMemberRow}>
                  <div>
                    <span className={styles.teamMemberName}>
                      {ownerDisplayName || presentationOwnerId || "Owner"}
                    </span>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontSize: "11px",
                        fontWeight: 600,
                        backgroundColor: "#E5F4F1",
                        color: "#2b6a64",
                        marginLeft: "8px",
                      }}
                    >
                      Owner
                    </span>
                  </div>
                </li>
                {collaborators.length === 0 ? (
                  <li className={styles.teamMemberEmpty}>No collaborators yet.</li>
                ) : (
                  collaborators.map((member) => {
                    const displayName = collaboratorDisplayNames[member] || member;
                    const currentRole = teamRoles[member] || "editor";
                    return (
                      <li key={member} className={styles.teamMemberRow}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                          <div>
                            <span className={styles.teamMemberName}>{displayName}</span>
                          </div>
                          <select
                            value={currentRole}
                            onChange={(e) => {
                              const newRole = e.target.value as "editor" | "viewer";
                              void handleUpdateRole(member, newRole);
                            }}
                            disabled={isUpdatingTeam}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "6px",
                              border: "1px solid rgba(0, 0, 0, 0.1)",
                              fontSize: "12px",
                              backgroundColor: "#ffffff",
                              color: "#202124",
                              cursor: isUpdatingTeam ? "not-allowed" : "pointer",
                            }}
                          >
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        </div>
                        <button
                          type="button"
                          className={styles.teamRemoveButton}
                          onClick={() => handleRemoveCollaborator(member)}
                          disabled={isUpdatingTeam}
                        >
                          Remove
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>

            <form className={styles.teamAddForm} onSubmit={handleAddCollaborator}>
              <label htmlFor="team-collaborator-input" className={styles.teamInputLabel}>
                Invite collaborator by email or ID
              </label>
              <div className={styles.teamInputRow}>
                <input
                  id="team-collaborator-input"
                  type="text"
                  className={styles.teamInput}
                  placeholder="member@example.com"
                  value={newCollaboratorValue}
                  onChange={(event) => setNewCollaboratorValue(event.target.value)}
                  disabled={isUpdatingTeam}
                />
                <button type="submit" className={styles.teamAddButton} disabled={isUpdatingTeam}>
                  {isUpdatingTeam ? "Adding…" : "Add Member"}
                </button>
              </div>
              {teamModalError ? <p className={styles.teamError}>{teamModalError}</p> : null}
              <p className={styles.teamHint}>
                Owners and collaborators can participate in live chat, comments, and version history.
              </p>
            </form>
          </div>
        </div>
      ) : null}

      {/* Image Modal */}
      {isImageModalOpen && (
        <div className={styles.teamModalOverlay} role="dialog" aria-modal="true" aria-labelledby="image-modal-title">
          <div className={styles.teamModal}>
            <div className={styles.teamModalHeader}>
              <h2 id="image-modal-title">Add image</h2>
              <button
                type="button"
                className={styles.teamModalClose}
                onClick={() => {
                  setIsImageModalOpen(false);
                  setImageFile(null);
                  setImagePreview("");
                }}
                aria-label="Close image modal"
              >
                ✕
              </button>
            </div>
            <div className={styles.teamModalSection}>
              <label htmlFor="image-file-input" className={styles.teamInputLabel}>
                Select image from your computer
              </label>
              <input
                id="image-file-input"
                type="file"
                accept="image/*"
                className={styles.teamInput}
                onChange={handleImageFileSelect}
                style={{ padding: "8px" }}
              />
              
              {/* Preview */}
              {imagePreview && (
                <div style={{ marginTop: 16, textAlign: "center" }}>
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    style={{ 
                      maxWidth: "100%", 
                      maxHeight: "300px", 
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb"
                    }} 
                  />
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, gap: 8 }}>
                <button
                  type="button"
                  className={styles.teamRemoveButton}
                  onClick={() => {
                    setIsImageModalOpen(false);
                    setImageFile(null);
                    setImagePreview("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.teamAddButton}
                  onClick={() => void handleSaveImage()}
                  disabled={!imageFile}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Background Modal */}
      {isBackgroundModalOpen && (
        <div className={styles.teamModalOverlay} role="dialog" aria-modal="true" aria-labelledby="background-modal-title">
          <div className={styles.teamModal}>
            <div className={styles.teamModalHeader}>
              <h2 id="background-modal-title">Slide background</h2>
              <button
                type="button"
                className={styles.teamModalClose}
                onClick={() => setIsBackgroundModalOpen(false)}
                aria-label="Close background modal"
              >
                ✕
              </button>
            </div>
            <div className={styles.teamModalSection}>
              <div className={styles.backgroundOptions}>
                <button
                  type="button"
                  className={styles.backgroundOption}
                  onClick={() => void handleSetBackgroundStyle("default")}
                  style={{
                    backgroundColor: presentationBackground === "default" ? "#e0e7ff" : "#f3f4f6",
                    borderColor: presentationBackground === "default" ? "#6366f1" : "#d1d5db",
                  }}
                >
                  Default
                </button>
                <button
                  type="button"
                  className={styles.backgroundOption}
                  onClick={() => void handleSetBackgroundStyle("soft")}
                  style={{
                    backgroundColor: presentationBackground === "soft" ? "#e0e7ff" : "#f3f4f6",
                    borderColor: presentationBackground === "soft" ? "#6366f1" : "#d1d5db",
                  }}
                >
                  Soft
                </button>
                <button
                  type="button"
                  className={styles.backgroundOption}
                  onClick={() => void handleSetBackgroundStyle("dark")}
                  style={{
                    backgroundColor: presentationBackground === "dark" ? "#e0e7ff" : "#f3f4f6",
                    borderColor: presentationBackground === "dark" ? "#6366f1" : "#d1d5db",
                  }}
                >
                  Dark
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Layout Modal */}
      {isLayoutModalOpen && (
        <div className={styles.teamModalOverlay} role="dialog" aria-modal="true" aria-labelledby="layout-modal-title">
          <div className={styles.teamModal}>
            <div className={styles.teamModalHeader}>
              <h2 id="layout-modal-title">Slide layout</h2>
              <button
                type="button"
                className={styles.teamModalClose}
                onClick={() => setIsLayoutModalOpen(false)}
                aria-label="Close layout modal"
              >
                ✕
              </button>
            </div>
            <div className={styles.teamModalSection}>
              <div className={styles.layoutOptions}>
                <button
                  type="button"
                  className={styles.layoutOption}
                  onClick={() => void handleSetLayout("layout1")}
                  style={{
                    backgroundColor: selectedSlide?.layout === "layout1" ? "#e0e7ff" : "#f3f4f6",
                    borderColor: selectedSlide?.layout === "layout1" ? "#6366f1" : "#d1d5db",
                  }}
                >
                  Title only
                </button>
                <button
                  type="button"
                  className={styles.layoutOption}
                  onClick={() => void handleSetLayout("layout2")}
                  style={{
                    backgroundColor: (selectedSlide?.layout === "layout2" || !selectedSlide?.layout) ? "#e0e7ff" : "#f3f4f6",
                    borderColor: (selectedSlide?.layout === "layout2" || !selectedSlide?.layout) ? "#6366f1" : "#d1d5db",
                  }}
                >
                  Title + Subtitle
                </button>
                <button
                  type="button"
                  className={styles.layoutOption}
                  onClick={() => void handleSetLayout("layout3")}
                  style={{
                    backgroundColor: selectedSlide?.layout === "layout3" ? "#e0e7ff" : "#f3f4f6",
                    borderColor: selectedSlide?.layout === "layout3" ? "#6366f1" : "#d1d5db",
                  }}
                >
                  Two-column text
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <TeamChatWidget 
        presentationId={presentationId} 
        canChat={canChat} 
        teamRoles={teamRoles} 
        ownerId={presentationOwnerId}
        currentUserId={resolvedUserId}
        currentUserEmail={resolvedUserEmail}
      />
    </div>
  );
}


