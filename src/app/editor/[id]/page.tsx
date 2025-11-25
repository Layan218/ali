"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import TeamChatWidget from "@/components/TeamChatWidget";
import ThemeToggle from "@/components/ThemeToggle";
import { useTheme } from "@/hooks/useTheme";
import styles from "./editor.module.css";
import EditorToolbar from "@/components/EditorToolbar";
import {
  markPresentationSaved,
  readPresentationMeta,
  updatePresentationStatus,
} from "@/lib/presentationMeta";
import { saveSlidesToFirebase } from "@/lib/saveSlidesToFirebase";

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

const formattingButtons = ["Undo", "Redo", "Image", "Background", "Layout", "Theme", "Transition", "Add Text"] as const;
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

const DEFAULT_THEME = "Aramco Classic";

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
    title: placeholderMap.title,
    subtitle: placeholderMap.subtitle,
    notes: "",
    theme: INITIAL_THEME,
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
    formatting: createDefaultFormatting(),
    titleStyle: { ...DEFAULT_TITLE_STYLE },
    titlePosition: { ...DEFAULT_TITLE_POSITION },
    titleAnimation: { ...DEFAULT_TITLE_ANIMATION },
    subtitleStyle: { ...DEFAULT_SUBTITLE_STYLE },
    subtitlePosition: { ...DEFAULT_SUBTITLE_POSITION },
  },
];

export default function EditorPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const presentationId = searchParams.get("presentationId");
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [presentationTitle, setPresentationTitle] = useState(() => formatTitleFromId(params.id));
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
  const [comments, setComments] = useState<CommentItem[]>(initialComments);
  const [newComment, setNewComment] = useState("");
  const storageKey = useMemo(() => `presentation-${params.id}-slides`, [params.id]);
  
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
  const currentSlideIndex = slides.findIndex((slide) => slide.id === selectedSlideId);
  const isFirstSlide = currentSlideIndex <= 0;
  const isLastSlide = currentSlideIndex === slides.length - 1;
  const canDeleteSlide = slides.length > 1;

  useEffect(() => {
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
        prev.map((slide) =>
          slide.id === selectedSlideId
            ? {
                ...slide,
                theme: themeName,
              }
            : slide
        )
      );
    },
    [selectedSlideId]
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

  const handleAddSlide = () => {
    setSlides((prev) => {
      const nextIndex = prev.length + 1;
      const themeName = selectedThemeName || themes[0]?.name || DEFAULT_THEME;
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
    if (presentationId) {
      const slideSummary = slides.map((slide) => ({
        id: slide.id,
        title: typeof slide.title === "string" ? slide.title : "",
        subtitle: typeof slide.subtitle === "string" ? slide.subtitle : "",
        notes: typeof slide.notes === "string" ? slide.notes : "",
      }));
      markPresentationSaved(presentationId, presentationTitle, slideSummary, status);

      // Save slides to Firebase
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

  const handleDeleteSlide = () => {
    if (!canDeleteSlide) {
      return;
    }
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
  };

  const currentFormatting = selectedSlide ? ensureFormatting(selectedSlide.formatting) : DEFAULT_FORMATTING;

  const getTextStyle = (field: FieldKey): CSSProperties => ({
    lineHeight: `${currentFormatting[field]?.lineHeight ?? DEFAULT_FORMATTING[field].lineHeight}`,
    whiteSpace: "pre-wrap",
    direction: "rtl", // Right-to-left text direction
    textAlign: "right", // Align text to the right
  });

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
                        Share
                      </button>
                  <button
                    type="button"
                        onClick={handleOpenSlideshow}
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
                    value={selectedSlide?.notes ?? ""}
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


