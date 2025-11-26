/**
 * Utility functions and constants for text formatting
 */

import type { SlideFormatting } from "@/types/editor";

/**
 * Default formatting values for slide fields
 */
export const DEFAULT_FORMATTING: SlideFormatting = {
  title: { lineHeight: 1.2 },
  subtitle: { lineHeight: 1.3 },
  notes: { lineHeight: 1.4 },
};

/**
 * Creates a new SlideFormatting object with default values
 */
export function createDefaultFormatting(): SlideFormatting {
  return {
    title: { lineHeight: DEFAULT_FORMATTING.title.lineHeight },
    subtitle: { lineHeight: DEFAULT_FORMATTING.subtitle.lineHeight },
    notes: { lineHeight: DEFAULT_FORMATTING.notes.lineHeight },
    bold: false,
    italic: false,
    underline: false,
    align: "left",
    listType: "none",
  };
}

/**
 * Ensures a SlideFormatting object has all required fields with defaults
 * Used to normalize formatting objects that may be missing some properties
 */
export function ensureFormatting(formatting?: SlideFormatting): SlideFormatting {
  return {
    title: { lineHeight: formatting?.title?.lineHeight ?? DEFAULT_FORMATTING.title.lineHeight },
    subtitle: { lineHeight: formatting?.subtitle?.lineHeight ?? DEFAULT_FORMATTING.subtitle.lineHeight },
    notes: { lineHeight: formatting?.notes?.lineHeight ?? DEFAULT_FORMATTING.notes.lineHeight },
    bold: formatting?.bold ?? false,
    italic: formatting?.italic ?? false,
    underline: formatting?.underline ?? false,
    align: formatting?.align ?? "left",
    listType: formatting?.listType ?? "none",
  };
}

/**
 * Available font families
 */
export const fontFamilies = ["Calibri", "Arial", "Roboto"];

/**
 * Available font sizes
 */
export const fontSizes = [12, 14, 18, 24, 32, 40];

/**
 * Available line spacing options
 */
export const lineSpacingOptions = [1, 1.15, 1.5, 2];

/**
 * Available text color options
 */
export const colorOptions = [
  { name: "Default", value: "#202124" },
  { name: "Teal", value: "#56c1b0" },
  { name: "Slate", value: "#1e293b" },
  { name: "Cloud", value: "#9ca3af" },
];

/**
 * Available highlight color options
 */
export const highlightOptions = [
  { name: "None", value: "transparent" },
  { name: "Teal", value: "rgba(86, 193, 176, 0.25)" },
  { name: "Sunrise", value: "rgba(250, 204, 21, 0.3)" },
  { name: "Slate", value: "rgba(148, 163, 184, 0.28)" },
];

/**
 * Maps font sizes to document.execCommand font size values
 */
export const FONT_SIZE_TO_COMMAND: Record<number, string> = {
  12: "2",
  14: "3",
  18: "4",
  24: "5",
  32: "6",
  40: "7",
};

/**
 * Maps document.execCommand font size values to actual font sizes
 */
export const COMMAND_TO_FONT_SIZE: Record<string, number> = {
  "1": 12,
  "2": 12,
  "3": 14,
  "4": 18,
  "5": 24,
  "6": 32,
  "7": 40,
};

/**
 * Available formatting button options
 */
export const formattingButtons = [
  "Undo",
  "Redo",
  "Image",
  "Background",
  "Layout",
  "Theme",
  "AI Assistant",
] as const;

