"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import TeamChatWidget from "@/components/TeamChatWidget";
import styles from "./editor.module.css";

type SlideData = {
  id: string;
  title: string;
  subtitle: string;
  notes: string;
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
  { id: "slide-1", title: "Click to add title", subtitle: "Click to add subtitle", notes: "" },
  { id: "slide-2", title: "Click to add title", subtitle: "Click to add subtitle", notes: "" },
  { id: "slide-3", title: "Click to add title", subtitle: "Click to add subtitle", notes: "" },
];

export default function EditorPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const presentationId = searchParams.get("presentationId");
  const [isDark, setIsDark] = useState(false);
  const [presentationTitle, setPresentationTitle] = useState(() => formatTitleFromId(params.id));
  const [slides, setSlides] = useState<SlideData[]>(initialSlides);
  const [selectedSlideId, setSelectedSlideId] = useState(initialSlides[0].id);
  const [isFinal, setIsFinal] = useState(false);
  const [activeField, setActiveField] = useState<FieldKey>("title");
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isHighlightPickerOpen, setIsHighlightPickerOpen] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>(initialComments);
  const [newComment, setNewComment] = useState("");

  const colorButtonRef = useRef<HTMLDivElement | null>(null);
  const highlightButtonRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLDivElement | null>(null);
  const subtitleRef = useRef<HTMLDivElement | null>(null);
  const notesRef = useRef<HTMLTextAreaElement | null>(null);
  const selectionRef = useRef<Range | null>(null);

  const [formatting, setFormatting] = useState<Record<FieldKey, { lineHeight: number }>>({
    title: { lineHeight: 1.2 },
    subtitle: { lineHeight: 1.3 },
    notes: { lineHeight: 1.4 },
  });

  const [commandState, setCommandState] = useState({
    fontFamily: "Calibri",
    fontSize: 14,
    bold: false,
    italic: false,
    underline: false,
    color: "#202124",
    highlight: "transparent",
    align: "left",
    listType: "none" as "none" | "bullet" | "number",
  });

  const selectedSlide = useMemo(
    () => slides.find((slide) => slide.id === selectedSlideId) ?? slides[0],
    [selectedSlideId, slides]
  );
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
    if (!selectedSlide) return;
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
  }, [selectedSlide, formatting.title.lineHeight, formatting.subtitle.lineHeight, formatting.notes.lineHeight]);

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
    setActiveField(field);
    setIsColorPickerOpen(false);
    setIsHighlightPickerOpen(false);
  };

  const handleNotesChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateSlideField("notes", event.target.value);
  };

  const handleNotesFocus = () => {
    setActiveField("notes");
    setIsColorPickerOpen(false);
    setIsHighlightPickerOpen(false);
  };

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

  const applyAlign = (align: "left" | "center" | "right") => {
    const command = align === "center" ? "justifyCenter" : align === "right" ? "justifyRight" : "justifyLeft";
    execWithCommand(command);
  };

  const applyList = (type: "bullet" | "number") => {
    const command = type === "bullet" ? "insertUnorderedList" : "insertOrderedList";
    execWithCommand(command);
  };

  const applyLineHeight = (value: number) => {
    if (!isEditableField) return;
    const ref = getFieldRef(activeField);
    if (!ref) return;
    ref.style.lineHeight = value.toString();
    setFormatting((prev) => ({
      ...prev,
      [activeField]: { lineHeight: value },
    }));
    syncActiveFieldContent(activeField);
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
      const newSlide: SlideData = {
        id: `slide-${nextIndex}-${Date.now()}`,
        title: placeholderMap.title,
        subtitle: placeholderMap.subtitle,
        notes: "",
      };
      setSelectedSlideId(newSlide.id);
      return [...prev, newSlide];
    });
  };

  const handleSaveSlide = () => {
    syncActiveFieldContent("title");
    syncActiveFieldContent("subtitle");
    if (notesRef.current) {
      updateSlideField("notes", notesRef.current.value);
    }
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

  const toolbarDisabled = !isEditableField;

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

  const getTextStyle = (field: FieldKey): CSSProperties => ({
    lineHeight: `${formatting[field]?.lineHeight ?? 1.2}`,
    whiteSpace: "pre-wrap",
  });

  const handleOpenSlideshow = () => {
    const fallbackId = slides[0]?.id ?? "";
    const targetId = selectedSlideId || fallbackId;
    if (targetId) {
      const params = new URLSearchParams({ slideId: targetId });
      if (presentationId) params.set("presentationId", presentationId);
      router.push(`/viewer?${params.toString()}`);
    } else {
      router.push("/viewer");
    }
  };

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
          <a className={styles.primary} href="#">
            Try Work Presentation
          </a>
          <a className={styles.secondary} href="/login">
            Sign in
          </a>
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
                      />
                      <span className={`${styles.statusBadge} ${isFinal ? styles.statusFinal : styles.statusDraft}`}>
                        {isFinal ? "Final" : "Draft"}
                      </span>
                      <button
                        type="button"
                        className={styles.statusToggle}
                        onClick={() => setIsFinal((value) => !value)}
                      >
                        {isFinal ? "Mark as Draft" : "Mark as Final"}
                      </button>
                    </div>
                    <span className={styles.productName}>Secure Presentation Tool</span>
                  </div>
                </div>

                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.slideshowButton}
                    onClick={() => {
                      if (presentationId) {
                        router.push(`/dashboard?presentationId=${encodeURIComponent(presentationId)}`);
                      } else {
                        router.push("/dashboard");
                      }
                    }}
                  >
                    Back to Dashboard
                  </button>
                  <button type="button" className={styles.shareButton}>
                    Share
                  </button>
                  <button type="button" className={styles.slideshowButton} onClick={handleOpenSlideshow}>
                    Slideshow
                  </button>
                </div>
              </div>

              <div className={styles.toolbarRow}>
                <div className={styles.toolbar}>
                  <div className={styles.toolbarGroup}>
                    <select
                      className={styles.toolbarSelect}
                      value={commandState.fontFamily}
                      onFocus={restoreSelection}
                      onChange={(event) => applyFontFamily(event.target.value)}
                      aria-label="Font family"
                      disabled={toolbarDisabled}
                    >
                      {fontFamilies.map((family) => (
                        <option key={family} value={family}>
                          {family}
                        </option>
                      ))}
                    </select>

                    <select
                      className={styles.toolbarSelect}
                      value={commandState.fontSize}
                      onFocus={restoreSelection}
                      onChange={(event) => applyFontSize(Number(event.target.value))}
                      aria-label="Font size"
                      disabled={toolbarDisabled}
                    >
                      {fontSizes.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.toolbarGroup}>
                    <button
                      type="button"
                      className={`${styles.toolbarButton} ${commandState.bold ? styles.toolbarButtonActive : ""}`}
                      onMouseDown={handleToolbarMouseDown}
                      onClick={toggleBold}
                      aria-pressed={commandState.bold}
                      disabled={toolbarDisabled}
                    >
                      B
                    </button>
                    <button
                      type="button"
                      className={`${styles.toolbarButton} ${commandState.italic ? styles.toolbarButtonActive : ""}`}
                      onMouseDown={handleToolbarMouseDown}
                      onClick={toggleItalic}
                      aria-pressed={commandState.italic}
                      disabled={toolbarDisabled}
                    >
                      <em>I</em>
                    </button>
                    <button
                      type="button"
                      className={`${styles.toolbarButton} ${commandState.underline ? styles.toolbarButtonActive : ""}`}
                      onMouseDown={handleToolbarMouseDown}
                      onClick={toggleUnderline}
                      aria-pressed={commandState.underline}
                      disabled={toolbarDisabled}
                    >
                      <span className={styles.toolbarUnderline}>U</span>
                    </button>
                  </div>

                  <div className={styles.toolbarGroup} ref={colorButtonRef}>
                    <button
                      type="button"
                      className={styles.colorButton}
                      onMouseDown={handleToolbarMouseDown}
                      onClick={() => setIsColorPickerOpen((value) => !value)}
                      aria-expanded={isColorPickerOpen}
                      aria-label="Text color"
                      disabled={toolbarDisabled}
                    >
                      <span
                        className={`${styles.colorIndicator} ${
                          commandState.color === "transparent" ? styles.colorIndicatorTransparent : ""
                        }`}
                        style={{ backgroundColor: commandState.color === "transparent" ? undefined : commandState.color }}
                      />
                    </button>
                    {isColorPickerOpen && !toolbarDisabled ? (
                      <div className={styles.colorPopover}>
                        {colorOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={`${styles.colorOption} ${
                              option.value === "transparent" ? styles.colorOptionTransparent : ""
                            }`}
                            style={{ backgroundColor: option.value === "transparent" ? undefined : option.value }}
                            onClick={() => applyTextColor(option.value)}
                            aria-label={`Set text color to ${option.name}`}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className={styles.toolbarGroup} ref={highlightButtonRef}>
                    <button
                      type="button"
                      className={styles.colorButton}
                      onMouseDown={handleToolbarMouseDown}
                      onClick={() => setIsHighlightPickerOpen((value) => !value)}
                      aria-expanded={isHighlightPickerOpen}
                      aria-label="Highlight color"
                      disabled={toolbarDisabled}
                    >
                      <span
                        className={`${styles.colorIndicator} ${
                          commandState.highlight === "transparent" ? styles.colorIndicatorTransparent : ""
                        }`}
                        style={highlightIndicatorStyle}
                      />
                    </button>
                    {isHighlightPickerOpen && !toolbarDisabled ? (
                      <div className={styles.colorPopover}>
                        {highlightOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={`${styles.colorOption} ${
                              option.value === "transparent" ? styles.colorOptionTransparent : ""
                            }`}
                            style={{ backgroundColor: option.value === "transparent" ? undefined : option.value }}
                            onClick={() => applyHighlightColor(option.value)}
                            aria-label={`Set highlight color to ${option.name}`}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className={styles.toolbarGroup}>
                    {(["left", "center", "right"] as const).map((align) => (
                      <button
                        type="button"
                        key={align}
                        className={`${styles.toolbarButton} ${
                          commandState.align === align ? styles.toolbarButtonActive : ""
                        }`}
                        onMouseDown={handleToolbarMouseDown}
                        onClick={() => applyAlign(align)}
                        aria-pressed={commandState.align === align}
                        disabled={toolbarDisabled}
                      >
                        {align === "left" ? "⟸" : align === "center" ? "⇔" : "⟹"}
                      </button>
                    ))}
                  </div>

                  <div className={styles.toolbarGroup}>
                    <button
                      type="button"
                      className={`${styles.toolbarButton} ${
                        commandState.listType === "bullet" ? styles.toolbarButtonActive : ""
                      }`}
                      onMouseDown={handleToolbarMouseDown}
                      onClick={() => applyList("bullet")}
                      aria-pressed={commandState.listType === "bullet"}
                      disabled={toolbarDisabled}
                    >
                      •
                    </button>
                    <button
                      type="button"
                      className={`${styles.toolbarButton} ${
                        commandState.listType === "number" ? styles.toolbarButtonActive : ""
                      }`}
                      onMouseDown={handleToolbarMouseDown}
                      onClick={() => applyList("number")}
                      aria-pressed={commandState.listType === "number"}
                      disabled={toolbarDisabled}
                    >
                      1.
                    </button>
                  </div>

                  <div className={styles.toolbarGroup}>
                    <select
                      className={styles.toolbarSelect}
                      value={String(formatting[activeField]?.lineHeight ?? 1.2)}
                      onFocus={restoreSelection}
                      onChange={(event) => applyLineHeight(Number(event.target.value))}
                      aria-label="Line spacing"
                      disabled={toolbarDisabled}
                    >
                      {lineSpacingOptions.map((spacing) => (
                        <option key={spacing} value={spacing}>
                          {spacing}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={`${styles.toolbarGroup} ${styles.toolbarSpacer}`}>
                    {formattingButtons.map((button) => (
                      <button
                        type="button"
                        key={button}
                        className={styles.toolbarButton}
                        onMouseDown={handleToolbarMouseDown}
                        onClick={() => toolbarActions[button]?.()}
                      >
                        {button}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </header>

            <div className={styles.editorLayout}>
              <aside className={styles.slidesSidebar}>
                <div className={styles.slideList}>
                  {slides.map((slide, index) => {
                    const isActive = slide.id === selectedSlideId;
                    return (
                      <button
                        type="button"
                        key={slide.id}
                        className={`${styles.slideItem} ${isActive ? styles.slideItemActive : ""}`}
                        onClick={() => setSelectedSlideId(slide.id)}
                      >
                        <span className={styles.slideNumber}>{index + 1}</span>
                        <div className={styles.slideThumb} aria-hidden />
                      </button>
                    );
                  })}
                </div>
                <button type="button" className={styles.newSlideButton} onClick={handleAddSlide}>
                  + New slide
                </button>
              </aside>

              <main className={styles.canvasArea}>
                <div className={styles.slideCanvas}>
                  <div
                    ref={titleRef}
                    className={styles.slideTitleInput}
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-label="Slide title"
                    onInput={() => handleContentInput("title")}
                    onFocus={() => handleContentFocus("title")}
                    onBlur={() => handleContentBlur("title")}
                    style={getTextStyle("title")}
                  />
                  <div
                    ref={subtitleRef}
                    className={styles.slideSubtitleInput}
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-label="Slide subtitle"
                    onInput={() => handleContentInput("subtitle")}
                    onFocus={() => handleContentFocus("subtitle")}
                    onBlur={() => handleContentBlur("subtitle")}
                    style={getTextStyle("subtitle")}
                  />
                </div>

                <div className={styles.slideActions}>
                  <button
                    type="button"
                    className={`${styles.actionButton} ${styles.actionPrimary}`}
                    onClick={handleSaveSlide}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className={styles.actionButton}
                    onClick={handleMoveUp}
                    disabled={isFirstSlide}
                  >
                    Move Up
                  </button>
                  <button
                    type="button"
                    className={styles.actionButton}
                    onClick={handleMoveDown}
                    disabled={isLastSlide}
                  >
                    Move Down
                  </button>
                  <button
                    type="button"
                    className={`${styles.actionButton} ${styles.actionDanger}`}
                    onClick={handleDeleteSlide}
                    disabled={!canDeleteSlide}
                  >
                    Delete Slide
                  </button>
                </div>

                <section className={styles.themeSection} aria-labelledby="theme-section-heading">
                  <div className={styles.themeHeader}>
                    <h2 id="theme-section-heading" className={styles.themeTitle}>
                      Themes
                    </h2>
                    <span className={styles.themeSubtitle}>Quickly explore presentation looks.</span>
                  </div>
                  <div className={styles.themeRow}>
                    {themes.map((theme) => (
                      <div key={theme.name} className={styles.themeCard}>
                        <div className={styles.themeSwatch} style={{ background: theme.swatch }} />
                        <div className={styles.themeName}>{theme.name}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <div className={styles.notesArea}>
                  <div className={styles.notesLabel}>Click to add speaker notes</div>
                  <textarea
                    ref={notesRef}
                    className={styles.notesInput}
                    value={selectedSlide?.notes ?? ""}
                    onChange={handleNotesChange}
                    onFocus={handleNotesFocus}
                    aria-label="Slide notes"
                  />
                </div>
              </main>

              <aside className={styles.themesPanel}>
                <div className={styles.commentsSection}>
                  <div className={styles.commentsHeader}>Comments</div>
                  <div className={styles.commentsList}>
                    {comments.map((comment) => (
                      <div key={comment.id} className={styles.commentItem}>
                        <div className={styles.commentMeta}>
                          <span className={styles.commentAuthor}>{comment.author}</span>
                          <span className={styles.commentTimestamp}>{comment.timestamp}</span>
                        </div>
                        <p className={styles.commentMessage}>{comment.message}</p>
                      </div>
                    ))}
                  </div>
                  <form className={styles.commentComposer} onSubmit={handleCommentSubmit}>
                    <label htmlFor="new-comment" className={styles.commentLabel}>
                      Add a comment
                    </label>
                    <textarea
                      id="new-comment"
                      className={styles.commentInput}
                      value={newComment}
                      onChange={(event) => setNewComment(event.target.value)}
                      placeholder="Share feedback for the team..."
                      rows={3}
                    />
                    <button type="submit" className={`${styles.commentButton} ${styles.actionPrimary}`}>
                      Add Comment
                    </button>
                  </form>
                </div>
              </aside>
            </div>
          </div>

          <footer className={styles.footer}>© 2025 Aramco Digital – Secure Presentation Tool</footer>
        </div>
      </main>

      <TeamChatWidget />
    </>
  );
}


