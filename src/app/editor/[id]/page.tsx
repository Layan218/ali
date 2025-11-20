"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import TeamChatWidget from "@/components/TeamChatWidget";
import styles from "./editor.module.css";
import EditorToolbar from "@/components/EditorToolbar";
import {
  markPresentationSaved,
  readPresentationMeta,
  updatePresentationStatus,
} from "@/lib/presentationMeta";
import { AITemplateConfig, getAITemplateStyles } from "@/lib/aiTemplate";
import { themes as presentationThemes, getThemeByName, type PresentationTheme } from "@/lib/presentationThemes";

const VIEWER_RETURN_KEY = "viewer-return-url";
const VIEWER_STATE_KEY = "viewer-state";

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

type AlignOption = "left" | "center" | "right";

type SlideFormatting = Record<FieldKey, { lineHeight: number }>;

type SlideData = {
  id: string;
  order?: number;
  title: string;
  subtitle: string;
  content?: string; // For AI template slides
  notes: string;
  theme: string;
  templateId?: string; // AI template identifier
  formatting: SlideFormatting;
};

type VersionSnapshotSlide = {
  slideId: string;
  order: number;
  title: string;
  encryptedContent: string;
  encryptedNotes: string;
  theme: string;
};

type PresentationVersion = {
  id: string;
  createdAt: Date | null;
  createdBy: string | null;
  summary: string;
  slidesSnapshot: VersionSnapshotSlide[];
};

type ThemeOption = {
  name: string;
  swatch: string;
};

type FieldKey = "title" | "subtitle" | "notes";

type CommentItem = {
  id: string;
  author: string;
  message: string;
  timestamp: string;
};

type CommandState = {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
  highlight: string;
  align: AlignOption;
  listType: "none" | "bullet" | "number";
};

const formattingButtons = ["Undo", "Redo", "Image", "Background", "Layout", "Theme", "Transition"] as const;
const fontFamilies = ["Calibri", "Arial", "Roboto"];
const fontSizes = [12, 14, 18, 24, 32, 40];
const lineSpacingOptions = [1, 1.15, 1.5, 2];

const colorOptions = [
  { name: "Default", value: "#202124" },
  { name: "Teal", value: "#56c1b0" },
  { name: "Slate", value: "#1e293b" },
  { name: "Cloud", value: "#9ca3af" },
];

const highlightOptions = [
  { name: "None", value: "transparent" },
  { name: "Teal", value: "rgba(86, 193, 176, 0.25)" },
  { name: "Sunrise", value: "rgba(250, 204, 21, 0.3)" },
  { name: "Slate", value: "rgba(148, 163, 184, 0.28)" },
];

const FONT_SIZE_TO_COMMAND: Record<number, string> = {
  12: "2",
  14: "3",
  18: "4",
  24: "5",
  32: "6",
  40: "7",
};

const COMMAND_TO_FONT_SIZE: Record<string, number> = {
  "1": 12,
  "2": 12,
  "3": 14,
  "4": 18,
  "5": 24,
  "6": 32,
  "7": 40,
};

const placeholderMap: Record<FieldKey, string> = {
  title: "Click to add title",
  subtitle: "Click to add subtitle",
  notes: "",
};

const DEFAULT_THEME = "Aramco Classic";

const DEFAULT_FORMATTING: SlideFormatting = {
  title: { lineHeight: 1.2 },
  subtitle: { lineHeight: 1.3 },
  notes: { lineHeight: 1.4 },
};

const createDefaultFormatting = (): SlideFormatting => ({
  title: { lineHeight: DEFAULT_FORMATTING.title.lineHeight },
  subtitle: { lineHeight: DEFAULT_FORMATTING.subtitle.lineHeight },
  notes: { lineHeight: DEFAULT_FORMATTING.notes.lineHeight },
});

const ensureFormatting = (formatting?: SlideFormatting): SlideFormatting => ({
  title: { lineHeight: formatting?.title?.lineHeight ?? DEFAULT_FORMATTING.title.lineHeight },
  subtitle: { lineHeight: formatting?.subtitle?.lineHeight ?? DEFAULT_FORMATTING.subtitle.lineHeight },
  notes: { lineHeight: formatting?.notes?.lineHeight ?? DEFAULT_FORMATTING.notes.lineHeight },
});

