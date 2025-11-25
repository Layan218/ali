/**
 * Professional Presentation Themes
 * Three themes for presentations: Default (original), SCDT, and Digital Solutions
 */

export type ThemeId = "scdt" | "digital-solutions" | "supply-chain" | "aramco-classic";
export type SlideType = "cover" | "content" | "ending";

export interface PresentationTheme {
  id: ThemeId;
  name: string;
  slideBackground: string;
  accentColor: string;
  textColor: string;
  // Keep other properties for backward compatibility
  titleFontSize?: string;
  titleFontWeight?: number;
  titleColor?: string;
  titleLineHeight?: number;
  bulletFontSize?: string;
  bulletFontWeight?: number;
  bulletColor?: string;
  bulletLineHeight?: number;
  buttonPrimaryBg?: string;
  buttonPrimaryColor?: string;
  buttonPrimaryHover?: string;
  buttonSecondaryBg?: string;
  buttonSecondaryColor?: string;
  buttonSecondaryBorder?: string;
  toolbarBg?: string;
  toolbarBorder?: string;
  canvasBg?: string;
  canvasBorder?: string;
  canvasShadow?: string;
  swatch?: string;
  bodyFontSize?: string;
  bodyColor?: string;
}

export const presentationThemes: Record<ThemeId, PresentationTheme> = {
  scdt: {
    id: "scdt",
    name: "SCDT",
    slideBackground: "#001b3a",
    accentColor: "#00b388",
    textColor: "#ffffff",
    titleFontSize: "clamp(28px, 3vw, 40px)",
    titleFontWeight: 600,
    titleColor: "#1b3a4b",
    titleLineHeight: 1.2,
    bulletFontSize: "clamp(16px, 1.8vw, 20px)",
    bulletFontWeight: 400,
    bulletColor: "#1b3a4b",
    bulletLineHeight: 1.6,
    buttonPrimaryBg: "#00b388",
    buttonPrimaryColor: "#ffffff",
    buttonPrimaryHover: "#00a078",
    buttonSecondaryBg: "transparent",
    buttonSecondaryColor: "#00b388",
    buttonSecondaryBorder: "#00b388",
  },
  "digital-solutions": {
    id: "digital-solutions",
    name: "Digital Solutions",
    slideBackground: "#000000",
    accentColor: "#33FF99",
    textColor: "#ffffff",
    titleFontSize: "clamp(32px, 3.5vw, 48px)",
    titleFontWeight: 600,
    titleColor: "#333333",
    titleLineHeight: 1.2,
    bulletFontSize: "clamp(16px, 1.8vw, 20px)",
    bulletFontWeight: 400,
    bulletColor: "#333333",
    bulletLineHeight: 1.6,
    buttonPrimaryBg: "#33FF99",
    buttonPrimaryColor: "#000000",
    buttonPrimaryHover: "#28E085",
    buttonSecondaryBg: "transparent",
    buttonSecondaryColor: "#33FF99",
    buttonSecondaryBorder: "#33FF99",
  },
  "supply-chain": {
    id: "supply-chain",
    name: "Supply Chain",
    slideBackground: "#001b3a",
    accentColor: "#22c55e",
    textColor: "#ffffff",
    titleFontSize: "clamp(28px, 3vw, 40px)",
    titleFontWeight: 600,
    titleColor: "#ffffff",
    titleLineHeight: 1.2,
    bulletFontSize: "clamp(16px, 1.8vw, 20px)",
    bulletFontWeight: 400,
    bulletColor: "#ffffff",
    bulletLineHeight: 1.6,
    buttonPrimaryBg: "#22c55e",
    buttonPrimaryColor: "#ffffff",
    buttonPrimaryHover: "#16a34a",
    buttonSecondaryBg: "transparent",
    buttonSecondaryColor: "#22c55e",
    buttonSecondaryBorder: "#22c55e",
    swatch: "linear-gradient(135deg, #0f172a 0%, #22c55e 100%)",
  },
  "aramco-classic": {
    id: "aramco-classic",
    name: "Aramco Classic",
    slideBackground: "#ffffff",
    accentColor: "#65b32e",
    textColor: "#555555",
    titleFontSize: "clamp(28px, 3vw, 40px)",
    bodyFontSize: "16px",
    titleColor: "#555555",
    bodyColor: "#555555",
    swatch: "linear-gradient(90deg, #65b32e 0%, #00a0c6 100%)",
  },
};

export function getThemeById(id: ThemeId | string): PresentationTheme {
  return presentationThemes[id as ThemeId] || presentationThemes["scdt"];
}

export function getThemeByName(name: string): PresentationTheme | null {
  const found = Object.values(presentationThemes).find((t) => t.name === name);
  return found || null;
}

export const defaultThemeId: ThemeId = "scdt";

