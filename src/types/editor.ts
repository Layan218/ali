/**
 * Type definitions for the editor component
 */

export type FieldKey = "title" | "subtitle" | "notes";

export type AlignOption = "left" | "center" | "right";

export type SlideFormatting = Record<FieldKey, { lineHeight: number }> & {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: "left" | "center" | "right";
  listType?: "none" | "bullets" | "numbers";
};

export type SlideData = {
  id: string;
  order?: number;
  title: string;
  subtitle: string;
  content?: string; // For AI template slides
  notes: string;
  theme: string;
  slideType?: "cover" | "content" | "ending"; // SCDT slide type
  templateId?: string; // AI template identifier
  formatting: SlideFormatting;
  imageUrl?: string; // Optional image URL
  imageX?: number; // Image X position (percentage)
  imageY?: number; // Image Y position (percentage)
  imageWidth?: number; // Image width (percentage)
  imageHeight?: number; // Image height (percentage)
  background?: "default" | "soft" | "dark"; // Optional background
  layout?: "layout1" | "layout2" | "layout3"; // Optional layout
};

export type VersionSnapshotSlide = {
  slideId: string;
  order: number;
  title: string;
  encryptedContent: string;
  encryptedNotes: string;
  theme: string;
  slideType?: "cover" | "content" | "ending";
};

export type PresentationVersion = {
  id: string;
  createdAt: Date | null;
  createdBy: string | null;
  summary: string;
  slidesSnapshot: VersionSnapshotSlide[];
};

export type ThemeOption = {
  name: string;
  swatch: string;
};

export type SlideSnapshot = {
  slideId: string;
  titleHtml: string;
  subtitleHtml: string;
  contentHtml: string;
  notesText: string;
};

export type CommentItem = {
  id: string;
  author: string;
  message: string;
  timestamp: string;
};

export type CommandState = {
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