const fieldKeyMap: Record<FieldKey, keyof SlideData> = {
  title: "title",
  subtitle: "subtitle",
  notes: "notes",
};

const themes: ThemeOption[] = [
  { name: "Aramco Classic", swatch: "linear-gradient(135deg, #0d9488 0%, #5eead4 100%)" },
  { name: "Desert Dusk", swatch: "linear-gradient(135deg, #d97706 0%, #fde68a 100%)" },
  { name: "Executive Slate", swatch: "linear-gradient(135deg, #1e293b 0%, #64748b 100%)" },
  { name: "Innovation Sky", swatch: "linear-gradient(135deg, #0284c7 0%, #7dd3fc 100%)" },
];

const INITIAL_THEME = themes[0]?.name ?? DEFAULT_THEME;

const initialComments: CommentItem[] = [
  {
    id: "comment-1",
    author: "Maya Al-Hassan",
    message: "Consider adding a data visualization on slide 2 for the revenue breakdown.",
    timestamp: "10:24 AM",
  },
  {
    id: "comment-2",
    author: "Omar Khalid",
    message: "Slide 1 title looks great in teal — let's keep that consistent throughout.",
    timestamp: "11:03 AM",
  },
  {
    id: "comment-3",
    author: "Layla Nassar",
    message: "Add a transition note for the executive summary slide.",
    timestamp: "12:47 PM",
  },
];

