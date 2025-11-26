/**
 * Professional Presentation Themes
 * Four themes for presentations: Default, SCDT, Digital Solutions, and Aramco Classic
 */

export type ThemeId = "default" | "scdt" | "digital-solutions" | "aramco-classic";
export type SlideType = "cover" | "content" | "ending";

export interface PresentationTheme {
  id: ThemeId;
  name: string;
  slideBackground: string;
  accentColor: string;
  textColor: string;
  slideLayouts: {
    cover: string;
    content: string;
    ending: string;
  };
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
  default: {
    id: "default",
    name: "Default",
    slideBackground: "linear-gradient(135deg, #e0f2fe 0%, #ecfdf5 100%)", // Aramco Digital soft background
    accentColor: "#56c1b0", // Aramco Digital teal
    textColor: "#0f172a", // Dark text for readability
    slideLayouts: {
      cover: "defaultCoverSlide",
      content: "defaultContentSlide",
      ending: "defaultEndingSlide",
    },
    titleFontSize: "clamp(32px, 3.5vw, 48px)",
    titleFontWeight: 600,
    titleColor: "#0f172a",
    titleLineHeight: 1.2,
    bulletFontSize: "clamp(16px, 1.8vw, 20px)",
    bulletFontWeight: 400,
    bulletColor: "#0f172a",
    bulletLineHeight: 1.6,
    buttonPrimaryBg: "#56c1b0", // Aramco Digital teal
    buttonPrimaryColor: "#ffffff",
    buttonPrimaryHover: "#4fb3a3",
    buttonSecondaryBg: "transparent",
    buttonSecondaryColor: "#56c1b0",
    buttonSecondaryBorder: "#56c1b0",
    swatch: "linear-gradient(135deg, #56c1b0 0%, #0e8170 100%)", // Aramco Digital gradient
    canvasBg: "rgba(255, 255, 255, 0.95)", // Soft white with transparency
    canvasBorder: "1px solid rgba(86, 193, 176, 0.2)", // Soft teal border
    canvasShadow: "0 18px 36px rgba(15, 23, 42, 0.12)", // Soft shadow like Aramco Digital cards
  },
  scdt: {
    id: "scdt",
    name: "SCDT",
    slideBackground: "#001b3a",
    accentColor: "#00b388",
    textColor: "#ffffff",
    slideLayouts: {
      cover: "scdtCoverSlide",
      content: "scdtContentSlide",
      ending: "scdtEndingSlide",
    },
    titleFontSize: "clamp(40px, 4.5vw, 56px)",
    titleFontWeight: 700,
    titleColor: "#ffffff",
    titleLineHeight: 1.2,
    bulletFontSize: "clamp(16px, 1.8vw, 20px)",
    bulletFontWeight: 400,
    bulletColor: "#1b3a4b",
    bulletLineHeight: 1.6,
    bodyFontSize: "clamp(16px, 1.8vw, 20px)",
    bodyColor: "#1b3a4b",
    buttonPrimaryBg: "#00b388",
    buttonPrimaryColor: "#ffffff",
    buttonPrimaryHover: "#00a078",
    buttonSecondaryBg: "transparent",
    buttonSecondaryColor: "#00b388",
    buttonSecondaryBorder: "#00b388",
    canvasBg: "#ffffff",
    canvasBorder: "1px solid rgba(0, 0, 0, 0.1)",
    canvasShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
    swatch: "linear-gradient(135deg, #1b3a4b 0%, #00b388 100%)",
  },
  "digital-solutions": {
    id: "digital-solutions",
    name: "Digital Solutions",
    slideBackground: "#000000",
    accentColor: "#00FF00",
    textColor: "#ffffff",
    slideLayouts: {
      cover: "digitalSolutionsCoverSlide",
      content: "digitalSolutionsContentSlide",
      ending: "digitalSolutionsEndingSlide",
    },
    titleFontSize: "clamp(40px, 5vw, 64px)",
    titleFontWeight: 700,
    titleColor: "#00FF00",
    titleLineHeight: 1.2,
    bulletFontSize: "clamp(16px, 1.8vw, 20px)",
    bulletFontWeight: 400,
    bulletColor: "#555555",
    bulletLineHeight: 1.6,
    bodyFontSize: "clamp(16px, 1.8vw, 20px)",
    bodyColor: "#555555",
    buttonPrimaryBg: "#00FF00",
    buttonPrimaryColor: "#000000",
    buttonPrimaryHover: "#00CC00",
    buttonSecondaryBg: "transparent",
    buttonSecondaryColor: "#00FF00",
    buttonSecondaryBorder: "#00FF00",
    canvasBg: "#ffffff",
    canvasBorder: "1px solid rgba(0, 0, 0, 0.1)",
    canvasShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
    swatch: "linear-gradient(135deg, #000000 0%, #33FF99 100%)",
  },
  "aramco-classic": {
    id: "aramco-classic",
    name: "Aramco Classic",
    slideBackground: "#ffffff",
    accentColor: "#65b32e",
    textColor: "#555555",
    slideLayouts: {
      cover: "aramcoClassicCoverSlide",
      content: "aramcoClassicContentSlide",
      ending: "aramcoClassicLogoSlide",
    },
    titleFontSize: "clamp(32px, 3.5vw, 50px)",
    titleFontWeight: 400,
    titleColor: "#555555",
    titleLineHeight: 1.2,
    bulletFontSize: "clamp(14px, 1.5vw, 16px)",
    bulletFontWeight: 400,
    bulletColor: "#555555",
    bulletLineHeight: 1.6,
    bodyFontSize: "16px",
    bodyColor: "#555555",
    buttonPrimaryBg: "#65b32e",
    buttonPrimaryColor: "#ffffff",
    buttonPrimaryHover: "#5a9e28",
    buttonSecondaryBg: "transparent",
    buttonSecondaryColor: "#65b32e",
    buttonSecondaryBorder: "#65b32e",
    canvasBg: "#ffffff",
    canvasBorder: "1px solid rgba(0, 0, 0, 0.1)",
    canvasShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
    swatch: "linear-gradient(90deg, #65b32e 0%, #00a0c6 100%)",
  },
};

export function getThemeById(id: ThemeId | string): PresentationTheme {
  return presentationThemes[id as ThemeId] || presentationThemes["default"];
}

export function getThemeByName(name: string): PresentationTheme | null {
  const found = Object.values(presentationThemes).find((t) => t.name === name);
  return found || null;
}

export const defaultThemeId: ThemeId = "default";

