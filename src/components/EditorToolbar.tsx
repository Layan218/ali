"use client";

import { CSSProperties, RefObject } from "react";
import styles from "@/app/editor/[id]/editor.module.css";

type AlignOption = "left" | "center" | "right";
type ListOption = "bullet" | "number";

type ToolbarActions = Record<string, (() => void) | undefined>;

type ColorOption = {
  name: string;
  value: string;
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
  onToggleColorPicker: () => void;
  onToggleHighlightPicker: () => void;
  colorButtonRef: RefObject<HTMLDivElement | null>;
  highlightButtonRef: RefObject<HTMLDivElement | null>;
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
  onUndo: () => void;
  onRedo: () => void;
  onToolbarMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onRestoreSelection: () => boolean;
  lineHeightValue: number;
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
  onToggleColorPicker,
  onToggleHighlightPicker,
  colorButtonRef,
  highlightButtonRef,
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
  onUndo,
  onRedo,
  onToolbarMouseDown,
  onRestoreSelection,
  lineHeightValue,
}: EditorToolbarProps) {
  return (
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

        <div className={`${styles.toolbarSection} ${styles.toolbarSectionEnd}`}>
          {formattingButtons.map((button) => (
            <button
              type="button"
              key={button}
              className={styles.toolbarButton}
              onMouseDown={onToolbarMouseDown}
              onClick={() => toolbarActions[button]?.()}
              disabled={toolbarDisabled && (button === "Image" || button === "Background")}
            >
              {button}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