function formatTitleFromId(id: string) {
  if (!id) return "Untitled presentation";
  return id
    .split("-")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

const initialSlides: SlideData[] = [
  {
    id: "slide-1",
    order: 1,
    title: placeholderMap.title,
    subtitle: placeholderMap.subtitle,
    notes: "",
    theme: INITIAL_THEME,
    formatting: createDefaultFormatting(),
  },
  {
    id: "slide-2",
    order: 2,
    title: placeholderMap.title,
    subtitle: placeholderMap.subtitle,
    notes: "",
    theme: INITIAL_THEME,
    formatting: createDefaultFormatting(),
  },
  {
    id: "slide-3",
    order: 3,
    title: placeholderMap.title,
    subtitle: placeholderMap.subtitle,
    notes: "",
    theme: INITIAL_THEME,
    formatting: createDefaultFormatting(),
  },
];

export default function EditorPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const presentationId = searchParams.get("presentationId");
  const { theme, toggleTheme, mounted } = useTheme();
  const isDark = mounted && theme === "dark";
  const [presentationTitle, setPresentationTitle] = useState(() => formatTitleFromId(params.id));
  const [slides, setSlides] = useState<SlideData[]>(initialSlides);
  const [selectedSlideId, setSelectedSlideId] = useState(initialSlides[0].id);
  const [status, setStatus] = useState<"draft" | "final">("draft");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusToastVariant, setStatusToastVariant] = useState<"draft" | "final" | null>(null);
  const [activeField, setActiveField] = useState<FieldKey>("title");
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isHighlightPickerOpen, setIsHighlightPickerOpen] = useState(false);
  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>(initialComments);
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
  const storageKey = useMemo(() => `presentation-${params.id}-slides`, [params.id]);
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
    () => slides.find((slide) => slide.id === selectedSlideId) ?? slides[0],
    [selectedSlideId, slides]
  );
  const selectedThemeName = selectedSlide?.theme ?? themes[0]?.name ?? DEFAULT_THEME;
  const activeTheme = getThemeByName(selectedThemeName) || presentationThemes["aramco-classic"];
  const currentSlideIndex = slides.findIndex((slide) => slide.id === selectedSlideId);
  const isFirstSlide = currentSlideIndex <= 0;
  const isLastSlide = currentSlideIndex === slides.length - 1;
  const canDeleteSlide = slides.length > 1;

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
      const presentationSnap = await getDoc(presentationRef);
      
      if (!presentationSnap.exists()) {
        console.warn("Presentation not found in Firestore");
        setIsLoadingFromFirestore(false);
        setPresentationOwnerId(null);
        setPresentationCollaboratorIds([]);
        return;
      }

      const presentationData = presentationSnap.data();
      if (presentationData?.title) {
        setPresentationTitle(presentationData.title);
      }
      if (presentationData?.status === "final" || presentationData?.status === "draft") {
        setStatus(presentationData.status);
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
            roles[key] = value;
          }
        }
        setTeamRoles(roles);
      } else {
        setTeamRoles({});
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
      const slidesSnap = await getDocs(slidesQuery);

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
              title: data.title || placeholderMap.title,
              subtitle: typeof data.subtitle === "string" ? decryptText(data.subtitle) || data.subtitle : (finalContent || placeholderMap.subtitle),
              content: typeof data.content === "string" && data.content.length > 0 ? (decryptText(data.content) || data.content) : undefined,
              notes: finalNotes,
              theme: data.theme || themes[0]?.name || DEFAULT_THEME,
              templateId: typeof data.templateId === "string" ? data.templateId : undefined,
              formatting: ensureFormatting(data.formatting),
            };
          })
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        setSlides(loadedSlides);
        
        // Set selected slide based on slideId from URL or first slide
        const urlSlideId = explicitSlideId ?? searchParams.get("slideId");
        if (urlSlideId && loadedSlides.some((s) => s.id === urlSlideId)) {
          setSelectedSlideId(urlSlideId);
          if (explicitSlideId && urlSlideId !== searchParams.get("slideId")) {
            router.replace(
              `/editor?presentationId=${encodeURIComponent(presentationId)}&slideId=${encodeURIComponent(urlSlideId)}`
            );
          }
        } else if (loadedSlides.length > 0) {
          const fallbackId = loadedSlides[0].id;
          setSelectedSlideId(fallbackId);
          if (!explicitSlideId && urlSlideId && !loadedSlides.some((s) => s.id === urlSlideId)) {
            router.replace(
              `/editor?presentationId=${encodeURIComponent(presentationId)}&slideId=${encodeURIComponent(fallbackId)}`
            );
          }
          if (explicitSlideId) {
            router.replace(
              `/editor?presentationId=${encodeURIComponent(presentationId)}&slideId=${encodeURIComponent(fallbackId)}`
            );
          }
        }
      } else {
        // No slides found, create a default one
        const defaultSlide: SlideData = {
          id: `slide-${Date.now()}`,
          title: placeholderMap.title,
          subtitle: placeholderMap.subtitle,
          notes: "",
          theme: themes[0]?.name || DEFAULT_THEME,
          formatting: createDefaultFormatting(),
        };
        setSlides([defaultSlide]);
        setSelectedSlideId(defaultSlide.id);
      }

      setHasLoadedFromFirestore(true);
    } catch (error) {
      console.error("Failed to load from Firestore:", error);
    } finally {
      setIsLoadingFromFirestore(false);
    }
  },
  [presentationId, hasLoadedFromFirestore, searchParams, router]
);

  // Theme is managed by useTheme hook - no need for separate useEffect

  // Load from Firestore if presentationId is available
  useEffect(() => {
    if (presentationId && !hasLoadedFromFirestore && !isLoadingFromFirestore) {
      void loadFromFirestore();
    }
  }, [presentationId, hasLoadedFromFirestore, isLoadingFromFirestore, loadFromFirestore]);

  // Update URL when selectedSlideId changes (for Firestore mode)
  useEffect(() => {
    if (presentationId && hasLoadedFromFirestore && selectedSlideId) {
      const currentSlideId = searchParams.get("slideId");
      if (currentSlideId !== selectedSlideId) {
        router.replace(`/editor?presentationId=${encodeURIComponent(presentationId)}&slideId=${encodeURIComponent(selectedSlideId)}`);
      }
    }
  }, [selectedSlideId, presentationId, hasLoadedFromFirestore, searchParams, router]);

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
  useEffect(() => {
    if (!presentationId || !hasLoadedFromFirestore) return;
    const urlSlideId = searchParams.get("slideId");
    if (urlSlideId && urlSlideId !== selectedSlideId && slides.some((s) => s.id === urlSlideId)) {
      setSelectedSlideId(urlSlideId);
    }
  }, [searchParams, presentationId, hasLoadedFromFirestore, slides, selectedSlideId]);

  // Fallback to localStorage if no presentationId (legacy mode)
  useEffect(() => {
    if (presentationId || hasLoadedFromFirestore) return; // Skip if using Firestore
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as SlideData[];
      if (!Array.isArray(parsed) || parsed.length === 0) return;
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
    } catch (error) {
      console.error("Failed to load slides from storage", error);
    } finally {
      hasHydratedRef.current = true;
    }
  }, [storageKey, presentationId, hasLoadedFromFirestore]);

  // Subscribe to Firestore comments
  useEffect(() => {
    if (!presentationId) return;

    const commentsRef = collection(db, "presentations", presentationId, "comments");
    const commentsQuery = query(commentsRef, orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(
      commentsQuery,
      (snapshot) => {
        const items: CommentItem[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const rawText = typeof data.text === "string" ? data.text : "";
          const decrypted = rawText ? decryptText(rawText) : "";
          const finalText = decrypted || rawText || "";

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
  useEffect(() => {
    if (!selectedSlide) return;
    const formatting = selectedSlide.formatting ?? DEFAULT_FORMATTING;
    const slideChanged = prevSlideIdRef.current !== selectedSlide.id;
    prevSlideIdRef.current = selectedSlide.id;
    
    // When slide changes, always update content
    // When same slide, only update if field is NOT focused (user is not typing)
    const shouldUpdateTitle = slideChanged || document.activeElement !== titleRef.current;
    const shouldUpdateSubtitle = slideChanged || document.activeElement !== subtitleRef.current;
    
    if (titleRef.current && shouldUpdateTitle) {
      const currentContent = titleRef.current.innerHTML.trim();
      const newContent = selectedSlide.title || placeholderMap.title;
      // Only update if content actually changed
      if (currentContent !== newContent) {
        titleRef.current.innerHTML = newContent;
      }
      titleRef.current.style.lineHeight = `${formatting.title.lineHeight}`;
    }
    if (subtitleRef.current && shouldUpdateSubtitle) {
      const currentContent = subtitleRef.current.innerHTML.trim();
      const newContent = selectedSlide.subtitle || placeholderMap.subtitle;
      // Only update if content actually changed
      if (currentContent !== newContent) {
        subtitleRef.current.innerHTML = newContent;
      }
      subtitleRef.current.style.lineHeight = `${formatting.subtitle.lineHeight}`;
    }
    if (notesRef.current) {
      notesRef.current.style.lineHeight = `${formatting.notes.lineHeight}`;
    }
  }, [selectedSlide?.id, selectedSlide?.title, selectedSlide?.subtitle]); // Update when slide or content changes

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
  };

  const handleContentBlur = (field: FieldKey) => {
    const ref = getFieldRef(field);
    if (!ref) return;
    const text = ref.textContent?.replace(/\u00a0/g, " ").trim() ?? "";
    if (!text) {
      ref.innerHTML = placeholderMap[field];
      updateSlideField(fieldKeyMap[field], placeholderMap[field]);
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
    updateSlideField("notes", value);
    autoResizeNotes(event.target);
  };

  const handleNotesFocus = () => {
    setActiveField("notes");
    setIsColorPickerOpen(false);
    setIsHighlightPickerOpen(false);
  };

  const autoResizeNotes = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 80), 400)}px`;
  };

  const handleThemeSelect = useCallback(
    (themeName: string) => {
      // Apply theme to all slides in the deck
      setSlides((prev) =>
        prev.map((slide) => ({
                ...slide,
                theme: themeName,
        }))
      );
      
      // Also update the presentation document if we have a presentationId
      if (presentationId) {
        const presentationRef = doc(db, "presentations", presentationId);
        setDoc(presentationRef, { theme: themeName, themeId: getThemeByName(themeName)?.id || "aramco-classic" }, { merge: true }).catch(console.error);
      }
    },
    [presentationId]
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

  const applyUndo = () => execWithCommand("undo");
  const applyRedo = () => execWithCommand("redo");

  const updateSlideField = (field: keyof SlideData, value: string) => {
    setSlides((prev) =>
      prev.map((slide) => (slide.id === selectedSlideId ? { ...slide, [field]: value } : slide))
    );
  };

  const handleAddSlide = async () => {
      const themeName = selectedThemeName || themes[0]?.name || DEFAULT_THEME;

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
      router.push(
        `/editor?presentationId=${encodeURIComponent(presentationId)}&slideId=${encodeURIComponent(newSlideId)}`
      );
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
    
    const currentUser = auth.currentUser;
    
    if (!presentationId) {
      // Fallback to localStorage if no presentationId
      const slideSummary = slides.map((slide) => ({
        id: slide.id,
        title: typeof slide.title === "string" ? slide.title : "",
        subtitle: typeof slide.subtitle === "string" ? slide.subtitle : "",
        notes: typeof slide.notes === "string" ? slide.notes : "",
      }));
      markPresentationSaved(presentationId || params.id, presentationTitle, slideSummary, status);
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
        presentationData.ownerId = currentUser.uid;
        presentationData.isShared = true; // Mark as shared for team dashboard
      } else if (currentUser) {
        // For private saves, ensure ownerId is set but mark as private
        presentationData.ownerId = currentUser.uid;
        presentationData.isShared = false; // Mark as private
      }

      await setDoc(presentationRef, presentationData, { merge: true });

      // Save all slides
      for (const slide of slides) {
        const slideIndex = slides.findIndex((s) => s.id === slide.id);
        const slideRef = doc(db, "presentations", presentationId, "slides", slide.id);
        const plainContent =
          typeof slide.subtitle === "string" ? slide.subtitle : placeholderMap.subtitle;
        const plainNotes = typeof slide.notes === "string" ? slide.notes : "";
        const encryptedContent = encryptText(plainContent);
        const encryptedNotes = encryptText(plainNotes);

        await setDoc(
          slideRef,
          {
            order: slideIndex + 1,
            title: typeof slide.title === "string" ? slide.title : "",
            content: encryptedContent,
            notes: encryptedNotes,
            theme: slide.theme || "default",
            formatting: slide.formatting || createDefaultFormatting(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
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
        await logAuditEvent({
          presentationId,
          userId: currentUser.uid,
          userEmail: currentUser.email,
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

    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error("Cannot share: user not authenticated");
      return;
    }

    try {
      // Save with isShared=true to make it appear in team dashboard
      await handleSaveSlide(true);

      // Redirect to dashboard to see the shared presentation
      window.location.href = "http://localhost:3006/dashboard";
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
    router.push(
      `/editor?presentationId=${encodeURIComponent(presentationId)}&slideId=${encodeURIComponent(nextSlide.id)}`
    );
  };

  const moveSlide = (direction: "up" | "down") => {
    setSlides((prev) => {
      const index = prev.findIndex((slide) => slide.id === selectedSlideId);
      if (index === -1) return prev;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const nextSlides = [...prev];
      const [moving] = nextSlides.splice(index, 1);
      nextSlides.splice(targetIndex, 0, moving);
      return nextSlides;
    });
  };

  const handleMoveUp = () => {
    if (isFirstSlide) return;
    moveSlide("up");
  };

  const handleMoveDown = () => {
    if (isLastSlide) return;
    moveSlide("down");
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
      const encryptedText = encryptText(trimmed);
      const commentRef = await addDoc(collection(db, "presentations", presentationId, "comments"), {
        userId,
        userName,
        text: encryptedText,
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
        const updatedRoles: Record<string, "owner" | "editor" | "viewer"> = { ...teamRoles, [normalizedValue]: "editor" };
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
      const updatedRoles: Record<string, "owner" | "editor" | "viewer"> = { ...teamRoles, [member]: newRole };
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
          router.replace(
            `/editor?presentationId=${encodeURIComponent(presentationId)}&slideId=${encodeURIComponent(firstSlideId)}`
          );
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
  }, [handleSaveVersion, handleRestoreVersion, versions, isSavingVersion, isRestoringVersion]);

  const toolbarDisabled = selectedSlide == null || status === "final";

  const highlightIndicatorStyle: CSSProperties =
    commandState.highlight === "transparent"
      ? {}
      : { backgroundColor: commandState.highlight };

  const toolbarActions: Record<string, () => void> = {
    Undo: applyUndo,
    Redo: applyRedo,
    Image: () => undefined,
    Background: () => undefined,
    Layout: () => undefined,
    Theme: () => undefined,
    Transition: () => undefined,
  };

  const currentFormatting = selectedSlide ? ensureFormatting(selectedSlide.formatting) : DEFAULT_FORMATTING;

  const isAITemplate = selectedSlide?.templateId === "ai-modern";
  const aiStyles = isAITemplate ? getAITemplateStyles() : null;

  const getTextStyle = (field: FieldKey): CSSProperties => {
    const baseStyle: CSSProperties = {
    lineHeight: `${currentFormatting[field]?.lineHeight ?? DEFAULT_FORMATTING[field].lineHeight}`,
    whiteSpace: "pre-wrap",
    };

    // Apply theme styles
    if (field === "title") {
      return {
        ...baseStyle,
        fontSize: activeTheme.titleFontSize,
        fontWeight: activeTheme.titleFontWeight,
        color: activeTheme.titleColor,
        lineHeight: activeTheme.titleLineHeight,
        textAlign: "center" as const,
        marginBottom: "clamp(16px, 2vw, 24px)",
      };
    } else if (field === "subtitle") {
      return {
        ...baseStyle,
        fontSize: activeTheme.bulletFontSize,
        fontWeight: activeTheme.bulletFontWeight,
        color: activeTheme.bulletColor,
        lineHeight: activeTheme.bulletLineHeight,
        textAlign: "center" as const,
        marginBottom: "clamp(24px, 3vw, 40px)",
      };
    }

    return baseStyle;
  };

  const handleOpenSlideshow = () => {
    const fallbackId = slides[0]?.id ?? "";
    const targetId = selectedSlideId || fallbackId;
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(VIEWER_RETURN_KEY, `${window.location.pathname}${window.location.search}`);
      const viewerPayload = {
        presentationId,
        slideId: targetId,
        presentationTitle,
        slides: slides.map((slide) => ({
          id: slide.id,
          title: typeof slide.title === "string" ? slide.title : "",
          subtitle: typeof slide.subtitle === "string" ? slide.subtitle : "",
          notes: typeof slide.notes === "string" ? slide.notes : "",
        })),
      };
      try {
        window.sessionStorage.setItem(VIEWER_STATE_KEY, JSON.stringify(viewerPayload));
      } catch (error) {
        console.error("Failed to store viewer payload", error);
      }
    }
    router.push("/viewer");
  };

  const toggleColorPicker = () => setIsColorPickerOpen((prev) => !prev);
  const toggleHighlightPicker = () => setIsHighlightPickerOpen((prev) => !prev);
  const toggleThemePicker = () => setIsThemePickerOpen((prev) => !prev);
  const currentLineHeight =
    currentFormatting[activeField]?.lineHeight ?? DEFAULT_FORMATTING[activeField]?.lineHeight ?? 1.2;

  const isReadOnly = status === "final";

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
  }, [presentationId, presentationOwnerId, resolvedUserId, resolvedUserEmail, collaborators, collaboratorsLowerSet]);
  const isOwner = Boolean(presentationOwnerId && resolvedUserId && resolvedUserId === presentationOwnerId);

  return (
    <>
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

      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.editorShell}>
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
                    Back to Home
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
                  <button 
                    type="button" 
                    className={styles.shareButton}
                    onClick={handleShare}
                  >
                    Share
                  </button>
                  <button type="button" className={styles.slideshowButton} onClick={handleOpenSlideshow}>
                    Slideshow
                  </button>
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
                  onBold={toggleBold}
                  onItalic={toggleItalic}
                  onUnderline={toggleUnderline}
                  onTextColorSelect={applyTextColor}
                  onHighlightColorSelect={applyHighlightColor}
                  onAlign={applyAlign}
                  onList={applyList}
                  onLineHeightChange={applyLineHeight}
                  onUndo={applyUndo}
                  onRedo={applyRedo}
                  onToolbarMouseDown={handleToolbarMouseDown}
                  onRestoreSelection={restoreSelection}
                  lineHeightValue={currentLineHeight}
                  themes={themes}
                  selectedTheme={selectedThemeName}
                  onThemeSelect={handleThemeSelect}
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
                      className={styles.canvasSurface}
                      style={{
                        background: activeTheme.slideBackground,
                        border: activeTheme.canvasBorder,
                        boxShadow: activeTheme.canvasShadow,
                        position: "relative",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        padding: "clamp(48px, 5vw, 72px)",
                        gap: "clamp(16px, 2vw, 24px)",
                      }}
                    >
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
                        }}
                        data-readonly={isReadOnly}
                      />
                    {/* For AI template: Show subtitle only for title slide, content for other slides */}
                    {isAITemplate ? (
                      <>
                        {/* Title slide: show subtitle */}
                        {selectedSlide?.subtitle && (
                          <div
                            ref={subtitleRef}
                            className={styles.slideSubtitleInput}
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
                              textAlign: "center",
                            }}
                            data-readonly={isReadOnly}
                          />
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
                              // Parse numbered sections (e.g., "1. Overview", "2. Key Concepts")
                              const lines = selectedSlide.content
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
                                        lineHeight: activeTheme.bulletLineHeight,
                                        minHeight: "1.5em",
                                        width: "100%",
                                      }}
                                    >
                                      <span 
                                        style={{ 
                                          marginRight: "1rem", 
                                          color: activeTheme.titleColor,
                                          fontSize: activeTheme.bulletFontSize,
                                          fontWeight: 600,
                                          lineHeight: activeTheme.bulletLineHeight,
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
                                          fontSize: activeTheme.bulletFontSize,
                                          fontWeight: activeTheme.bulletFontWeight,
                                          color: activeTheme.bulletColor,
                                          lineHeight: activeTheme.bulletLineHeight,
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
                                      lineHeight: activeTheme.bulletLineHeight,
                                      wordBreak: "break-word",
                                      minHeight: "1.5em",
                                      width: "100%",
                                      fontSize: activeTheme.bulletFontSize,
                                      fontWeight: activeTheme.bulletFontWeight,
                                      color: activeTheme.bulletColor,
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
                              // Clean and deduplicate content
                              const lines = selectedSlide.content
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
                                        lineHeight: activeTheme.bulletLineHeight,
                                        minHeight: "1.5em",
                                        width: "100%",
                                      }}
                                    >
                                      <span 
                                        style={{ 
                                          marginRight: "0.75rem", 
                                          color: activeTheme.titleColor,
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
                                          fontSize: activeTheme.bulletFontSize,
                                          fontWeight: activeTheme.bulletFontWeight,
                                          color: activeTheme.bulletColor,
                                          lineHeight: activeTheme.bulletLineHeight,
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
                                      lineHeight: activeTheme.bulletLineHeight,
                                      wordBreak: "break-word",
                                      minHeight: "1.5em",
                                      width: "100%",
                                      fontSize: activeTheme.bulletFontSize,
                                      fontWeight: activeTheme.bulletFontWeight,
                                      color: activeTheme.bulletColor,
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
                        <div
                          ref={subtitleRef}
                          className={styles.slideSubtitleInput}
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
                    )}
                    </div>
                    <div className={styles.canvasActionBar}>
                      <button 
                        type="button" 
                        onClick={() => handleSaveSlide(false)} 
                        className={`${styles.canvasActionButton} ${styles.canvasActionPrimary}`}
                        style={{
                          backgroundColor: activeTheme.buttonPrimaryBg,
                          color: activeTheme.buttonPrimaryColor,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = activeTheme.buttonPrimaryHover;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = activeTheme.buttonPrimaryBg;
                        }}
                      >
                        Save
                      </button>
                      <button 
                        type="button" 
                        onClick={handleShare}
                        className={`${styles.canvasActionButton} ${styles.canvasActionSecondary}`}
                        style={{
                          backgroundColor: activeTheme.buttonSecondaryBg,
                          color: activeTheme.buttonSecondaryColor,
                          borderColor: activeTheme.buttonSecondaryBorder,
                        }}
                      >
                        Share
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenSlideshow}
                        style={{
                          backgroundColor: activeTheme.buttonPrimaryBg,
                          color: activeTheme.buttonPrimaryColor,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = activeTheme.buttonPrimaryHover;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = activeTheme.buttonPrimaryBg;
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
                        <span className={styles.badge}>Private</span>
                      </header>
                      <textarea
                        id="speaker-notes"
                        ref={notesRef}
                        className={styles.notesTextarea}
                        value={selectedSlide?.notes ?? ""}
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
                      {comments.map((comment) => (
                        <div key={comment.id} className={styles.commentCard}>
                          <div className={styles.commentMeta}>
                            <span>{comment.author}</span>
                            <span>{comment.timestamp}</span>
                          </div>
                          <p className="mt-3 text-slate-700 leading-relaxed">{comment.message}</p>
                        </div>
                      ))}
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
          </div>

          <footer className={styles.footer}>© 2025 Aramco Digital – Secure Presentation Tool</footer>
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

      <TeamChatWidget presentationId={presentationId} canChat={canChat} teamRoles={teamRoles} ownerId={presentationOwnerId} />
    </>
  );
}


