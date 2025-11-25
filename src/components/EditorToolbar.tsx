"use client";

import { CSSProperties, RefObject, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import styles from "@/app/editor/[id]/editor.module.css";
import SmartAssistantPanel from "@/components/SmartAssistantPanel";
import type { SlideContent, PresentationContext } from "@/services/smartAssistantService";

type AlignOption = "left" | "center" | "right";
type ListOption = "bullet" | "number";

type ToolbarActions = Record<string, (() => void) | undefined>;

type ColorOption = {
  name: string;
  value: string;
};

type ThemeOption = {
  name: string;
  swatch: string;
};

type EditorToolbarProps = {
  fontFamilies: readonly string[];
  fontSizes: readonly number[];
  lineSpacingOptions: readonly number[];
  formattingButtons: readonly string[];
  toolbarActions: ToolbarActions;
  toolbarDisabled: boolean;
  commandState: {
    fontFamily: string;
    fontSize: number;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    color: string;
    highlight: string;
    align: AlignOption;
    listType: "none" | ListOption;
  };
  highlightIndicatorStyle: CSSProperties;
  colorOptions: readonly ColorOption[];
  highlightOptions: readonly ColorOption[];
  isColorPickerOpen: boolean;
  isHighlightPickerOpen: boolean;
  isThemePickerOpen: boolean;
  onToggleColorPicker: () => void;
  onToggleHighlightPicker: () => void;
  onToggleThemePicker: () => void;
  colorButtonRef: RefObject<HTMLDivElement | null>;
  highlightButtonRef: RefObject<HTMLDivElement | null>;
  themeButtonRef: RefObject<HTMLDivElement | null>;
  onFontFamilyChange: (font: string) => void;
  onFontSizeChange: (size: number) => void;
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
  onTextColorSelect: (color: string) => void;
  onHighlightColorSelect: (color: string) => void;
  onAlign: (align: AlignOption) => void;
  onList: (type: ListOption) => void;
  onLineHeightChange: (value: number) => void;
  onLetterSpacingChange?: (value: number) => void;
  letterSpacingValue?: number;
  onUndo: () => void;
  onRedo: () => void;
  onToolbarMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onRestoreSelection: () => boolean;
  lineHeightValue: number;
  themes: readonly ThemeOption[];
  selectedTheme: string;
  onThemeSelect: (themeName: string) => void;
  isSCDT?: boolean;
  slideType?: "cover" | "content" | "ending";
  onSlideTypeSelect?: (slideType: "cover" | "content" | "ending") => void;
  isAIAssistantOpen?: boolean;
  onCloseAIAssistant?: () => void;
  assistantPresentationContext?: PresentationContext;
  assistantCurrentSlide?: SlideContent | null;
  assistantAllSlides?: SlideContent[];
  onApplyToSlide?: (data: { content?: string; notes?: string }) => void;
};

const ALIGN_OPTIONS: AlignOption[] = ["left", "center", "right"];

function alignGlyph(align: AlignOption) {
  switch (align) {
    case "center":
      return "⟷";
    case "right":
      return "⇢";
    default:
      return "⇠";
  }
}

export default function EditorToolbar({
  fontFamilies,
  fontSizes,
  lineSpacingOptions,
  formattingButtons,
  toolbarActions,
  toolbarDisabled,
  commandState,
  highlightIndicatorStyle,
  colorOptions,
  highlightOptions,
  isColorPickerOpen,
  isHighlightPickerOpen,
  isThemePickerOpen,
  onToggleColorPicker,
  onToggleHighlightPicker,
  onToggleThemePicker,
  colorButtonRef,
  highlightButtonRef,
  themeButtonRef,
  onFontFamilyChange,
  onFontSizeChange,
  onBold,
  onItalic,
  onUnderline,
  onTextColorSelect,
  onHighlightColorSelect,
  onAlign,
  onList,
  onLineHeightChange,
  onLetterSpacingChange,
  letterSpacingValue = 0,
  onUndo,
  onRedo,
  onToolbarMouseDown,
  onRestoreSelection,
  lineHeightValue,
  themes,
  selectedTheme,
  onThemeSelect,
  isSCDT = false,
  slideType,
  onSlideTypeSelect,
  isAIAssistantOpen = false,
  onCloseAIAssistant,
  assistantPresentationContext,
  assistantCurrentSlide,
  assistantAllSlides,
  onApplyToSlide,
}: EditorToolbarProps) {
  const themeButtonElementRef = useRef<HTMLButtonElement | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const aiAssistantButtonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Handle click outside to close AI Assistant popover
  useEffect(() => {
    if (!isAIAssistantOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        aiAssistantButtonRef.current &&
        !aiAssistantButtonRef.current.contains(event.target as Node)
      ) {
        onCloseAIAssistant?.();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isAIAssistantOpen, onCloseAIAssistant]);

  const updateDropdownPosition = () => {
    if (!themeButtonElementRef.current || !isThemePickerOpen) {
      setDropdownPosition(null);
      return;
    }

    const rect = themeButtonElementRef.current.getBoundingClientRect();

    // Position below button with 8px offset (using fixed positioning, no scroll offset needed)
    let top = rect.bottom + 8;
    let left = rect.left;

    // Viewport constraints with 8px padding
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const dropdownHeight = 200; // Approximate height
    const dropdownWidth = 180; // min-width from CSS

    // Check if dropdown would overflow bottom
    if (rect.bottom + dropdownHeight + 8 > viewportHeight - 8) {
      // Position above button instead
      top = rect.top - dropdownHeight - 8;
      // Ensure it doesn't go above viewport
      if (top < 8) {
        top = 8;
      }
    }

    // Check if dropdown would overflow right
    if (rect.left + dropdownWidth > viewportWidth - 8) {
      left = viewportWidth - dropdownWidth - 8;
    }

    // Check if dropdown would overflow left
    if (left < 8) {
      left = 8;
    }

    setDropdownPosition({ top, left });
  };

  useEffect(() => {
    if (isThemePickerOpen) {
      // Small delay to ensure button is rendered
      const timeoutId = setTimeout(() => {
        updateDropdownPosition();
      }, 0);
      const handleResize = () => updateDropdownPosition();
      const handleScroll = () => updateDropdownPosition();
      window.addEventListener("resize", handleResize);
      window.addEventListener("scroll", handleScroll, true);
      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("scroll", handleScroll, true);
      };
    } else {
      setDropdownPosition(null);
    }
  }, [isThemePickerOpen]);

  const renderDropdown = () => {
    if (!isThemePickerOpen || toolbarDisabled || !dropdownPosition) return null;

    const dropdownContent = (
      <div
        className={styles.themeDropdown}
        style={{
          top: `${dropdownPosition.top}px`,
          left: `${dropdownPosition.left}px`,
        }}
      >
        {themes.map((theme) => {
          const isActive = selectedTheme === theme.name;
          return (
            <button
              key={theme.name}
              type="button"
              className={`${styles.themeDropdownItem} ${isActive ? styles.themeDropdownItemActive : ""}`}
              onClick={() => {
                onThemeSelect(theme.name);
                onToggleThemePicker();
              }}
              aria-pressed={isActive}
            >
              <span className={styles.themeDropdownSwatch} style={{ background: theme.swatch }} />
              <span>{theme.name}</span>
            </button>
          );
        })}
      </div>
    );

    return typeof window !== "undefined" ? createPortal(dropdownContent, document.body) : null;
  };

  return (
    <>
      <div className={styles.toolbarRow}>
        <div className={styles.toolbar}>
          <div className={`${styles.toolbarSection} ${styles.toolbarSectionGrow}`}>
            <label className={styles.toolbarLabel} htmlFor="editor-font-selector">
              Font
            </label>
            <select
              id="editor-font-selector"
              className={styles.toolbarSelect}
              value={commandState.fontFamily}
              onFocus={onRestoreSelection}
              onChange={(event) => onFontFamilyChange(event.target.value)}
              aria-label="Font family"
              disabled={toolbarDisabled}
            >
              {fontFamilies.map((family) => (
                <option key={family} value={family}>
                  {family}
                </option>
              ))}
            </select>
            <label className={styles.toolbarLabel} htmlFor="editor-font-size">
              Size
            </label>
            <select
              id="editor-font-size"
              className={styles.toolbarSelect}
              value={commandState.fontSize}
              onFocus={onRestoreSelection}
              onChange={(event) => onFontSizeChange(Number(event.target.value))}
              aria-label="Font size"
              disabled={toolbarDisabled}
            >
              {fontSizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <label className={styles.toolbarLabel} htmlFor="editor-line-height">
              Spacing
            </label>
            <select
              id="editor-line-height"
              className={styles.toolbarSelect}
              value={String(lineHeightValue)}
              onFocus={onRestoreSelection}
              onChange={(event) => onLineHeightChange(Number(event.target.value))}
              aria-label="Line spacing"
              disabled={toolbarDisabled}
            >
              {lineSpacingOptions.map((spacing) => (
                <option key={spacing} value={spacing}>
                  {spacing}
                </option>
              ))}
            </select>
            {onLetterSpacingChange && (
              <>
                <label className={styles.toolbarLabel} htmlFor="editor-letter-spacing">
                  Letter
                </label>
                <select
                  id="editor-letter-spacing"
                  className={styles.toolbarSelect}
                  value={String(letterSpacingValue)}
                  onFocus={onRestoreSelection}
                  onChange={(event) => onLetterSpacingChange(Number(event.target.value))}
                  aria-label="Letter spacing"
                  disabled={toolbarDisabled}
                >
                  {[-2, -1, 0, 1, 2, 3, 4, 5].map((spacing) => (
                    <option key={spacing} value={spacing}>
                      {spacing}px
                    </option>
                  ))}
                </select>
              </>
            )}

            <div className={styles.toolbarGroup} ref={themeButtonRef}>
              <label className={styles.toolbarLabel}>Theme</label>
              <button
                ref={themeButtonElementRef}
                type="button"
                className={styles.toolbarThemeButton}
                onMouseDown={onToolbarMouseDown}
                onClick={onToggleThemePicker}
                aria-expanded={isThemePickerOpen}
                aria-label="Select theme"
                disabled={toolbarDisabled}
              >
                <span>{themes.find((t) => t.name === selectedTheme)?.name || "Theme"}</span>
                <span className={styles.toolbarThemeArrow}>{isThemePickerOpen ? "▲" : "▼"}</span>
              </button>
            </div>
            {isSCDT && onSlideTypeSelect && (
              <div className={styles.toolbarGroup}>
                <label className={styles.toolbarLabel}>Slide Type</label>
                <select
                  className={styles.toolbarSelect}
                  value={slideType || "content"}
                  onChange={(e) => onSlideTypeSelect(e.target.value as "cover" | "content" | "ending")}
                  disabled={toolbarDisabled}
                  onFocus={onRestoreSelection}
                >
                  <option value="cover">SCDT – Cover slide</option>
                  <option value="content">SCDT – Content slide</option>
                  <option value="ending">SCDT – Ending slide</option>
                </select>
              </div>
            )}
          </div>

        <div className={styles.toolbarDivider} role="separator" />

        <div className={`${styles.toolbarSection} ${styles.toolbarSectionCompact}`}>
          <div className={styles.toolbarGroup}>
            <button
              type="button"
              className={`${styles.toolbarButton} ${commandState.bold ? styles.toolbarButtonActive : ""}`}
              onMouseDown={onToolbarMouseDown}
              onClick={onBold}
              aria-pressed={commandState.bold}
              disabled={toolbarDisabled}
            >
              B
            </button>
            <button
              type="button"
              className={`${styles.toolbarButton} ${commandState.italic ? styles.toolbarButtonActive : ""}`}
              onMouseDown={onToolbarMouseDown}
              onClick={onItalic}
              aria-pressed={commandState.italic}
              disabled={toolbarDisabled}
            >
              <em>I</em>
            </button>
            <button
              type="button"
              className={`${styles.toolbarButton} ${commandState.underline ? styles.toolbarButtonActive : ""}`}
              onMouseDown={onToolbarMouseDown}
              onClick={onUnderline}
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
              onMouseDown={onToolbarMouseDown}
              onClick={onToggleColorPicker}
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
                <div style={{ padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.1)" }}>
                  <label style={{ display: "block", fontSize: "12px", marginBottom: "4px", fontWeight: 500 }}>
                    Custom Color
                  </label>
                  <input
                    type="color"
                    value={commandState.color === "transparent" ? "#202124" : commandState.color}
                    onChange={(e) => onTextColorSelect(e.target.value)}
                    style={{
                      width: "100%",
                      height: "32px",
                      border: "1px solid rgba(0,0,0,0.2)",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                    aria-label="Custom color picker"
                  />
                </div>
                <div style={{ padding: "8px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px" }}>
                  {colorOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.colorOption} ${
                        option.value === "transparent" ? styles.colorOptionTransparent : ""
                      }`}
                      style={{ backgroundColor: option.value === "transparent" ? undefined : option.value }}
                      onClick={() => onTextColorSelect(option.value)}
                      aria-label={`Set text color to ${option.name}`}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <div className={styles.toolbarGroup} ref={highlightButtonRef}>
            <button
              type="button"
              className={styles.colorButton}
              onMouseDown={onToolbarMouseDown}
              onClick={onToggleHighlightPicker}
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
                    onClick={() => onHighlightColorSelect(option.value)}
                    aria-label={`Set highlight color to ${option.name}`}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className={styles.toolbarDivider} role="separator" />

        <div className={`${styles.toolbarSection} ${styles.toolbarSectionCompact}`}>
          <div className={styles.toolbarGroup}>
            {ALIGN_OPTIONS.map((align) => (
              <button
                type="button"
                key={align}
                className={`${styles.toolbarButton} ${commandState.align === align ? styles.toolbarButtonActive : ""}`}
                onMouseDown={onToolbarMouseDown}
                onClick={() => onAlign(align)}
                aria-pressed={commandState.align === align}
                disabled={toolbarDisabled}
              >
                {alignGlyph(align)}
              </button>
            ))}
            <button
              type="button"
              className={`${styles.toolbarButton} ${commandState.listType === "bullet" ? styles.toolbarButtonActive : ""}`}
              onMouseDown={onToolbarMouseDown}
              onClick={() => onList("bullet")}
              aria-pressed={commandState.listType === "bullet"}
              disabled={toolbarDisabled}
            >
              •
            </button>
            <button
              type="button"
              className={`${styles.toolbarButton} ${commandState.listType === "number" ? styles.toolbarButtonActive : ""}`}
              onMouseDown={onToolbarMouseDown}
              onClick={() => onList("number")}
              aria-pressed={commandState.listType === "number"}
              disabled={toolbarDisabled}
            >
              1.
            </button>
          </div>
        </div>

        <div className={styles.toolbarDivider} role="separator" />

        <div className={`${styles.toolbarSection} ${styles.toolbarSectionCompact}`}>
          <button
            type="button"
            className={styles.toolbarButton}
            onMouseDown={onToolbarMouseDown}
            onClick={onUndo}
            disabled={toolbarDisabled}
          >
            Undo
          </button>
          <button
            type="button"
            className={styles.toolbarButton}
            onMouseDown={onToolbarMouseDown}
            onClick={onRedo}
            disabled={toolbarDisabled}
          >
            Redo
          </button>
        </div>

        <div className={styles.toolbarDivider} role="separator" />

        <div className={`${styles.toolbarSection} ${styles.toolbarSectionEnd}`} style={{ position: "relative" }}>
          {formattingButtons.map((button) => (
            <button
              type="button"
              key={button}
              ref={button === "AI Assistant" ? aiAssistantButtonRef : null}
              className={styles.toolbarButton}
              onMouseDown={onToolbarMouseDown}
              onClick={() => toolbarActions[button]?.()}
              disabled={toolbarDisabled && (button === "Image" || button === "Background")}
              style={
                button === "AI Assistant" && isAIAssistantOpen
                  ? {
                      backgroundColor: "#ecfdf5",
                      borderColor: "#10b981",
                    }
                  : undefined
              }
            >
              {button}
            </button>
          ))}
          
          {/* AI Assistant Popover */}
          {isAIAssistantOpen && formattingButtons.includes("AI Assistant") && assistantPresentationContext && (
            <div ref={popoverRef}>
              <SmartAssistantPanel
                presentationContext={assistantPresentationContext}
                currentSlide={assistantCurrentSlide}
                allSlides={assistantAllSlides}
                onApplyToSlide={onApplyToSlide}
                onClose={onCloseAIAssistant}
              />
            </div>
          )}
        </div>
      </div>
    </div>
      {renderDropdown()}
    </>
  );
}

