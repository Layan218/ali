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
  currentFormatting?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    align?: "left" | "center" | "right";
    listType?: "none" | "bullets" | "numbers";
  };
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
  currentFormatting,
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

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Handle click outside to close theme dropdown
  useEffect(() => {
    if (!isThemePickerOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if click is outside both the button and the dropdown
      const isOutsideButton = themeButtonElementRef.current && !themeButtonElementRef.current.contains(target);
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(target);
      
      // Also check if the click is on a theme dropdown item (should not close)
      const isThemeItem = target.closest(`.${styles.themeDropdownItem}`);
      
      if (isOutsideButton && isOutsideDropdown && !isThemeItem) {
        onToggleThemePicker();
      }
    };

    // Use a small delay to avoid immediate closure when opening
    const timeoutId = setTimeout(() => {
      document.addEventListener("click", handleClickOutside, true);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("click", handleClickOutside, true);
    };
  }, [isThemePickerOpen, onToggleThemePicker]);

  const renderDropdown = () => {
    if (!isThemePickerOpen || !dropdownPosition) return null;

    const dropdownContent = (
      <div
        ref={dropdownRef}
        className={styles.themeDropdown}
        style={{
          top: `${dropdownPosition.top}px`,
          left: `${dropdownPosition.left}px`,
        }}
        onClick={(e) => {
          // Prevent clicks inside dropdown from closing it
          e.stopPropagation();
        }}
      >
        {themes.map((theme) => {
          const isActive = selectedTheme === theme.name;
          return (
            <button
              key={theme.name}
              type="button"
              className={`${styles.themeDropdownItem} ${isActive ? styles.themeDropdownItemActive : ""}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("🎯 Theme button clicked:", theme.name);
                // Call theme select handler immediately - this MUST happen synchronously
                if (onThemeSelect) {
                  console.log("✅ Calling onThemeSelect with:", theme.name);
                  onThemeSelect(theme.name);
                } else {
                  console.error("❌ onThemeSelect is not defined!");
                }
                // Close dropdown immediately
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
                disabled={false}
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
              className={`${styles.toolbarButton} ${(currentFormatting?.bold ?? commandState.bold) ? styles.toolbarButtonActive : ""}`}
              onMouseDown={onToolbarMouseDown}
              onClick={onBold}
              aria-pressed={currentFormatting?.bold ?? commandState.bold}
              disabled={toolbarDisabled}
            >
              B
            </button>
            <button
              type="button"
              className={`${styles.toolbarButton} ${(currentFormatting?.italic ?? commandState.italic) ? styles.toolbarButtonActive : ""}`}
              onMouseDown={onToolbarMouseDown}
              onClick={onItalic}
              aria-pressed={currentFormatting?.italic ?? commandState.italic}
              disabled={toolbarDisabled}
            >
              <em>I</em>
            </button>
            <button
              type="button"
              className={`${styles.toolbarButton} ${(currentFormatting?.underline ?? commandState.underline) ? styles.toolbarButtonActive : ""}`}
              onMouseDown={onToolbarMouseDown}
              onClick={onUnderline}
              aria-pressed={currentFormatting?.underline ?? commandState.underline}
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
            {ALIGN_OPTIONS.map((align) => {
              const isActive = currentFormatting?.align !== undefined 
                ? currentFormatting.align === align 
                : commandState.align === align;
              return (
                <button
                  type="button"
                  key={align}
                  className={`${styles.toolbarButton} ${isActive ? styles.toolbarButtonActive : ""}`}
                  onMouseDown={onToolbarMouseDown}
                  onClick={() => onAlign(align)}
                  aria-pressed={isActive}
                  disabled={toolbarDisabled}
                >
                  {alignGlyph(align)}
                </button>
              );
            })}
            <button
              type="button"
              className={`${styles.toolbarButton} ${(currentFormatting?.listType === "bullets" || (!currentFormatting && commandState.listType === "bullet")) ? styles.toolbarButtonActive : ""}`}
              onMouseDown={onToolbarMouseDown}
              onClick={() => onList("bullet")}
              aria-pressed={currentFormatting?.listType === "bullets" || (!currentFormatting && commandState.listType === "bullet")}
              disabled={toolbarDisabled}
            >
              •
            </button>
            <button
              type="button"
              className={`${styles.toolbarButton} ${(currentFormatting?.listType === "numbers" || (!currentFormatting && commandState.listType === "number")) ? styles.toolbarButtonActive : ""}`}
              onMouseDown={onToolbarMouseDown}
              onClick={() => onList("number")}
              aria-pressed={currentFormatting?.listType === "numbers" || (!currentFormatting && commandState.listType === "number")}
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
              onClick={() => {
                if (toolbarDisabled && button !== "Theme" && button !== "AI Assistant") return;
                const action = toolbarActions[button];
                if (action) {
                  action();
                } else {
                  console.log(`${button} feature coming soon`);
                }
              }}
              disabled={toolbarDisabled && button !== "Theme" && button !== "AI Assistant"}
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

