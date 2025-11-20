/**
 * Professional Presentation Themes
 * Three polished themes for Aramco Digital presentations
 */

export type ThemeId = "aramco-classic" | "desert-dusk" | "executive-slate" | "innovation-sky";

export interface PresentationTheme {
  id: ThemeId;
  name: string;
  // Slide background
  slideBackground: string;
  // Title styling
  titleFontSize: string;
  titleFontWeight: number;
  titleColor: string;
  titleLineHeight: number;
  // Bullet text styling
  bulletFontSize: string;
  bulletFontWeight: number;
  bulletColor: string;
  bulletLineHeight: number;
  // Button styles
  buttonPrimaryBg: string;
  buttonPrimaryColor: string;
  buttonPrimaryHover: string;
  buttonSecondaryBg: string;
  buttonSecondaryColor: string;
  buttonSecondaryBorder: string;
  // Toolbar
  toolbarBg: string;
  toolbarBorder: string;
  // Slide canvas
  canvasBg: string;
  canvasBorder: string;
  canvasShadow: string;
  // Swatch for theme picker
  swatch: string;
}

export const themes: Record<ThemeId, PresentationTheme> = {
  "aramco-classic": {
    id: "aramco-classic",
    name: "Aramco Classic",
    slideBackground: "linear-gradient(135deg, #f0fdfa 0%, #ffffff 100%)",
    titleFontSize: "clamp(32px, 3.5vw, 48px)",
    titleFontWeight: 600,
    titleColor: "#0d9488", // Soft teal
    titleLineHeight: 1.2,
    bulletFontSize: "clamp(16px, 1.8vw, 20px)",
    bulletFontWeight: 400,
    bulletColor: "#1e293b",
    bulletLineHeight: 1.6,
    buttonPrimaryBg: "#0d9488",
    buttonPrimaryColor: "#ffffff",
    buttonPrimaryHover: "#0f766e",
    buttonSecondaryBg: "#ffffff",
    buttonSecondaryColor: "#0d9488",
    buttonSecondaryBorder: "#0d9488",
    toolbarBg: "#ffffff",
    toolbarBorder: "#e2e8f0",
    canvasBg: "#ffffff",
    canvasBorder: "1px solid #cbd5e1",
    canvasShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    swatch: "linear-gradient(135deg, #0d9488 0%, #5eead4 100%)",
  },
  "desert-dusk": {
    id: "desert-dusk",
    name: "Desert Dusk",
    slideBackground: "linear-gradient(135deg, #fef3c7 0%, #ffffff 100%)",
    titleFontSize: "clamp(32px, 3.5vw, 48px)",
    titleFontWeight: 600,
    titleColor: "#d97706", // Warm orange
    titleLineHeight: 1.2,
    bulletFontSize: "clamp(16px, 1.8vw, 20px)",
    bulletFontWeight: 400,
    bulletColor: "#78350f",
    bulletLineHeight: 1.6,
    buttonPrimaryBg: "#d97706",
    buttonPrimaryColor: "#ffffff",
    buttonPrimaryHover: "#b45309",
    buttonSecondaryBg: "#ffffff",
    buttonSecondaryColor: "#d97706",
    buttonSecondaryBorder: "#d97706",
    toolbarBg: "#ffffff",
    toolbarBorder: "#fde68a",
    canvasBg: "#ffffff",
    canvasBorder: "1px solid #fbbf24",
    canvasShadow: "0 4px 6px -1px rgba(217, 119, 6, 0.1), 0 2px 4px -1px rgba(217, 119, 6, 0.06)",
    swatch: "linear-gradient(135deg, #d97706 0%, #fde68a 100%)",
  },
  "executive-slate": {
    id: "executive-slate",
    name: "Executive Slate",
    slideBackground: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
    titleFontSize: "clamp(32px, 3.5vw, 48px)",
    titleFontWeight: 700,
    titleColor: "#1e293b", // Dark navy
    titleLineHeight: 1.2,
    bulletFontSize: "clamp(16px, 1.8vw, 20px)",
    bulletFontWeight: 400,
    bulletColor: "#334155",
    bulletLineHeight: 1.6,
    buttonPrimaryBg: "#1e293b",
    buttonPrimaryColor: "#ffffff",
    buttonPrimaryHover: "#0f172a",
    buttonSecondaryBg: "#ffffff",
    buttonSecondaryColor: "#1e293b",
    buttonSecondaryBorder: "#1e293b",
    toolbarBg: "#f8fafc",
    toolbarBorder: "#cbd5e1",
    canvasBg: "#ffffff",
    canvasBorder: "1px solid #94a3b8",
    canvasShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
    swatch: "linear-gradient(135deg, #1e293b 0%, #64748b 100%)",
  },
  "innovation-sky": {
    id: "innovation-sky",
    name: "Innovation Sky",
    slideBackground: "linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)",
    titleFontSize: "clamp(32px, 3.5vw, 48px)",
    titleFontWeight: 600,
    titleColor: "#0284c7", // Sky blue
    titleLineHeight: 1.2,
    bulletFontSize: "clamp(16px, 1.8vw, 20px)",
    bulletFontWeight: 400,
    bulletColor: "#1e40af",
    bulletLineHeight: 1.6,
    buttonPrimaryBg: "#0284c7",
    buttonPrimaryColor: "#ffffff",
    buttonPrimaryHover: "#0369a1",
    buttonSecondaryBg: "#ffffff",
    buttonSecondaryColor: "#0284c7",
    buttonSecondaryBorder: "#0284c7",
    toolbarBg: "#ffffff",
    toolbarBorder: "#bfdbfe",
    canvasBg: "#ffffff",
    canvasBorder: "1px solid #93c5fd",
    canvasShadow: "0 4px 6px -1px rgba(2, 132, 199, 0.1), 0 2px 4px -1px rgba(2, 132, 199, 0.06)",
    swatch: "linear-gradient(135deg, #0284c7 0%, #7dd3fc 100%)",
  },
};

export function getThemeById(id: ThemeId | string): PresentationTheme {
  return themes[id as ThemeId] || themes["aramco-classic"];
}

export function getThemeByName(name: string): PresentationTheme | null {
  const found = Object.values(themes).find((t) => t.name === name);
  return found || null;
}

export const defaultThemeId: ThemeId = "aramco-classic";

