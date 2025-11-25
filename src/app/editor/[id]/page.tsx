"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { createPortal } from "react-dom";
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
import TeamChatWidget from "@/components/TeamChatWidget";
import ThemeToggle from "@/components/ThemeToggle";
import { useTheme } from "@/hooks/useTheme";
import SmartAssistantPanel from "@/components/SmartAssistantPanel";
import type { SlideContent, PresentationContext } from "@/services/smartAssistantService";
import styles from "./editor.module.css";
import EditorToolbar from "@/components/EditorToolbar";
import {
  markPresentationSaved,
  readPresentationMeta,
  updatePresentationStatus,
} from "@/lib/presentationMeta";
import { saveSlidesToFirebase } from "@/lib/saveSlidesToFirebase";
import { AITemplateConfig, getAITemplateStyles } from "@/lib/aiTemplate";
import { presentationThemes, getThemeByName, type PresentationTheme } from "@/lib/presentationThemes";

const VIEWER_RETURN_KEY = "viewer-return-url";
const VIEWER_STATE_KEY = "viewer-state";

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

type AlignOption = "left" | "center" | "right";

type SlideFormatting = Record<FieldKey, { lineHeight: number }>;

type TitleStyle = {
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  letterSpacing: number;
};

type TitlePosition = {
  x: number;
  y: number;
  zIndex: number;
};

type TitleAnimation = {
  type: "none" | "fade-in" | "slide-in" | "marquee";
  duration: number; // in seconds
  loop: boolean;
};

type SubtitleStyle = {
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  letterSpacing: number;
};

type SubtitlePosition = {
  x: number;
  y: number;
  zIndex: number;
};

type TextBoxStyle = {
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  letterSpacing: number;
};

type TextBoxPosition = {
  x: number;
  y: number;
  zIndex: number;
};

type TextBox = {
  id: string;
  text?: string;
  content?: string;
  style: TextBoxStyle;
  position: TextBoxPosition;
};

type SlideData = {
  id: string;
  title: string;
  subtitle: string;
  notes: string;
  theme: string;
  formatting: SlideFormatting;
  titleStyle?: TitleStyle;
  titlePosition?: TitlePosition;
  titleAnimation?: TitleAnimation;
  subtitleStyle?: SubtitleStyle;
  subtitlePosition?: SubtitlePosition;
  textBoxes?: TextBox[];
  backgroundImage?: string;
  backgroundColor?: string;
  layout?: "title-only" | "title-subtitle" | "title-content" | "blank";
  transition?: "none" | "fade" | "slide" | "zoom";
  slideType?: "cover" | "content" | "ending"; // SCDT slide type
  templateId?: string; // AI template identifier
};

type VersionSnapshotSlide = {
  slideId: string;
  order: number;
  title: string;
  encryptedContent: string;
  encryptedNotes: string;
  theme: string;
  slideType?: "cover" | "content" | "ending";
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

type FieldKey = "title" | "subtitle" | "notes" | "textbox";

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

const formattingButtons = ["Undo", "Redo", "Image", "Background", "Layout", "Theme", "Transition", "Add Text", "AI Assistant"] as const;
const fontFamilies = [
  "Calibri",
  "Arial",
  "Roboto",
  "Times New Roman",
  "Georgia",
  "Verdana",
  "Helvetica",
  "Courier New",
  "Comic Sans MS",
  "Impact",
  "Trebuchet MS",
  "Palatino",
  "Garamond",
  "Bookman",
  "Tahoma",
  "Lucida Console",
  "Monaco",
  "Consolas",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Raleway",
  "Ubuntu",
  "Oswald",
  "Playfair Display",
  "Merriweather",
  "Source Sans Pro",
  "PT Sans",
];
const fontSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96];
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
  textbox: "Click to add text",
};

const DEFAULT_THEME = "SCDT";

const DEFAULT_FORMATTING: SlideFormatting = {
  title: { lineHeight: 1.2 },
  subtitle: { lineHeight: 1.3 },
  notes: { lineHeight: 1.4 },
  textbox: { lineHeight: 1.5 },
};

const DEFAULT_TITLE_STYLE: TitleStyle = {
  fontFamily: "Calibri",
  fontSize: 48,
  color: "#202124",
  bold: false,
  italic: false,
  letterSpacing: 0,
};

const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontFamily: "Calibri",
  fontSize: 32,
  color: "#202124",
  bold: false,
  italic: false,
  letterSpacing: 0,
};

const DEFAULT_TITLE_POSITION: TitlePosition = {
  x: 0,
  y: 0,
  zIndex: 1,
};

const DEFAULT_SUBTITLE_POSITION: SubtitlePosition = {
  x: 0,
  y: 0,
  zIndex: 1,
};

const DEFAULT_TEXTBOX_STYLE: TextBoxStyle = {
  fontFamily: "Calibri",
  fontSize: 24,
  color: "#202124",
  bold: false,
  italic: false,
  letterSpacing: 0,
};

const DEFAULT_TEXTBOX_POSITION: TextBoxPosition = {
  x: 350, // Center horizontally in the slide content area (canvas is ~980px wide with ~64px padding each side = ~852px content, so ~350px is roughly center)
  y: 200, // Center vertically in the slide content area (canvas is ~550px tall with ~64px padding each side = ~422px content, so ~200px is roughly center)
  zIndex: 2,
};

const DEFAULT_TITLE_ANIMATION: TitleAnimation = {
  type: "none",
  duration: 1,
  loop: false,
};

const createDefaultFormatting = (): SlideFormatting => ({
  title: { lineHeight: DEFAULT_FORMATTING.title.lineHeight },
  subtitle: { lineHeight: DEFAULT_FORMATTING.subtitle.lineHeight },
  notes: { lineHeight: DEFAULT_FORMATTING.notes.lineHeight },
  textbox: { lineHeight: DEFAULT_FORMATTING.textbox.lineHeight },
});

const ensureFormatting = (formatting?: SlideFormatting): SlideFormatting => ({
  title: { lineHeight: formatting?.title?.lineHeight ?? DEFAULT_FORMATTING.title.lineHeight },
  subtitle: { lineHeight: formatting?.subtitle?.lineHeight ?? DEFAULT_FORMATTING.subtitle.lineHeight },
  notes: { lineHeight: formatting?.notes?.lineHeight ?? DEFAULT_FORMATTING.notes.lineHeight },
  textbox: { lineHeight: formatting?.textbox?.lineHeight ?? DEFAULT_FORMATTING.textbox.lineHeight },
});

const ensureTitleStyle = (style?: TitleStyle): TitleStyle => ({
  fontFamily: style?.fontFamily ?? DEFAULT_TITLE_STYLE.fontFamily,
  fontSize: style?.fontSize ?? DEFAULT_TITLE_STYLE.fontSize,
  color: style?.color ?? DEFAULT_TITLE_STYLE.color,
  bold: style?.bold ?? DEFAULT_TITLE_STYLE.bold,
  italic: style?.italic ?? DEFAULT_TITLE_STYLE.italic,
  letterSpacing: style?.letterSpacing ?? DEFAULT_TITLE_STYLE.letterSpacing,
});

const ensureTitlePosition = (position?: TitlePosition): TitlePosition => ({
  x: position?.x ?? DEFAULT_TITLE_POSITION.x,
  y: position?.y ?? DEFAULT_TITLE_POSITION.y,
  zIndex: position?.zIndex ?? DEFAULT_TITLE_POSITION.zIndex,
});

const ensureTitleAnimation = (animation?: TitleAnimation): TitleAnimation => ({
  type: animation?.type ?? DEFAULT_TITLE_ANIMATION.type,
  duration: animation?.duration ?? DEFAULT_TITLE_ANIMATION.duration,
  loop: animation?.loop ?? DEFAULT_TITLE_ANIMATION.loop,
});

const ensureSubtitleStyle = (style?: SubtitleStyle): SubtitleStyle => ({
  fontFamily: style?.fontFamily ?? DEFAULT_SUBTITLE_STYLE.fontFamily,
  fontSize: style?.fontSize ?? DEFAULT_SUBTITLE_STYLE.fontSize,
  color: style?.color ?? DEFAULT_SUBTITLE_STYLE.color,
  bold: style?.bold ?? DEFAULT_SUBTITLE_STYLE.bold,
  italic: style?.italic ?? DEFAULT_SUBTITLE_STYLE.italic,
  letterSpacing: style?.letterSpacing ?? DEFAULT_SUBTITLE_STYLE.letterSpacing,
});

const ensureSubtitlePosition = (position?: SubtitlePosition): SubtitlePosition => ({
  x: position?.x ?? DEFAULT_SUBTITLE_POSITION.x,
  y: position?.y ?? DEFAULT_SUBTITLE_POSITION.y,
  zIndex: position?.zIndex ?? DEFAULT_SUBTITLE_POSITION.zIndex,
});

const ensureTextBoxStyle = (style?: TextBoxStyle): TextBoxStyle => ({
  fontFamily: style?.fontFamily ?? DEFAULT_TEXTBOX_STYLE.fontFamily,
  fontSize: style?.fontSize ?? DEFAULT_TEXTBOX_STYLE.fontSize,
  color: style?.color ?? DEFAULT_TEXTBOX_STYLE.color,
  bold: style?.bold ?? DEFAULT_TEXTBOX_STYLE.bold,
  italic: style?.italic ?? DEFAULT_TEXTBOX_STYLE.italic,
  letterSpacing: style?.letterSpacing ?? DEFAULT_TEXTBOX_STYLE.letterSpacing,
});

const ensureTextBoxPosition = (position?: TextBoxPosition): TextBoxPosition => ({
  x: position?.x ?? DEFAULT_TEXTBOX_POSITION.x,
  y: position?.y ?? DEFAULT_TEXTBOX_POSITION.y,
  zIndex: position?.zIndex ?? DEFAULT_TEXTBOX_POSITION.zIndex,
});

const fieldKeyMap: Record<FieldKey, keyof SlideData> = {
  title: "title",
  subtitle: "subtitle",
  notes: "notes",
  textbox: "textBoxes",
};

const themes: ThemeOption[] = [
  { name: "Aramco Classic", swatch: "linear-gradient(135deg, #56c1b0 0%, #c7f4ec 100%)" },
  { name: "Desert Dusk", swatch: "linear-gradient(135deg, #f97316 0%, #fde68a 100%)" },
  { name: "Executive Slate", swatch: "linear-gradient(135deg, #1e293b 0%, #94a3b8 100%)" },
  { name: "Innovation Sky", swatch: "linear-gradient(135deg, #38bdf8 0%, #dbeafe 100%)" },
  { name: "SCDT", swatch: "linear-gradient(135deg, #1b3a4b 0%, #00b388 100%)" },
];

