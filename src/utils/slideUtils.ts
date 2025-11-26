/**
 * Utility functions and constants for slide management
 */

import type { FieldKey, SlideData, ThemeOption } from "@/types/editor";

/**
 * Formats a presentation ID into a readable title
 * Example: "my-presentation" -> "My Presentation"
 */
export function formatTitleFromId(id: string): string {
  if (!id) return "Untitled presentation";
  return id
    .split("-")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

/**
 * Placeholder text for each field type
 */
export const placeholderMap: Record<FieldKey, string> = {
  title: "Click to add title",
  subtitle: "Click to add subtitle",
  notes: "",
};

/**
 * Maps field keys to SlideData property names
 */
export const fieldKeyMap: Record<FieldKey, keyof SlideData> = {
  title: "title",
  subtitle: "subtitle",
  notes: "notes",
};

/**
 * Default theme name
 */
export const DEFAULT_THEME = "SCDT";

/**
 * Available theme options
 */
export const themes: ThemeOption[] = [
  { name: "Default", swatch: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" },
  { name: "SCDT", swatch: "linear-gradient(135deg, #1b3a4b 0%, #00b388 100%)" },
  { name: "Digital Solutions", swatch: "linear-gradient(135deg, #000000 0%, #33FF99 100%)" },
  { name: "Aramco Classic", swatch: "linear-gradient(90deg, #65b32e 0%, #00a0c6 100%)" },
];

/**
 * Initial theme to use (first theme in the list or default)
 */
export const INITIAL_THEME = themes[0]?.name ?? DEFAULT_THEME;

