"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import TeamChatWidget from "@/components/TeamChatWidget";
import styles from "./editor.module.css";
import EditorToolbar from "@/components/EditorToolbar";
import {
  markPresentationSaved,
  readPresentationMeta,
  updatePresentationStatus,
} from "@/lib/presentationMeta";

const VIEWER_RETURN_KEY = "viewer-return-url";
const VIEWER_STATE_KEY = "viewer-state";

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

type AlignOption = "left" | "center" | "right";

type SlideFormatting = Record<FieldKey, { lineHeight: number }>;

type SlideData = {
  id: string;
  title: string;
  subtitle: string;
  notes: string;
  theme: string;
  formatting: SlideFormatting;
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
  },
  {
    id: "slide-2",
    title: placeholderMap.title,
    subtitle: placeholderMap.subtitle,
    notes: "",
    theme: INITIAL_THEME,
    formatting: createDefaultFormatting(),
  },
  {
    id: "slide-3",
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
  const [isDark, setIsDark] = useState(false);
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
  const storageKey = useMemo(() => `presentation-${params.id}-slides`, [params.id]);

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
  const currentSlideIndex = slides.findIndex((slide) => slide.id === selectedSlideId);
  const isFirstSlide = currentSlideIndex <= 0;
  const isLastSlide = currentSlideIndex === slides.length - 1;
  const canDeleteSlide = slides.length > 1;

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldDark = saved ? saved === "dark" : prefersDark;
    setIsDark(shouldDark);
    if (shouldDark) document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

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
    if (!selectedSlide) return;
    const formatting = selectedSlide.formatting ?? DEFAULT_FORMATTING;
    if (titleRef.current) {
      titleRef.current.innerHTML = selectedSlide.title || placeholderMap.title;
      titleRef.current.style.lineHeight = `${formatting.title.lineHeight}`;
    }
    if (subtitleRef.current) {
      subtitleRef.current.innerHTML = selectedSlide.subtitle || placeholderMap.subtitle;
      subtitleRef.current.style.lineHeight = `${formatting.subtitle.lineHeight}`;
    }
    if (notesRef.current) {
      notesRef.current.style.lineHeight = `${formatting.notes.lineHeight}`;
    }
  }, [selectedSlide]);

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

  const handleSaveSlide = () => {
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

  const getTextStyle = (field: FieldKey): CSSProperties => ({
    lineHeight: `${currentFormatting[field]?.lineHeight ?? DEFAULT_FORMATTING[field].lineHeight}`,
    whiteSpace: "pre-wrap",
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

  const toggleColorPicker = () => setIsColorPickerOpen((prev) => !prev);
  const toggleHighlightPicker = () => setIsHighlightPickerOpen((prev) => !prev);
  const toggleThemePicker = () => setIsThemePickerOpen((prev) => !prev);
  const currentLineHeight =
    currentFormatting[activeField]?.lineHeight ?? DEFAULT_FORMATTING[activeField]?.lineHeight ?? 1.2;

  const isReadOnly = status === "final";

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
            onClick={() => setIsDark((value) => !value)}
            className={styles.themeToggle}
          >
            {isDark ? (
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
                    <div className={styles.canvasSurface}>
                    <div
                      ref={titleRef}
                      className={styles.slideTitleInput}
                      contentEditable={!isReadOnly}
                      suppressContentEditableWarning
                      role="textbox"
                      aria-label="Slide title"
                      onInput={() => handleContentInput("title")}
                      onFocus={() => handleContentFocus("title")}
                      onBlur={() => handleContentBlur("title")}
                      style={getTextStyle("title")}
                      data-readonly={isReadOnly}
                    />
                    <div
                      ref={subtitleRef}
                      className={styles.slideSubtitleInput}
                      contentEditable={!isReadOnly}
                      suppressContentEditableWarning
                      role="textbox"
                      aria-label="Slide subtitle"
                      onInput={() => handleContentInput("subtitle")}
                      onFocus={() => handleContentFocus("subtitle")}
                      onBlur={() => handleContentBlur("subtitle")}
                      style={getTextStyle("subtitle")}
                      data-readonly={isReadOnly}
                    />
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

      <TeamChatWidget />
    </>
  );
}