const INITIAL_THEME = themes[0]?.name ?? DEFAULT_THEME;

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
    title: placeholderMap.title,
    subtitle: placeholderMap.subtitle,
    notes: "",
    theme: INITIAL_THEME,
    slideType: "cover",
    formatting: createDefaultFormatting(),
    titleStyle: { ...DEFAULT_TITLE_STYLE },
    titlePosition: { ...DEFAULT_TITLE_POSITION },
    titleAnimation: { ...DEFAULT_TITLE_ANIMATION },
    subtitleStyle: { ...DEFAULT_SUBTITLE_STYLE },
    subtitlePosition: { ...DEFAULT_SUBTITLE_POSITION },
  },
  {
    id: "slide-2",
    title: placeholderMap.title,
    subtitle: placeholderMap.subtitle,
    notes: "",
    theme: INITIAL_THEME,
    slideType: "content",
    formatting: createDefaultFormatting(),
    titleStyle: { ...DEFAULT_TITLE_STYLE },
    titlePosition: { ...DEFAULT_TITLE_POSITION },
    titleAnimation: { ...DEFAULT_TITLE_ANIMATION },
    subtitleStyle: { ...DEFAULT_SUBTITLE_STYLE },
    subtitlePosition: { ...DEFAULT_SUBTITLE_POSITION },
  },
  {
    id: "slide-3",
    title: placeholderMap.title,
    subtitle: placeholderMap.subtitle,
    notes: "",
    theme: INITIAL_THEME,
    slideType: "ending",
    formatting: createDefaultFormatting(),
    titleStyle: { ...DEFAULT_TITLE_STYLE },
    titlePosition: { ...DEFAULT_TITLE_POSITION },
    titleAnimation: { ...DEFAULT_TITLE_ANIMATION },
    subtitleStyle: { ...DEFAULT_SUBTITLE_STYLE },
    subtitlePosition: { ...DEFAULT_SUBTITLE_POSITION },
  },
];

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const presentationId = searchParams.get("presentationId");
  const { theme, toggleTheme, mounted } = useTheme();
  const isDark = mounted && theme === "dark";
  const [presentationTitle, setPresentationTitle] = useState(() => formatTitleFromId(resolvedParams.id));
  const [slides, setSlides] = useState<SlideData[]>(initialSlides);
  const [selectedSlideId, setSelectedSlideId] = useState(initialSlides[0].id);
  const [status, setStatus] = useState<"draft" | "final">("draft");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusToastVariant, setStatusToastVariant] = useState<"draft" | "final" | null>(null);
  const [activeField, setActiveField] = useState<FieldKey>("title");
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isHighlightPickerOpen, setIsHighlightPickerOpen] = useState(false);
  const [customColorValue, setCustomColorValue] = useState("#202124");
  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [isBackgroundPickerOpen, setIsBackgroundPickerOpen] = useState(false);
  const [isLayoutPickerOpen, setIsLayoutPickerOpen] = useState(false);
  const [isTransitionPickerOpen, setIsTransitionPickerOpen] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newComment, setNewComment] = useState("");
  const storageKey = useMemo(() => `presentation-${resolvedParams.id}-slides`, [resolvedParams.id]);
  
  // Undo/Redo history
  const [history, setHistory] = useState<SlideData[][]>([initialSlides]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  // Animation state
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationPaused, setAnimationPaused] = useState(false);
  const animationRef = useRef<number | null>(null);

  // Voice-to-text state
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<any | null>(null);
  
  // Firestore and team collaboration state
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
  const textBoxRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const selectionRef = useRef<Range | null>(null);
  const hasHydratedRef = useRef(false);

  const isReadOnly = status === "final";

  // History management - defined early so it can be used in other callbacks
  const saveToHistory = useCallback((newSlides: SlideData[]) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newSlides))); // Deep clone
      return newHistory.slice(-50); // Keep last 50 states
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 49));
  }, [historyIndex]);

  // Update callbacks - defined early so they can be used in useEffects
  const updateSlideField = useCallback((field: keyof SlideData, value: string) => {
    setSlides((prev) => {
      const newSlides = prev.map((slide) => (slide.id === selectedSlideId ? { ...slide, [field]: value } : slide));
      saveToHistory(newSlides);
      return newSlides;
    });
  }, [selectedSlideId, saveToHistory]);

  const updateSlideTitleStyle = useCallback((updates: Partial<TitleStyle>) => {
    setSlides((prev) => {
      const newSlides = prev.map((slide) => {
        if (slide.id !== selectedSlideId) return slide;
        const currentStyle = ensureTitleStyle(slide.titleStyle);
        return {
          ...slide,
          titleStyle: { ...currentStyle, ...updates },
        };
      });
      saveToHistory(newSlides);
      return newSlides;
    });
  }, [selectedSlideId, saveToHistory]);

  const updateSlideSubtitleStyle = useCallback((updates: Partial<SubtitleStyle>) => {
    setSlides((prev) => {
      const newSlides = prev.map((slide) => {
        if (slide.id !== selectedSlideId) return slide;
        const currentStyle = ensureSubtitleStyle(slide.subtitleStyle);
        return {
          ...slide,
          subtitleStyle: { ...currentStyle, ...updates },
        };
      });
      saveToHistory(newSlides);
      return newSlides;
    });
  }, [selectedSlideId, saveToHistory]);

  const updateSlideTitlePosition = useCallback((updates: Partial<TitlePosition>) => {
    setSlides((prev) => {
      const newSlides = prev.map((slide) => {
        if (slide.id !== selectedSlideId) return slide;
        const currentPosition = ensureTitlePosition(slide.titlePosition);
        return {
          ...slide,
          titlePosition: { ...currentPosition, ...updates },
        };
      });
      saveToHistory(newSlides);
      return newSlides;
    });
  }, [selectedSlideId, saveToHistory]);

  const updateSlideSubtitlePosition = useCallback((updates: Partial<SubtitlePosition>) => {
    setSlides((prev) => {
      const newSlides = prev.map((slide) => {
        if (slide.id !== selectedSlideId) return slide;
        const currentPosition = ensureSubtitlePosition(slide.subtitlePosition);
        return {
          ...slide,
          subtitlePosition: { ...currentPosition, ...updates },
        };
      });
      saveToHistory(newSlides);
      return newSlides;
    });
  }, [selectedSlideId, saveToHistory]);

  const updateTextBoxPosition = useCallback((textBoxId: string, updates: Partial<TextBoxPosition>) => {
    setSlides((prev) => {
      const newSlides = prev.map((slide) => {
        if (slide.id !== selectedSlideId) return slide;
        const textBoxes = (slide.textBoxes || []).map((tb) => {
          if (tb.id !== textBoxId) return tb;
          return {
            ...tb,
            position: { ...tb.position, ...updates },
          };
        });
        return { ...slide, textBoxes };
      });
      saveToHistory(newSlides);
      return newSlides;
    });
  }, [selectedSlideId, saveToHistory]);

  const updateSlideTitleAnimation = useCallback((updates: Partial<TitleAnimation>) => {
    setSlides((prev) => {
      const newSlides = prev.map((slide) => {
        if (slide.id !== selectedSlideId) return slide;
        const currentAnimation = ensureTitleAnimation(slide.titleAnimation);
        return {
          ...slide,
          titleAnimation: { ...currentAnimation, ...updates },
        };
      });
      saveToHistory(newSlides);
      return newSlides;
    });
  }, [selectedSlideId, saveToHistory]);

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
  const activeThemeObj = getThemeByName(selectedThemeName) || presentationThemes["scdt"];
  const activeTheme = activeThemeObj?.id || selectedThemeName; // Use theme ID for comparison
  const currentSlideIndex = slides.findIndex((slide) => slide.id === selectedSlideId);
  const isFirstSlide = currentSlideIndex <= 0;
  const isLastSlide = currentSlideIndex === slides.length - 1;
  const isSCDT = activeTheme === "scdt" || selectedThemeName === "SCDT";
  const slideType = selectedSlide?.slideType || (isFirstSlide ? "cover" : isLastSlide ? "ending" : "content");
  const isSCDTCover = isSCDT && slideType === "cover";
  const isSCDTContent = isSCDT && slideType === "content";
  const isSCDTEnding = isSCDT && slideType === "ending";
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

            return {
              id: docSnap.id,
              order: typeof data.order === "number" ? data.order : index + 1,
              title: data.title || placeholderMap.title,
              subtitle: typeof data.subtitle === "string" ? decryptText(data.subtitle) || data.subtitle : (finalContent || placeholderMap.subtitle),
              content: typeof data.content === "string" && data.content.length > 0 ? (decryptText(data.content) || data.content) : undefined,
              notes: finalNotes,
              theme: data.theme || themes[0]?.name || DEFAULT_THEME,
              slideType: typeof data.slideType === "string" ? (data.slideType as "cover" | "content" | "ending") : undefined,
              templateId: typeof data.templateId === "string" ? data.templateId : undefined,
              formatting: ensureFormatting(data.formatting),
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
  
  useEffect(() => {
    if (!presentationId || !hasLoadedFromFirestore || !urlSlideId) return;
    // Only update if the URL slideId is different and exists in slides
    if (urlSlideId !== selectedSlideId && slides.some((s) => s.id === urlSlideId)) {
      setSelectedSlideId(urlSlideId);
    }
  }, [urlSlideId, presentationId, hasLoadedFromFirestore, slides, selectedSlideId]);

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
        id: slide.id || `slide-${index + 1}`,
        title: slide.title ?? placeholderMap.title,
        subtitle: slide.subtitle ?? placeholderMap.subtitle,
        notes: slide.notes ?? "",
        theme: slide.theme ?? themes[0]?.name ?? DEFAULT_THEME,
        formatting: ensureFormatting(slide.formatting),
        titleStyle: ensureTitleStyle(slide.titleStyle),
        titlePosition: ensureTitlePosition(slide.titlePosition),
        titleAnimation: ensureTitleAnimation(slide.titleAnimation),
        subtitleStyle: ensureSubtitleStyle(slide.subtitleStyle),
        subtitlePosition: ensureSubtitlePosition(slide.subtitlePosition),
        textBoxes: (slide.textBoxes || []).map((tb) => ({
          ...tb,
          style: ensureTextBoxStyle(tb.style),
          position: ensureTextBoxPosition(tb.position),
        })),
      }));
      setSlides(normalized);
      setHistory([normalized]); // Initialize history with loaded slides
      setHistoryIndex(0);
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
  }, [storageKey]);

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
    window.localStorage.setItem(storageKey, JSON.stringify(slides));
  }, [slides, storageKey]);

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

  useEffect(() => {
    if (!isBackgroundPickerOpen) return;
    const handleClickAway = (event: MouseEvent) => {
      setIsBackgroundPickerOpen(false);
    };
    document.addEventListener("mousedown", handleClickAway);
    return () => document.removeEventListener("mousedown", handleClickAway);
  }, [isBackgroundPickerOpen]);

  useEffect(() => {
    if (!isLayoutPickerOpen) return;
    const handleClickAway = (event: MouseEvent) => {
      setIsLayoutPickerOpen(false);
    };
    document.addEventListener("mousedown", handleClickAway);
    return () => document.removeEventListener("mousedown", handleClickAway);
  }, [isLayoutPickerOpen]);

  useEffect(() => {
    if (!isTransitionPickerOpen) return;
    const handleClickAway = (event: MouseEvent) => {
      setIsTransitionPickerOpen(false);
    };
    document.addEventListener("mousedown", handleClickAway);
    return () => document.removeEventListener("mousedown", handleClickAway);
  }, [isTransitionPickerOpen]);

  useEffect(() => {
    if (!selectedSlide) return;
    const formatting = selectedSlide.formatting ?? DEFAULT_FORMATTING;
    const titleStyle = ensureTitleStyle(selectedSlide.titleStyle);
    const titlePosition = ensureTitlePosition(selectedSlide.titlePosition);
    
    // Only update content if it's different to avoid overwriting user input
    if (titleRef.current) {
      const currentContent = titleRef.current.innerHTML;
      const newContent = selectedSlide.title || placeholderMap.title;
      // Only update if content actually changed (not during active editing)
      if (currentContent !== newContent && document.activeElement !== titleRef.current) {
        titleRef.current.innerHTML = newContent;
      }
      titleRef.current.style.lineHeight = `${formatting.title.lineHeight}`;
      titleRef.current.style.fontFamily = titleStyle.fontFamily;
      titleRef.current.style.fontSize = `${titleStyle.fontSize}px`;
      titleRef.current.style.color = titleStyle.color;
      titleRef.current.style.fontWeight = titleStyle.bold ? "bold" : "normal";
      titleRef.current.style.fontStyle = titleStyle.italic ? "italic" : "normal";
      titleRef.current.style.letterSpacing = `${titleStyle.letterSpacing}px`;
      titleRef.current.style.transform = `translate(${titlePosition.x}px, ${titlePosition.y}px)`;
      titleRef.current.style.zIndex = titlePosition.zIndex.toString();
      titleRef.current.style.position = "relative";
      titleRef.current.style.cursor = isReadOnly ? "default" : "move";
      titleRef.current.style.direction = "rtl";
      titleRef.current.style.textAlign = "right";
    }
    if (subtitleRef.current) {
      const subtitleStyle = ensureSubtitleStyle(selectedSlide.subtitleStyle);
      const subtitlePosition = ensureSubtitlePosition(selectedSlide.subtitlePosition);
      const currentContent = subtitleRef.current.innerHTML;
      const newContent = selectedSlide.subtitle || placeholderMap.subtitle;
      // Only update if content actually changed (not during active editing)
      if (currentContent !== newContent && document.activeElement !== subtitleRef.current) {
        subtitleRef.current.innerHTML = newContent;
      }
      subtitleRef.current.style.lineHeight = `${formatting.subtitle.lineHeight}`;
      subtitleRef.current.style.fontFamily = subtitleStyle.fontFamily;
      subtitleRef.current.style.fontSize = `${subtitleStyle.fontSize}px`;
      subtitleRef.current.style.color = subtitleStyle.color;
      subtitleRef.current.style.fontWeight = subtitleStyle.bold ? "bold" : "normal";
      subtitleRef.current.style.fontStyle = subtitleStyle.italic ? "italic" : "normal";
      subtitleRef.current.style.letterSpacing = `${subtitleStyle.letterSpacing}px`;
      subtitleRef.current.style.transform = `translate(${subtitlePosition.x}px, ${subtitlePosition.y}px)`;
      subtitleRef.current.style.zIndex = subtitlePosition.zIndex.toString();
      subtitleRef.current.style.position = "relative";
      subtitleRef.current.style.cursor = isReadOnly ? "default" : "move";
      subtitleRef.current.style.direction = "rtl";
      subtitleRef.current.style.textAlign = "right";
    }
    if (notesRef.current) {
      notesRef.current.style.lineHeight = `${formatting.notes.lineHeight}`;
    }
    // Update text box content and styles
    if (selectedSlide?.textBoxes) {
      selectedSlide.textBoxes.forEach((textBox) => {
        const textBoxRef = textBoxRefs.current.get(textBox.id);
        if (textBoxRef) {
          // Only update content if not actively editing
          if (document.activeElement !== textBoxRef) {
            const currentContent = textBoxRef.innerHTML;
            const textBoxContent = textBox.content || textBox.text || "";
            if (currentContent !== textBoxContent) {
              textBoxRef.innerHTML = textBoxContent;
            }
          }
          // Always update styles and position
          const textBoxStyle = ensureTextBoxStyle(textBox.style);
          const textBoxPosition = ensureTextBoxPosition(textBox.position);
          textBoxRef.style.fontFamily = textBoxStyle.fontFamily;
          textBoxRef.style.fontSize = `${textBoxStyle.fontSize}px`;
          textBoxRef.style.color = textBoxStyle.color;
          textBoxRef.style.fontWeight = textBoxStyle.bold ? "bold" : "normal";
          textBoxRef.style.fontStyle = textBoxStyle.italic ? "italic" : "normal";
          textBoxRef.style.letterSpacing = `${textBoxStyle.letterSpacing}px`;
          textBoxRef.style.transform = `translate(${textBoxPosition.x}px, ${textBoxPosition.y}px)`;
          textBoxRef.style.zIndex = textBoxPosition.zIndex.toString();
          textBoxRef.style.position = "absolute";
          textBoxRef.style.left = "0";
          textBoxRef.style.top = "0";
        }
      });
    }
  }, [selectedSlide, isReadOnly]);

  // Text box management functions - defined early for use in useEffects
  const deleteTextBox = useCallback((textBoxId: string) => {
    setSlides((prev) => {
      const newSlides = prev.map((slide) => {
        if (slide.id !== selectedSlideId) return slide;
        const textBoxes = (slide.textBoxes || []).filter((tb) => tb.id !== textBoxId);
        return { ...slide, textBoxes };
      });
      saveToHistory(newSlides);
      return newSlides;
    });
    if (selectedTextBoxId === textBoxId) {
      setSelectedTextBoxId(null);
      setActiveField("title");
    }
  }, [selectedSlideId, selectedTextBoxId, saveToHistory]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isReadOnly) return;
      // Delete selected text box with Delete or Backspace key
      if ((event.key === "Delete" || event.key === "Backspace") && activeField === "textbox" && selectedTextBoxId) {
        // Only delete if not editing text (no text selected)
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
          event.preventDefault();
          deleteTextBox(selectedTextBoxId);
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isReadOnly, activeField, selectedTextBoxId, deleteTextBox]);

  // Sync command state when text box is selected
  useEffect(() => {
    if (activeField === "textbox" && selectedTextBoxId && selectedSlide) {
      // Use a small delay to ensure state is fully updated
      const timeoutId = setTimeout(() => {
        syncCommandState();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [activeField, selectedTextBoxId, selectedSlide]);

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
    if (activeField === "title" && selectedSlide) {
      const titleStyle = ensureTitleStyle(selectedSlide.titleStyle);
      setCommandState((prev) => ({
        ...prev,
        fontFamily: titleStyle.fontFamily,
        fontSize: titleStyle.fontSize,
        bold: titleStyle.bold,
        italic: titleStyle.italic,
        underline: false,
        color: titleStyle.color,
        highlight: "transparent",
        align: "left",
        listType: "none",
      }));
      return;
    }

    if (activeField === "subtitle" && selectedSlide) {
      const subtitleStyle = ensureSubtitleStyle(selectedSlide.subtitleStyle);
      setCommandState((prev) => ({
        ...prev,
        fontFamily: subtitleStyle.fontFamily,
        fontSize: subtitleStyle.fontSize,
        bold: subtitleStyle.bold,
        italic: subtitleStyle.italic,
        underline: false,
        color: subtitleStyle.color,
        highlight: "transparent",
        align: "left",
        listType: "none",
      }));
      return;
    }

    if (activeField === "textbox" && selectedSlide && selectedTextBoxId) {
      const selectedTextBox = selectedSlide.textBoxes?.find((tb) => tb.id === selectedTextBoxId);
      if (selectedTextBox) {
        const textBoxStyle = ensureTextBoxStyle(selectedTextBox.style);
        setCommandState((prev) => ({
          ...prev,
          fontFamily: textBoxStyle.fontFamily,
          fontSize: textBoxStyle.fontSize,
          bold: textBoxStyle.bold,
          italic: textBoxStyle.italic,
          underline: false,
          color: textBoxStyle.color,
          highlight: "transparent",
          align: "left",
          listType: "none",
        }));
        return;
      }
    }

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
    const placeholder = placeholderMap[field];
    // Only set placeholder if field is truly empty
    if (!text || text === placeholder) {
      ref.innerHTML = placeholder;
      updateSlideField(fieldKeyMap[field], placeholder);
    } else {
      updateSlideField(fieldKeyMap[field], ref.innerHTML);
    }
  };

  const handleContentClick = (field: FieldKey) => {
    if (isReadOnly) return;
    const ref = getFieldRef(field);
    if (!ref) return;
    setActiveField(field);
    // Clear placeholder on click if it's the placeholder text
    const currentText = ref.textContent?.trim();
    if (currentText === placeholderMap[field]) {
      ref.innerHTML = "";
      ref.focus();
    } else {
      ref.focus();
    }
  };

  const handleContentFocus = (field: FieldKey) => {
    if (isReadOnly) return;
    setActiveField(field);
    setIsColorPickerOpen(false);
    setIsHighlightPickerOpen(false);
    // Ensure the field is focused and ready for typing
    const ref = getFieldRef(field);
    if (ref) {
      // Small delay to ensure focus is properly set
      setTimeout(() => {
        ref.focus();
        // Place cursor at the end if content exists
        const selection = window.getSelection();
        if (selection && ref.textContent) {
          const range = document.createRange();
          range.selectNodeContents(ref);
          range.collapse(false); // Collapse to end
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }, 0);
    }
  };

  const handleNotesChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isReadOnly) return;
    const value = event.target.value;
    setSpeakerNotes(value);
    updateSlideField("notes", value);
    autoResizeNotes(event.target);
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
    
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);

    // Check browser support - only Chrome supports SpeechRecognition reliably
    if (!SpeechRecognition || !isChrome) {
      setVoiceError("Voice notes are only supported in Google Chrome.");
      setIsVoiceRecording(false);
      recognitionRef.current = null;
      return;
    }

    // Clear any previous error if we have support
    setVoiceError(null);

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
      
      // Only log meaningful errors (not empty objects or common non-critical errors)
      if (errorType !== "no-speech" && errorType !== "aborted") {
        if (errorMessage) {
          console.warn("Speech recognition error:", errorType, errorMessage);
        } else if (errorType !== "unknown") {
          console.warn("Speech recognition error:", errorType);
        }
      }
      
      setIsVoiceRecording(false);
    };

    recognition.onend = () => {
      console.log("Speech recognition ended");
      setIsVoiceRecording(false);
    };

    recognitionRef.current = recognition as any;

    return () => {
      try {
        recognition.stop();
      } catch {}
    };
  }, []);

  const handleToggleVoice = () => {
    // Check for browser support error first
    if (voiceError) {
      return; // Don't attempt to start if browser doesn't support it
    }

    const recognition = recognitionRef.current;
    if (!recognition) {
      setVoiceError("Voice notes are only supported in Google Chrome.");
      return;
    }

    if (isVoiceRecording) {
      console.log("Stopping recognition");
      recognition.stop();
      setIsVoiceRecording(false);
    } else {
      try {
        console.log("Starting recognition");
        recognition.start();
        setIsVoiceRecording(true);
      } catch (err) {
        console.warn("Error starting recognition:", err);
        setIsVoiceRecording(false);
      }
    }
  };

  const autoResizeNotes = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 80), 400)}px`;
  };

  // Voice-to-text functions
  const initializeSpeechRecognition = useCallback(() => {
    if (typeof window === "undefined") return null;
    
    // Check for browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.");
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      const newTranscript = finalTranscript + interimTranscript;
      setTranscript((prev) => prev + finalTranscript);
      
      // Update notes in real-time with interim results
      if (notesRef.current && selectedSlide) {
        const currentNotes = selectedSlide.notes ?? "";
        const displayText = currentNotes + finalTranscript + interimTranscript;
        notesRef.current.value = displayText;
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "no-speech") {
        // User stopped speaking, but keep listening
        return;
      }
      setIsListening(false);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore stop errors
        }
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    return recognition;
  }, [selectedSlide]);

  const startVoiceToText = useCallback(() => {
    if (isReadOnly) return;
    
    if (!recognitionRef.current) {
      const recognition = initializeSpeechRecognition();
      if (!recognition) return;
      recognitionRef.current = recognition;
    }

    try {
      setTranscript("");
      recognitionRef.current.start();
      setIsListening(true);
    } catch (error) {
      console.error("Error starting speech recognition:", error);
      setIsListening(false);
    }
  }, [isReadOnly, initializeSpeechRecognition]);

  const stopVoiceToText = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error("Error stopping speech recognition:", error);
      }
    }
    setIsListening(false);
    
    // Save final transcript to notes
    if (transcript && selectedSlide) {
      const currentNotes = selectedSlide.notes ?? "";
      const finalNotes = currentNotes + (currentNotes ? " " : "") + transcript.trim();
      updateSlideField("notes", finalNotes);
      if (notesRef.current) {
        notesRef.current.value = finalNotes;
      }
    }
    setTranscript("");
  }, [transcript, selectedSlide, updateSlideField]);

  const convertToBulletPoints = useCallback(() => {
    if (!transcript && !selectedSlide?.notes) return;
    
    const text = transcript || selectedSlide?.notes || "";
    // Split by sentences and convert to bullet points
    const sentences = text
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    
    const bulletPoints = sentences.map((sentence) => `• ${sentence}`).join("\n");
    
    if (notesRef.current) {
      notesRef.current.value = bulletPoints;
      updateSlideField("notes", bulletPoints);
    }
    setTranscript("");
  }, [transcript, selectedSlide?.notes, updateSlideField]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          // Ignore errors during cleanup
        }
      }
    };
  }, []);

  const toggleColorPicker = () => setIsColorPickerOpen((prev) => !prev);
  const toggleHighlightPicker = () => setIsHighlightPickerOpen((prev) => !prev);
  const toggleThemePicker = () => setIsThemePickerOpen((prev) => !prev);

  const handleThemeSelect = useCallback(
    (themeName: string) => {
      setSlides((prev) =>
        prev.map((slide, index) =>
          slide.id === selectedSlideId
            ? {
                ...slide,
                theme: themeName,
                // Auto-set slideType for SCDT theme
                slideType: themeName === "SCDT" 
                  ? (index === 0 ? "cover" : index === prev.length - 1 ? "ending" : "content")
                  : slide.slideType,
              }
            : slide
        )
      );
      
      // Also update the presentation document if we have a presentationId
      if (presentationId) {
        const presentationRef = doc(db, "presentations", presentationId);
        setDoc(presentationRef, { theme: themeName, themeId: getThemeByName(themeName)?.id || "scdt" }, { merge: true }).catch(console.error);
      }
    },
    [selectedSlideId, presentationId]
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
    if (activeField === "title") {
      updateSlideTitleStyle({ fontFamily: font });
      if (titleRef.current) {
        titleRef.current.style.fontFamily = font;
      }
    } else if (activeField === "subtitle") {
      updateSlideSubtitleStyle({ fontFamily: font });
      if (subtitleRef.current) {
        subtitleRef.current.style.fontFamily = font;
      }
    } else if (activeField === "textbox" && selectedTextBoxId) {
      updateTextBoxStyle(selectedTextBoxId, { fontFamily: font });
      const textBoxRef = textBoxRefs.current.get(selectedTextBoxId);
      if (textBoxRef) {
        textBoxRef.style.fontFamily = font;
      }
    } else {
    execWithCommand("fontName", font);
    }
  };

  const applyFontSize = (size: number) => {
    if (activeField === "title") {
      updateSlideTitleStyle({ fontSize: size });
      if (titleRef.current) {
        titleRef.current.style.fontSize = `${size}px`;
      }
    } else if (activeField === "subtitle") {
      updateSlideSubtitleStyle({ fontSize: size });
      if (subtitleRef.current) {
        subtitleRef.current.style.fontSize = `${size}px`;
      }
    } else if (activeField === "textbox" && selectedTextBoxId) {
      updateTextBoxStyle(selectedTextBoxId, { fontSize: size });
      const textBoxRef = textBoxRefs.current.get(selectedTextBoxId);
      if (textBoxRef) {
        textBoxRef.style.fontSize = `${size}px`;
      }
    } else {
    const commandValue = FONT_SIZE_TO_COMMAND[size];
    if (!commandValue) return;
    execWithCommand("fontSize", commandValue);
    }
  };

  const toggleBold = () => {
    if (activeField === "title") {
      const currentStyle = ensureTitleStyle(selectedSlide?.titleStyle);
      updateSlideTitleStyle({ bold: !currentStyle.bold });
      if (titleRef.current) {
        titleRef.current.style.fontWeight = currentStyle.bold ? "normal" : "bold";
      }
    } else if (activeField === "subtitle") {
      const currentStyle = ensureSubtitleStyle(selectedSlide?.subtitleStyle);
      updateSlideSubtitleStyle({ bold: !currentStyle.bold });
      if (subtitleRef.current) {
        subtitleRef.current.style.fontWeight = currentStyle.bold ? "normal" : "bold";
      }
    } else if (activeField === "textbox" && selectedTextBoxId) {
      const selectedTextBox = selectedSlide?.textBoxes?.find((tb) => tb.id === selectedTextBoxId);
      if (selectedTextBox) {
        const currentStyle = ensureTextBoxStyle(selectedTextBox.style);
        updateTextBoxStyle(selectedTextBoxId, { bold: !currentStyle.bold });
        const textBoxRef = textBoxRefs.current.get(selectedTextBoxId);
        if (textBoxRef) {
          textBoxRef.style.fontWeight = currentStyle.bold ? "normal" : "bold";
        }
      }
    } else {
      execWithCommand("bold");
    }
  };

  const toggleItalic = () => {
    if (activeField === "title") {
      const currentStyle = ensureTitleStyle(selectedSlide?.titleStyle);
      updateSlideTitleStyle({ italic: !currentStyle.italic });
      if (titleRef.current) {
        titleRef.current.style.fontStyle = currentStyle.italic ? "normal" : "italic";
      }
    } else if (activeField === "subtitle") {
      const currentStyle = ensureSubtitleStyle(selectedSlide?.subtitleStyle);
      updateSlideSubtitleStyle({ italic: !currentStyle.italic });
      if (subtitleRef.current) {
        subtitleRef.current.style.fontStyle = currentStyle.italic ? "normal" : "italic";
      }
    } else if (activeField === "textbox" && selectedTextBoxId) {
      const selectedTextBox = selectedSlide?.textBoxes?.find((tb) => tb.id === selectedTextBoxId);
      if (selectedTextBox) {
        const currentStyle = ensureTextBoxStyle(selectedTextBox.style);
        updateTextBoxStyle(selectedTextBoxId, { italic: !currentStyle.italic });
        const textBoxRef = textBoxRefs.current.get(selectedTextBoxId);
        if (textBoxRef) {
          textBoxRef.style.fontStyle = currentStyle.italic ? "normal" : "italic";
        }
      }
    } else {
      execWithCommand("italic");
    }
  };

  const toggleUnderline = () => execWithCommand("underline");

  const applyTextColor = (color: string) => {
    setIsColorPickerOpen(false);
    if (activeField === "title") {
      updateSlideTitleStyle({ color });
      if (titleRef.current) {
        titleRef.current.style.color = color;
      }
    } else if (activeField === "subtitle") {
      updateSlideSubtitleStyle({ color });
      if (subtitleRef.current) {
        subtitleRef.current.style.color = color;
      }
    } else if (activeField === "textbox" && selectedTextBoxId) {
      updateTextBoxStyle(selectedTextBoxId, { color });
      const textBoxRef = textBoxRefs.current.get(selectedTextBoxId);
      if (textBoxRef) {
        textBoxRef.style.color = color;
      }
    } else {
    execWithCommand("foreColor", color);
    }
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

    setSlides((prev) => {
      const newSlides = prev.map((slide) => {
        if (slide.id !== selectedSlideId) return slide;
        const formatting = ensureFormatting(slide.formatting);
        return {
          ...slide,
          formatting: {
            ...formatting,
      [activeField]: { lineHeight: value },
          },
        };
      });
      saveToHistory(newSlides);
      return newSlides;
    });

    if (activeField !== "notes") {
    syncActiveFieldContent(activeField);
    }
  };

  const applyLetterSpacing = (value: number) => {
    if (activeField === "title") {
      updateSlideTitleStyle({ letterSpacing: value });
      if (titleRef.current) {
        titleRef.current.style.letterSpacing = `${value}px`;
      }
    } else if (activeField === "subtitle") {
      updateSlideSubtitleStyle({ letterSpacing: value });
      if (subtitleRef.current) {
        subtitleRef.current.style.letterSpacing = `${value}px`;
      }
    } else if (activeField === "textbox" && selectedTextBoxId) {
      updateTextBoxStyle(selectedTextBoxId, { letterSpacing: value });
      const textBoxRef = textBoxRefs.current.get(selectedTextBoxId);
      if (textBoxRef) {
        textBoxRef.style.letterSpacing = `${value}px`;
      }
    }
  };

  const applyUndo = () => execWithCommand("undo");
  const applyRedo = () => execWithCommand("redo");

  const updateSlideField = (field: keyof SlideData, value: string | "cover" | "content" | "ending") => {
    setSlides((prev) =>
      prev.map((slide) => (slide.id === selectedSlideId ? { ...slide, [field]: value } : slide))
    );
  };

  // Drag functionality for title, subtitle, and text boxes
  const dragStartRef = useRef<{ x: number; y: number; startX: number; startY: number; field: "title" | "subtitle" | "textbox"; textBoxId?: string } | null>(null);

  const handleTitleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isReadOnly || !titleRef.current) return;
    
    // Check if user is trying to select text or edit
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      // If there's a text selection or cursor, allow normal editing
      if (!range.collapsed || range.toString().length > 0) {
        setActiveField("title");
        return; // Allow text selection and editing
      }
    }
    
    // Check if the element is already focused (user is editing)
    if (document.activeElement === titleRef.current) {
      return; // Allow normal text editing
    }
    
    // Only start dragging if clicking on empty space (not on text)
    // Use a small delay to distinguish between click and drag
    const startX = event.clientX;
    const startY = event.clientY;
    const startTime = Date.now();
    let isDragging = false;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = Math.abs(moveEvent.clientX - startX);
      const deltaY = Math.abs(moveEvent.clientY - startY);
      const deltaTime = Date.now() - startTime;
      
      // If mouse moved more than 5px or took more than 200ms, start dragging
      if ((deltaX > 5 || deltaY > 5 || deltaTime > 200) && !isDragging) {
        isDragging = true;
        event.preventDefault();
        setActiveField("title");
        const canvasSurface = titleRef.current?.closest(`.${styles.canvasSurface}`);
        if (!canvasSurface || !titleRef.current) return;
        const canvasRect = canvasSurface.getBoundingClientRect();
        const currentPosition = ensureTitlePosition(selectedSlide?.titlePosition);
        dragStartRef.current = {
          x: currentPosition.x,
          y: currentPosition.y,
          startX: startX - canvasRect.left - currentPosition.x,
          startY: startY - canvasRect.top - currentPosition.y,
          field: "title",
        };
      }
    };
    
    const handleMouseUp = () => {
      // If it was just a click (no drag), don't interfere - onClick already handled it
      if (!isDragging && titleRef.current && document.activeElement !== titleRef.current) {
        // Only focus if not already focused (onClick should have handled it)
        setTimeout(() => {
          if (document.activeElement !== titleRef.current && titleRef.current) {
            titleRef.current.focus();
          }
        }, 0);
      }
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleSubtitleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isReadOnly || !subtitleRef.current) return;
    
    // Check if user is trying to select text or edit
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      // If there's a text selection or cursor, allow normal editing
      if (!range.collapsed || range.toString().length > 0) {
        setActiveField("subtitle");
        return; // Allow text selection and editing
      }
    }
    
    // Check if the element is already focused (user is editing)
    if (document.activeElement === subtitleRef.current) {
      return; // Allow normal text editing
    }
    
    // Only start dragging if clicking on empty space (not on text)
    const startX = event.clientX;
    const startY = event.clientY;
    const startTime = Date.now();
    let isDragging = false;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = Math.abs(moveEvent.clientX - startX);
      const deltaY = Math.abs(moveEvent.clientY - startY);
      const deltaTime = Date.now() - startTime;
      
      // If mouse moved more than 5px or took more than 200ms, start dragging
      if ((deltaX > 5 || deltaY > 5 || deltaTime > 200) && !isDragging) {
        isDragging = true;
        event.preventDefault();
        setActiveField("subtitle");
        const canvasSurface = subtitleRef.current?.closest(`.${styles.canvasSurface}`);
        if (!canvasSurface || !subtitleRef.current) return;
        const canvasRect = canvasSurface.getBoundingClientRect();
        const currentPosition = ensureSubtitlePosition(selectedSlide?.subtitlePosition);
        dragStartRef.current = {
          x: currentPosition.x,
          y: currentPosition.y,
          startX: startX - canvasRect.left - currentPosition.x,
          startY: startY - canvasRect.top - currentPosition.y,
          field: "subtitle",
        };
      }
    };
    
    const handleMouseUp = () => {
      if (!isDragging && subtitleRef.current && document.activeElement !== subtitleRef.current) {
        setTimeout(() => {
          if (document.activeElement !== subtitleRef.current && subtitleRef.current) {
            subtitleRef.current.focus();
          }
        }, 0);
      }
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  useEffect(() => {
    if (!dragStartRef.current) return;

    const handleMouseMove = (event: MouseEvent) => {
      if (!dragStartRef.current) return;
      const field = dragStartRef.current.field;
      
      if (field === "title" && titleRef.current) {
        const canvasSurface = titleRef.current.closest(`.${styles.canvasSurface}`);
        if (!canvasSurface) return;
        const canvasRect = canvasSurface.getBoundingClientRect();
        const newX = event.clientX - canvasRect.left - dragStartRef.current.startX;
        const newY = event.clientY - canvasRect.top - dragStartRef.current.startY;
        
        updateSlideTitlePosition({ x: newX, y: newY });
        if (titleRef.current) {
          titleRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
        }
      } else if (field === "subtitle" && subtitleRef.current) {
        const canvasSurface = subtitleRef.current.closest(`.${styles.canvasSurface}`);
        if (!canvasSurface) return;
        const canvasRect = canvasSurface.getBoundingClientRect();
        const newX = event.clientX - canvasRect.left - dragStartRef.current.startX;
        const newY = event.clientY - canvasRect.top - dragStartRef.current.startY;
        
        updateSlideSubtitlePosition({ x: newX, y: newY });
        if (subtitleRef.current) {
          subtitleRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
        }
      } else if (field === "textbox" && dragStartRef.current.textBoxId) {
        const textBoxRef = textBoxRefs.current.get(dragStartRef.current.textBoxId);
        if (textBoxRef) {
          const canvasSurface = textBoxRef.closest(`.${styles.canvasSurface}`);
          if (!canvasSurface) return;
          const canvasRect = canvasSurface.getBoundingClientRect();
          const newX = event.clientX - canvasRect.left - dragStartRef.current.startX;
          const newY = event.clientY - canvasRect.top - dragStartRef.current.startY;
          
          // Allow free movement within canvas bounds
          // Get text box dimensions for boundary checking
          const textBoxWidth = textBoxRef.offsetWidth || 100;
          const textBoxHeight = textBoxRef.offsetHeight || 50;
          
          // Calculate bounds - allow movement anywhere within the canvas
          // Use a small margin to keep text box fully visible
          const margin = 10;
          const minX = -margin; // Allow slight overflow for flexibility
          const minY = -margin;
          const maxX = canvasRect.width - textBoxWidth + margin;
          const maxY = canvasRect.height - textBoxHeight + margin;
          
          // Clamp to bounds but allow some flexibility
          const clampedX = Math.max(minX, Math.min(newX, maxX));
          const clampedY = Math.max(minY, Math.min(newY, maxY));
          
          updateTextBoxPosition(dragStartRef.current.textBoxId, { x: clampedX, y: clampedY });
          textBoxRef.style.transform = `translate(${clampedX}px, ${clampedY}px)`;
        }
      }
    };

    const handleMouseUp = () => {
      dragStartRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [selectedSlideId, updateSlideTitlePosition, updateSlideSubtitlePosition, updateTextBoxPosition]);

  // Animation controls
  const startAnimation = useCallback(() => {
    if (!titleRef.current || !selectedSlide) return;
    const animation = ensureTitleAnimation(selectedSlide.titleAnimation);
    if (animation.type === "none") return;

    setIsAnimating(true);
    setAnimationPaused(false);
    const element = titleRef.current;

    // Remove existing animation classes
    element.classList.remove("animate-fade-in", "animate-slide-in", "animate-marquee");

    if (animation.type === "fade-in") {
      element.classList.add("animate-fade-in");
      element.style.animationDuration = `${animation.duration}s`;
      element.style.animationIterationCount = animation.loop ? "infinite" : "1";
    } else if (animation.type === "slide-in") {
      element.classList.add("animate-slide-in");
      element.style.animationDuration = `${animation.duration}s`;
      element.style.animationIterationCount = animation.loop ? "infinite" : "1";
    } else if (animation.type === "marquee") {
      element.classList.add("animate-marquee");
      element.style.animationDuration = `${animation.duration}s`;
      element.style.animationIterationCount = animation.loop ? "infinite" : "1";
    }
  }, [selectedSlide]);

  const pauseAnimation = useCallback(() => {
    if (!titleRef.current) return;
    titleRef.current.style.animationPlayState = animationPaused ? "running" : "paused";
    setAnimationPaused((prev) => !prev);
  }, [animationPaused]);

  const stopAnimation = useCallback(() => {
    if (!titleRef.current) return;
    setIsAnimating(false);
    setAnimationPaused(false);
    titleRef.current.classList.remove("animate-fade-in", "animate-slide-in", "animate-marquee");
    titleRef.current.style.animation = "none";
  }, []);

  const applyUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setSlides(JSON.parse(JSON.stringify(history[newIndex]))); // Deep clone
    }
  }, [history, historyIndex]);

  const applyRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setSlides(JSON.parse(JSON.stringify(history[newIndex]))); // Deep clone
    }
  }, [history, historyIndex]);

  const handleAddSlide = async () => {
    const themeName = selectedThemeName || themes[0]?.name || DEFAULT_THEME;
    
    // If using Firestore, save there
    if (presentationId) {
      const nextOrder =
        slides.length > 0
          ? slides.reduce((max, slide, index) => Math.max(max, slide.order ?? index + 1), 0) + 1
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
        titleStyle: { ...DEFAULT_TITLE_STYLE },
        titlePosition: { ...DEFAULT_TITLE_POSITION },
        titleAnimation: { ...DEFAULT_TITLE_ANIMATION },
      };

      try {
        const slideRef = doc(db, "presentations", presentationId, "slides", newSlideId);
        await setDoc(
          slideRef,
          {
            order: nextOrder,
            title: placeholderMap.title,
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
        // URL will be updated by the useEffect that watches selectedSlideId
      } catch (error) {
        console.error("Failed to add slide to Firestore:", error);
      }
    } else {
      // Legacy mode: just update state
      setSlides((prev) => {
        const nextIndex = prev.length + 1;
        const newSlide: SlideData = {
          id: `slide-${nextIndex}-${Date.now()}`,
          title: placeholderMap.title,
          subtitle: placeholderMap.subtitle,
          notes: "",
          theme: themeName,
          formatting: createDefaultFormatting(),
          titleStyle: { ...DEFAULT_TITLE_STYLE },
          titlePosition: { ...DEFAULT_TITLE_POSITION },
          titleAnimation: { ...DEFAULT_TITLE_ANIMATION },
        };
        setSelectedSlideId(newSlide.id);
        return [...prev, newSlide];
      });
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

  const handleSaveSlide = async () => {
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

      // Set ownerId and isShared flag
      if (currentUser) {
        presentationData.ownerId = currentUser.uid;
        presentationData.isShared = false; // Mark as private by default for regular saves
      }

      await setDoc(presentationRef, presentationData, { merge: true });

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

        await setDoc(
          slideRef,
          {
            order: slideIndex + 1,
            title: typeof slide.title === "string" ? slide.title : "",
            content: encryptedContent,
            notes: encryptedNotes,
            theme: slide.theme || "default",
            slideType: slide.slideType,
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

      // Save slides to Firebase (legacy function - keeping for compatibility)
      try {
        const slidesToSave = slides.map((slide, index) => ({
          id: slide.id,
          title: typeof slide.title === "string" ? slide.title : "",
          subtitle: typeof slide.subtitle === "string" ? slide.subtitle : "",
          notes: typeof slide.notes === "string" ? slide.notes : "",
          theme: typeof slide.theme === "string" ? slide.theme : "default",
          order: index + 1,
        }));
        await saveSlidesToFirebase(presentationId, slidesToSave);
        console.log("Slides saved to Firebase successfully");
      } catch (error) {
        console.error("Failed to save slides to Firebase:", error);
        // Don't block the UI, but log the error
      }
    } catch (error) {
      console.error("Failed to save presentation:", error);
      setStatusMessage("Failed to save. Please try again.");
      setStatusToastVariant("draft");
    }
  };

  const applyStatusUpdate = (nextStatus: "draft" | "final", message: string) => {
    if (!presentationId) return;
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
      return;
    }
    if (!presentationId) {
      // Legacy mode: just update state
      if (slides.length <= 1) {
        console.warn("At least one slide must remain in the presentation.");
        return;
      }
      setSlides((prev) => prev.filter((slide) => slide.id !== selectedSlideId));
      const currentIndex = slides.findIndex((slide) => slide.id === selectedSlideId);
      const nextSlide = slides[currentIndex + 1] || slides[currentIndex - 1];
      if (nextSlide) {
        setSelectedSlideId(nextSlide.id);
      }
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

  const handleCommentSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newComment.trim();
    if (!trimmed) return;
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
        slideType: slide.slideType,
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

  // Image handler - opens file picker and inserts image into content
  const handleImageClick = useCallback(() => {
    if (isReadOnly) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        // Insert image into the active editable field
        if (isEditableField && restoreSelection()) {
          const img = document.createElement("img");
          img.src = imageUrl;
          img.style.maxWidth = "100%";
          img.style.height = "auto";
          img.style.display = "block";
          img.style.margin = "8px 0";
          document.execCommand("insertHTML", false, img.outerHTML);
          syncActiveFieldContent(activeField);
          syncCommandState();
        } else {
          // If no active field, set as background
          setSlides((prev) => {
            const newSlides = prev.map((slide) =>
              slide.id === selectedSlideId ? { ...slide, backgroundImage: imageUrl } : slide
            );
            saveToHistory(newSlides);
            return newSlides;
          });
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [selectedSlideId, isReadOnly, saveToHistory, isEditableField, activeField, restoreSelection, syncActiveFieldContent, syncCommandState]);

  // Background handler - opens color/image picker
  const handleBackgroundClick = useCallback(() => {
    if (isReadOnly) return;
    setIsBackgroundPickerOpen((prev) => !prev);
  }, [isReadOnly]);

  const handleBackgroundColorSelect = useCallback((color: string) => {
    setSlides((prev) => {
      const newSlides = prev.map((slide) =>
        slide.id === selectedSlideId ? { ...slide, backgroundColor: color, backgroundImage: undefined } : slide
      );
      saveToHistory(newSlides);
      return newSlides;
    });
    setIsBackgroundPickerOpen(false);
  }, [selectedSlideId, saveToHistory]);

  const handleBackgroundImageSelect = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        setSlides((prev) => {
          const newSlides = prev.map((slide) =>
            slide.id === selectedSlideId ? { ...slide, backgroundImage: imageUrl, backgroundColor: undefined } : slide
          );
          saveToHistory(newSlides);
          return newSlides;
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
    setIsBackgroundPickerOpen(false);
  }, [selectedSlideId, saveToHistory]);

  // Layout handler - cycles through layouts
  const handleLayoutClick = useCallback(() => {
    if (isReadOnly) return;
    setIsLayoutPickerOpen((prev) => !prev);
  }, [isReadOnly]);

  const handleLayoutSelect = useCallback((layout: "title-only" | "title-subtitle" | "title-content" | "blank") => {
    setSlides((prev) => {
      const newSlides = prev.map((slide) =>
        slide.id === selectedSlideId ? { ...slide, layout } : slide
      );
      saveToHistory(newSlides);
      return newSlides;
    });
    setIsLayoutPickerOpen(false);
  }, [selectedSlideId, saveToHistory]);

  // Theme handler - toggles theme picker (already implemented)
  const handleThemeClick = useCallback(() => {
    if (isReadOnly) return;
    toggleThemePicker();
  }, [isReadOnly, toggleThemePicker]);

  // Transition handler - opens transition picker
  const handleTransitionClick = useCallback(() => {
    if (isReadOnly) return;
    setIsTransitionPickerOpen((prev) => !prev);
  }, [isReadOnly]);

  const handleTransitionSelect = useCallback((transition: "none" | "fade" | "slide" | "zoom") => {
    setSlides((prev) => {
      const newSlides = prev.map((slide) =>
        slide.id === selectedSlideId ? { ...slide, transition } : slide
      );
      saveToHistory(newSlides);
      return newSlides;
    });
    setIsTransitionPickerOpen(false);
  }, [selectedSlideId, saveToHistory]);

  const handleAddText = useCallback(() => {
    if (isReadOnly) return;
    // Use selectedSlideId directly instead of relying on selectedSlide memo
    // This ensures it works even if selectedSlide becomes stale
    // Calculate a centered position within the slide frame
    // Canvas is typically ~980px wide with ~64px padding, so content area is ~852px
    // Canvas height is ~550px with padding, so content area is ~422px
    // Center would be around x: 300-350px, y: 180-220px
    const newTextBox: TextBox = {
      id: `textbox-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content: "Click to edit",
      style: { ...DEFAULT_TEXTBOX_STYLE },
      position: { 
        ...DEFAULT_TEXTBOX_POSITION,
        // Ensure it starts in a visible, centered position
        x: DEFAULT_TEXTBOX_POSITION.x,
        y: DEFAULT_TEXTBOX_POSITION.y,
      },
    };
    setSlides((prev) => {
      const newSlides = prev.map((slide) => {
        if (slide.id !== selectedSlideId) return slide;
        const existingTextBoxes = slide.textBoxes || [];
        return {
          ...slide,
          textBoxes: [...existingTextBoxes, newTextBox],
        };
      });
      saveToHistory(newSlides);
      return newSlides;
    });
    // Use setTimeout to ensure state updates are processed
    setTimeout(() => {
      setSelectedTextBoxId(newTextBox.id);
      setActiveField("textbox");
    }, 0);
  }, [isReadOnly, selectedSlideId, saveToHistory]);

  const updateTextBoxStyle = useCallback((textBoxId: string, updates: Partial<TextBoxStyle>) => {
    setSlides((prev) => {
      const newSlides = prev.map((slide) => {
        if (slide.id !== selectedSlideId) return slide;
        const textBoxes = (slide.textBoxes || []).map((tb) => {
          if (tb.id !== textBoxId) return tb;
          return {
            ...tb,
            style: { ...tb.style, ...updates },
          };
        });
        return { ...slide, textBoxes };
      });
      saveToHistory(newSlides);
      return newSlides;
    });
  }, [selectedSlideId, saveToHistory]);

  const updateTextBoxContent = useCallback((textBoxId: string, content: string) => {
    setSlides((prev) => {
      const newSlides = prev.map((slide) => {
        if (slide.id !== selectedSlideId) return slide;
        const textBoxes = (slide.textBoxes || []).map((tb) => {
          if (tb.id !== textBoxId) return tb;
          return { ...tb, content };
        });
        return { ...slide, textBoxes };
      });
      saveToHistory(newSlides);
      return newSlides;
    });
  }, [selectedSlideId, saveToHistory]);

  const toolbarActions: Record<string, () => void> = {
    Undo: applyUndo,
    Redo: applyRedo,
    Image: handleImageClick,
    Background: handleBackgroundClick,
    Layout: handleLayoutClick,
    Theme: handleThemeClick,
    Transition: handleTransitionClick,
    "Add Text": handleAddText,
    "AI Assistant": () => setShowAssistant((prev) => !prev),
  };

  const currentFormatting = selectedSlide ? ensureFormatting(selectedSlide.formatting) : DEFAULT_FORMATTING;

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

  const handleOpenAutoPresentation = async () => {
    if (!presentationId) {
      alert("Please save the presentation first to use AI Auto-Presentation.");
      return;
    }

    // Ensure slides are saved to Firebase before opening auto-presentation
    try {
      syncActiveFieldContent("title");
      syncActiveFieldContent("subtitle");
      if (notesRef.current) {
        updateSlideField("notes", notesRef.current.value);
      }

      const slidesToSave = slides.map((slide, index) => ({
        id: slide.id,
        title: typeof slide.title === "string" ? slide.title : "",
        subtitle: typeof slide.subtitle === "string" ? slide.subtitle : "",
        notes: typeof slide.notes === "string" ? slide.notes : "",
        theme: typeof slide.theme === "string" ? slide.theme : "default",
        order: index + 1,
      }));

      console.log("💾 Saving slides to Firebase before opening auto-presentation...");
      console.log("📋 Presentation ID:", presentationId);
      console.log("📊 Slides to save:", slidesToSave.length);
      await saveSlidesToFirebase(presentationId, slidesToSave);
      console.log("✅ Slides saved successfully, opening auto-presentation");
      console.log("🔗 Navigating to /present with presentationId:", presentationId);

      const fallbackId = slides[0]?.id ?? "";
      const targetIndex = slides.findIndex((s) => s.id === (selectedSlideId || fallbackId));
      const slideIndex = targetIndex >= 0 ? targetIndex : 0;
      router.push(`/present?presentationId=${presentationId}&slideIndex=${slideIndex}&autoPlay=true`);
    } catch (error) {
      console.error("Failed to save slides to Firebase:", error);
      alert("Failed to save slides to Firebase. Please try saving manually first.");
    }
  };

  const currentLineHeight =
    currentFormatting[activeField]?.lineHeight ?? DEFAULT_FORMATTING[activeField]?.lineHeight ?? 1.2;

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
          <ThemeToggle />
          {!loading && !user ? (
            <button className={styles.primary} type="button" onClick={() => router.push("/login")}>
            Sign in
            </button>
          ) : null}
          {!loading && user ? (
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
          ) : null}
        </div>
      </nav>

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
                        value={presentationTitle}
                        onChange={(event) => setPresentationTitle(event.target.value)}
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
                  <button type="button" className={styles.shareButton}>
                    Share
                    </button>
                  <button type="button" className={styles.slideshowButton} onClick={handleOpenSlideshow}>
                    Slideshow
                    </button>
                  <button 
                    type="button" 
                    className={styles.autoPresentationButton} 
                    onClick={handleOpenAutoPresentation}
                    title="AI Auto-Presentation: Let AI present your slides automatically"
                  >
                    🤖 AI Auto-Present
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
                  onLetterSpacingChange={activeField === "title" || activeField === "subtitle" || activeField === "textbox" ? applyLetterSpacing : undefined}
                  letterSpacingValue={
                    activeField === "title"
                      ? ensureTitleStyle(selectedSlide?.titleStyle).letterSpacing
                      : activeField === "subtitle"
                        ? ensureSubtitleStyle(selectedSlide?.subtitleStyle).letterSpacing
                        : activeField === "textbox" && selectedTextBoxId
                          ? ensureTextBoxStyle(selectedSlide?.textBoxes?.find((tb) => tb.id === selectedTextBoxId)?.style).letterSpacing
                          : 0
                  }
                  onUndo={applyUndo}
                  onRedo={applyRedo}
                  onToolbarMouseDown={handleToolbarMouseDown}
                  onRestoreSelection={restoreSelection}
                  lineHeightValue={currentLineHeight}
                  themes={themes}
                  selectedTheme={selectedThemeName}
                  onThemeSelect={handleThemeSelect}
                  isSCDT={isSCDT}
                  slideType={slideType}
                  onSlideTypeSelect={handleSlideTypeSelect}
                  isAIAssistantOpen={showAssistant}
                  onCloseAIAssistant={() => setShowAssistant(false)}
                  assistantPresentationContext={assistantPresentationContext}
                  assistantCurrentSlide={assistantCurrentSlide}
                  assistantAllSlides={assistantAllSlides}
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
                      className={`${styles.canvasSurface} ${
                        isSCDTCover ? styles.scdtCoverSlide : 
                        isSCDTContent ? styles.scdtContentSlide : 
                        isSCDTEnding ? styles.scdtEndingSlide : ""
                      }`}
                      style={{
                        backgroundImage: selectedSlide?.backgroundImage ? `url(${selectedSlide.backgroundImage})` : undefined,
                        backgroundColor: selectedSlide?.backgroundColor || undefined,
                        backgroundSize: selectedSlide?.backgroundImage ? "cover" : undefined,
                        backgroundPosition: selectedSlide?.backgroundImage ? "center" : undefined,
                      }}
                    >
                  <div
                    ref={titleRef}
                    className={styles.slideTitleInput}
                      contentEditable={!isReadOnly}
                    suppressContentEditableWarning
                    role="textbox"
                    aria-label="Slide title"
                      onClick={() => handleContentClick("title")}
                    onInput={() => handleContentInput("title")}
                    onFocus={() => handleContentFocus("title")}
                    onBlur={() => handleContentBlur("title")}
                      onMouseDown={handleTitleMouseDown}
                    style={getTextStyle("title")}
                      data-readonly={isReadOnly}
                      spellCheck={false}
                  />
                  <div
                    ref={subtitleRef}
                    className={styles.slideSubtitleInput}
                      contentEditable={!isReadOnly}
                    suppressContentEditableWarning
                    role="textbox"
                    aria-label="Slide subtitle"
                      onClick={() => handleContentClick("subtitle")}
                    onInput={() => handleContentInput("subtitle")}
                    onFocus={() => handleContentFocus("subtitle")}
                    onBlur={() => handleContentBlur("subtitle")}
                      onMouseDown={handleSubtitleMouseDown}
                    style={getTextStyle("subtitle")}
                      data-readonly={isReadOnly}
                      spellCheck={false}
                    />
                    {/* Render text boxes */}
                    {selectedSlide?.textBoxes?.map((textBox) => {
                      const textBoxStyle = ensureTextBoxStyle(textBox.style);
                      const textBoxPosition = ensureTextBoxPosition(textBox.position);
                      const isSelected = selectedTextBoxId === textBox.id;
                      return (
                        <div
                          key={textBox.id}
                          ref={(el) => {
                            if (el) {
                              textBoxRefs.current.set(textBox.id, el);
                            } else {
                              textBoxRefs.current.delete(textBox.id);
                            }
                          }}
                          className={styles.slideTitleInput}
                          contentEditable={!isReadOnly}
                          suppressContentEditableWarning
                          role="textbox"
                          aria-label="Text box"
                          onClick={() => {
                            setSelectedTextBoxId(textBox.id);
                            setActiveField("textbox");
                          }}
                          onInput={(e) => {
                            const content = e.currentTarget.innerHTML;
                            updateTextBoxContent(textBox.id, content);
                          }}
                          onFocus={() => {
                            setSelectedTextBoxId(textBox.id);
                            setActiveField("textbox");
                            syncCommandState();
                          }}
                          onBlur={(e) => {
                            const content = e.currentTarget.textContent?.trim() || "";
                            if (!content) {
                              e.currentTarget.innerHTML = "Click to edit";
                              updateTextBoxContent(textBox.id, "Click to edit");
                            }
                          }}
                          onMouseDown={(e) => {
                            if (isReadOnly) return;
                            
                            // Check if user is trying to select text or edit
                            const selection = window.getSelection();
                            if (selection && selection.rangeCount > 0) {
                              const range = selection.getRangeAt(0);
                              // If there's a text selection or cursor, allow normal editing
                              if (!range.collapsed || range.toString().length > 0) {
                                setSelectedTextBoxId(textBox.id);
                                setActiveField("textbox");
                                return; // Allow text selection and editing
                              }
                            }
                            
                            // Check if the element is already focused (user is editing)
                            if (document.activeElement === e.currentTarget) {
                              return; // Allow normal text editing
                            }
                            
                            // Set as selected immediately
                            setSelectedTextBoxId(textBox.id);
                            setActiveField("textbox");
                            
                            // Start drag detection - use lower threshold for better responsiveness
                            const startX = e.clientX;
                            const startY = e.clientY;
                            const startTime = Date.now();
                            let isDragging = false;
                            let hasStartedDrag = false;
                            
                            const handleMouseMove = (moveEvent: MouseEvent) => {
                              const deltaX = Math.abs(moveEvent.clientX - startX);
                              const deltaY = Math.abs(moveEvent.clientY - startY);
                              const deltaTime = Date.now() - startTime;
                              
                              // Lower threshold: 3px movement or 100ms - more responsive
                              if ((deltaX > 3 || deltaY > 3 || deltaTime > 100) && !isDragging) {
                                isDragging = true;
                                hasStartedDrag = true;
                                e.preventDefault();
                                
                                const canvasSurface = e.currentTarget.closest(`.${styles.canvasSurface}`);
                                if (!canvasSurface) return;
                                const canvasRect = canvasSurface.getBoundingClientRect();
                                const currentPosition = ensureTextBoxPosition(textBox.position);
                                
                                // Initialize drag
                                dragStartRef.current = {
                                  x: currentPosition.x,
                                  y: currentPosition.y,
                                  startX: startX - canvasRect.left - currentPosition.x,
                                  startY: startY - canvasRect.top - currentPosition.y,
                                  field: "textbox",
                                  textBoxId: textBox.id,
                                };
                                
                                // Prevent text selection during drag
                                e.currentTarget.style.userSelect = "none";
                                e.currentTarget.style.cursor = "grabbing";
                              }
                            };
                            
                            const handleMouseUp = () => {
                              // Restore text selection and cursor
                              if (e.currentTarget) {
                                e.currentTarget.style.userSelect = "";
                                e.currentTarget.style.cursor = "move";
                              }
                              
                              // If it was just a click (no drag), focus for editing
                              if (!hasStartedDrag && e.currentTarget && document.activeElement !== e.currentTarget) {
                                setTimeout(() => {
                                  if (document.activeElement !== e.currentTarget && e.currentTarget) {
                                    e.currentTarget.focus();
                                  }
                                }, 0);
                              }
                              
                              document.removeEventListener("mousemove", handleMouseMove);
                              document.removeEventListener("mouseup", handleMouseUp);
                            };
                            
                            document.addEventListener("mousemove", handleMouseMove);
                            document.addEventListener("mouseup", handleMouseUp);
                          }}
                          style={{
                            ...getTextStyle("title"),
                            fontFamily: textBoxStyle.fontFamily,
                            fontSize: `${textBoxStyle.fontSize}px`,
                            color: textBoxStyle.color,
                            fontWeight: textBoxStyle.bold ? "bold" : "normal",
                            fontStyle: textBoxStyle.italic ? "italic" : "normal",
                            letterSpacing: `${textBoxStyle.letterSpacing}px`,
                            transform: `translate(${textBoxPosition.x}px, ${textBoxPosition.y}px)`,
                            zIndex: textBoxPosition.zIndex,
                            position: "absolute",
                            left: 0,
                            top: 0,
                            cursor: isReadOnly ? "default" : "move",
                            direction: "rtl",
                            textAlign: "right",
                            outline: isSelected ? "2px solid #56c1b0" : "none",
                            outlineOffset: "2px",
                            minWidth: "50px",
                            minHeight: "20px",
                          }}
                          data-readonly={isReadOnly}
                          spellCheck={false}
                        />
                      );
                    })}
                    </div>
                    <div className={styles.canvasActionBar}>
                      <button type="button" onClick={handleSaveSlide} className={`${styles.canvasActionButton} ${styles.canvasActionPrimary}`}>
                        Save
                      </button>
                      <button type="button" className={`${styles.canvasActionButton} ${styles.canvasActionSecondary}`}>
                      </button>
                    </div>
                    <div
                      className={styles.slideCanvas}
                      style={{
                        background: !isSCDT ? activeThemeObj.slideBackground : undefined,
                        border: activeThemeObj.canvasBorder,
                        boxShadow: activeThemeObj.canvasShadow,
                        position: "relative",
                        overflow: "hidden",
                        ...(isSCDT ? {} : {
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "flex-start",
                          padding: "clamp(48px, 5vw, 72px)",
                          gap: "clamp(16px, 2vw, 24px)",
                        }),
                      }}
                    >
                      {isSCDTCover ? (
                        /* SCDT Cover Slide */
                        <div className={styles.scdtCoverLayout}>
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
                              {selectedSlide?.title || "Title"}
                            </div>
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
                              {selectedSlide?.subtitle || "Subtitle"}
                            </div>
                            <div className={styles.scdtCoverDate}>
                              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </div>
                          </div>
                        </div>
                      ) : isSCDTContent ? (
                        /* SCDT Content Slide - Background image and footer only */
                        <>
                          <div className={styles.scdtContentLeft}></div>
                          <div className={styles.scdtContentRight}>
                            <div className={styles.scdtFooter}>
                              <span className={styles.scdtFooterLine}>© All rights Reserved</span>
                              <span className={styles.scdtFooterLine}>Aramco Digital: General Use</span>
                              <span className={styles.scdtFooterLine}>This content has been classified as Aramco Digital: Confidential Use</span>
                            </div>
                          </div>
                        </>
                      ) : isSCDTEnding ? (
                        /* SCDT Ending Slide - Background image only, no text */
                        <div style={{ 
                          width: "100%", 
                          height: "100%",
                          position: "relative"
                        }}>
                          {/* Empty - only background image shows */}
                        </div>
                      ) : (
                        /* Normal Slide Layout (non-SCDT) */
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
                        </>
                      )}

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
                          e.currentTarget.style.backgroundColor = activeThemeObj.buttonPrimaryHover;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = activeThemeObj.buttonPrimaryBg;
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
                          e.currentTarget.style.backgroundColor = activeThemeObj.buttonPrimaryHover;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = activeThemeObj.buttonPrimaryBg;
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
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <span className={styles.badge}>Private</span>
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={isListening ? stopVoiceToText : startVoiceToText}
                              className={styles.voiceButton}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "6px 12px",
                                borderRadius: "8px",
                                border: "1px solid",
                                borderColor: isListening ? "#ef4444" : "#56c1b0",
                                background: isListening ? "#fee2e2" : "#ecfdf5",
                                color: isListening ? "#dc2626" : "#059669",
                                cursor: "pointer",
                                fontWeight: 600,
                                fontSize: "13px",
                                transition: "all 0.2s ease",
                              }}
                              title={isListening ? "Stop voice-to-text" : "Start voice-to-text"}
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill={isListening ? "#dc2626" : "#059669"}
                                style={{
                                  animation: isListening ? "pulse 1.5s ease-in-out infinite" : "none",
                                }}
                              >
                                {isListening ? (
                                  <rect x="6" y="6" width="12" height="12" rx="2" />
                                ) : (
                                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                                )}
                              </svg>
                              {isListening ? "Stop" : "Voice"}
                            </button>
                          )}
                          {transcript && !isListening && (
                            <button
                              type="button"
                              onClick={convertToBulletPoints}
                              className={styles.voiceButton}
                              style={{
                                padding: "6px 12px",
                                borderRadius: "8px",
                                border: "1px solid #d1d5db",
                                background: "#f9fafb",
                                color: "#374151",
                                cursor: "pointer",
                                fontWeight: 600,
                                fontSize: "13px",
                              }}
                              title="Convert to bullet points"
                            >
                              Convert to Bullets
                            </button>
                          )}
                      </div>
                      </header>
                      {isListening && transcript && (
                        <div
                          style={{
                            padding: "12px",
                            background: "#f0fdf4",
                            border: "1px solid #86efac",
                            borderRadius: "8px",
                            marginBottom: "8px",
                            fontSize: "14px",
                            color: "#166534",
                            maxHeight: "100px",
                            overflowY: "auto",
                          }}
                        >
                          <strong>Live transcript:</strong> {transcript}
                        </div>
                      )}
                      <textarea
                        id="speaker-notes"
                    ref={notesRef}
                        className={styles.notesTextarea}
                    value={speakerNotes || selectedSlide?.notes ?? ""}
                    onChange={handleNotesChange}
                    onFocus={handleNotesFocus}
                    onInput={(event) => autoResizeNotes(event.currentTarget)}
                    aria-label="Slide notes"
                        placeholder="Click to add speaker notes or use voice-to-text"
                        readOnly={isReadOnly}
                  />
                </div>
                  </div>
                </section>
              </div>

              <section className={styles.bottomSection}>
                <div className={styles.bottomGrid}>
                  {activeField === "title" && (
                    <section className={`${styles.bottomCard} ${styles.animationPanel}`}>
                      <header className={styles.bottomCardHeader}>
                        <div>
                          <h2 className="text-xl font-semibold text-cyan-700">Title Animation</h2>
                          <p className="text-sm text-gray-600">Control animation for the slide title.</p>
                        </div>
                      </header>
                      <div className={styles.animationControls}>
                        <div className={styles.animationRow}>
                          <label htmlFor="animation-type">Animation Type:</label>
                          <select
                            id="animation-type"
                            value={ensureTitleAnimation(selectedSlide?.titleAnimation).type}
                            onChange={(e) => updateSlideTitleAnimation({ type: e.target.value as TitleAnimation["type"] })}
                            disabled={isReadOnly}
                          >
                            <option value="none">None</option>
                            <option value="fade-in">Fade In</option>
                            <option value="slide-in">Slide In</option>
                            <option value="marquee">Marquee</option>
                          </select>
                        </div>
                        <div className={styles.animationRow}>
                          <label htmlFor="animation-duration">Duration (seconds):</label>
                          <input
                            id="animation-duration"
                            type="number"
                            min="0.1"
                            max="10"
                            step="0.1"
                            value={ensureTitleAnimation(selectedSlide?.titleAnimation).duration}
                            onChange={(e) => updateSlideTitleAnimation({ duration: parseFloat(e.target.value) || 1 })}
                            disabled={isReadOnly}
                          />
                        </div>
                        <div className={styles.animationRow}>
                          <label>
                            <input
                              type="checkbox"
                              checked={ensureTitleAnimation(selectedSlide?.titleAnimation).loop}
                              onChange={(e) => updateSlideTitleAnimation({ loop: e.target.checked })}
                              disabled={isReadOnly}
                            />
                            Loop animation
                          </label>
                        </div>
                        <div className={styles.animationButtons}>
                          <button
                            type="button"
                            onClick={startAnimation}
                            disabled={isReadOnly || ensureTitleAnimation(selectedSlide?.titleAnimation).type === "none"}
                            className={styles.animationButton}
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={pauseAnimation}
                            disabled={!isAnimating || isReadOnly}
                            className={styles.animationButton}
                          >
                            {animationPaused ? "Resume" : "Pause"}
                          </button>
                          <button
                            type="button"
                            onClick={stopAnimation}
                            disabled={!isAnimating || isReadOnly}
                            className={styles.animationButton}
                          >
                            Stop
                          </button>
                        </div>
                      </div>
                    </section>
                  )}
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

      {/* Background Picker Dropdown */}
      {isBackgroundPickerOpen && !toolbarDisabled && typeof window !== "undefined" ? createPortal(
        <div
          className={styles.backgroundDropdown}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1000,
            background: "white",
            padding: "20px",
            borderRadius: "12px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            minWidth: "300px",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: 600 }}>Background</h3>
          <div style={{ display: "grid", gap: "12px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: 500 }}>Color</label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {["#ffffff", "#f3f4f6", "#e5e7eb", "#d1d5db", "#9ca3af", "#6b7280", "#374151", "#1f2937", "#111827"].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleBackgroundColorSelect(color)}
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "8px",
                      border: "2px solid #e5e7eb",
                      background: color,
                      cursor: "pointer",
                    }}
                    aria-label={`Select ${color}`}
                  />
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={handleBackgroundImageSelect}
              style={{
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                background: "#f9fafb",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              Upload Image
            </button>
          </div>
        </div>,
        document.body
      ) : null}

      {/* Layout Picker Dropdown */}
      {isLayoutPickerOpen && !toolbarDisabled && typeof window !== "undefined" ? createPortal(
        <div
          className={styles.layoutDropdown}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1000,
            background: "white",
            padding: "20px",
            borderRadius: "12px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            minWidth: "250px",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: 600 }}>Layout</h3>
          <div style={{ display: "grid", gap: "8px" }}>
            {[
              { value: "title-only" as const, label: "Title Only" },
              { value: "title-subtitle" as const, label: "Title & Subtitle" },
              { value: "title-content" as const, label: "Title & Content" },
              { value: "blank" as const, label: "Blank" },
            ].map((layout) => (
              <button
                key={layout.value}
                type="button"
                onClick={() => handleLayoutSelect(layout.value)}
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  border: selectedSlide?.layout === layout.value ? "2px solid #56c1b0" : "1px solid #d1d5db",
                  background: selectedSlide?.layout === layout.value ? "#f0fdfa" : "white",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: selectedSlide?.layout === layout.value ? 600 : 400,
                  textAlign: "left",
                }}
              >
                {layout.label}
              </button>
            ))}
          </div>
        </div>,
        document.body
      ) : null}

      {/* Transition Picker Dropdown */}
      {isTransitionPickerOpen && !toolbarDisabled && typeof window !== "undefined" ? createPortal(
        <div
          className={styles.transitionDropdown}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1000,
            background: "white",
            padding: "20px",
            borderRadius: "12px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            minWidth: "250px",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: 600 }}>Transition</h3>
          <div style={{ display: "grid", gap: "8px" }}>
            {[
              { value: "none" as const, label: "None" },
              { value: "fade" as const, label: "Fade" },
              { value: "slide" as const, label: "Slide" },
              { value: "zoom" as const, label: "Zoom" },
            ].map((transition) => (
              <button
                key={transition.value}
                type="button"
                onClick={() => handleTransitionSelect(transition.value)}
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  border: selectedSlide?.transition === transition.value ? "2px solid #56c1b0" : "1px solid #d1d5db",
                  background: selectedSlide?.transition === transition.value ? "#f0fdfa" : "white",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: selectedSlide?.transition === transition.value ? 600 : 400,
                  textAlign: "left",
                }}
              >
                {transition.label}
              </button>
            ))}
          </div>
        </div>,
        document.body
      ) : null}

      <TeamChatWidget />
    </>
  );
}


