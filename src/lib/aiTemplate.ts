/**
 * AI-Generated Presentation Template
 * Modern, professional template with beautiful colors and spacing
 */

export const AITemplateConfig = {
  id: "ai-modern",
  name: "AI Modern",
  colors: {
    primary: "#6366f1", // Indigo
    secondary: "#8b5cf6", // Purple
    accent: "#ec4899", // Pink
    background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
    cardBackground: "#ffffff",
    text: "#1e293b",
    textSecondary: "#64748b",
    border: "#e2e8f0",
    highlight: "#f0f9ff",
  },
  typography: {
    titleFontSize: "clamp(36px, 4vw, 56px)",
    titleFontWeight: 700,
    titleLineHeight: 1.2,
    subtitleFontSize: "clamp(20px, 2.2vw, 28px)",
    subtitleFontWeight: 500,
    subtitleLineHeight: 1.4,
    contentFontSize: "clamp(16px, 1.8vw, 22px)",
    contentFontWeight: 400,
    contentLineHeight: 1.6,
    bulletSpacing: "0.75rem",
  },
  spacing: {
    slidePadding: "clamp(48px, 5vw, 72px)",
    titleMarginBottom: "clamp(16px, 2vw, 24px)",
    subtitleMarginBottom: "clamp(24px, 3vw, 40px)",
    contentGap: "clamp(12px, 1.5vw, 20px)",
    sectionGap: "clamp(32px, 4vw, 48px)",
  },
  effects: {
    borderRadius: "24px",
    shadow: "0 20px 60px rgba(99, 102, 241, 0.15)",
    borderWidth: "1px",
    borderColor: "rgba(99, 102, 241, 0.1)",
  },
  layout: {
    titleAlign: "center" as const,
    contentAlign: "left" as const,
    maxContentWidth: "85%",
  },
};

export type AITemplateSlide = {
  title: string;
  subtitle?: string;
  content: string;
  templateId: string;
};

/**
 * Apply AI template styling to a slide element
 */
export function getAITemplateStyles() {
  return {
    slide: {
      background: AITemplateConfig.colors.background,
      borderRadius: AITemplateConfig.effects.borderRadius,
      boxShadow: AITemplateConfig.effects.shadow,
      border: `${AITemplateConfig.effects.borderWidth} solid ${AITemplateConfig.effects.borderColor}`,
      padding: AITemplateConfig.spacing.slidePadding,
      color: AITemplateConfig.colors.text,
    } as React.CSSProperties,
    title: {
      fontSize: AITemplateConfig.typography.titleFontSize,
      fontWeight: AITemplateConfig.typography.titleFontWeight,
      lineHeight: AITemplateConfig.typography.titleLineHeight,
      color: AITemplateConfig.colors.primary,
      marginBottom: AITemplateConfig.spacing.titleMarginBottom,
      textAlign: AITemplateConfig.layout.titleAlign,
    } as React.CSSProperties,
    subtitle: {
      fontSize: AITemplateConfig.typography.subtitleFontSize,
      fontWeight: AITemplateConfig.typography.subtitleFontWeight,
      lineHeight: AITemplateConfig.typography.subtitleLineHeight,
      color: AITemplateConfig.colors.textSecondary,
      marginBottom: AITemplateConfig.spacing.subtitleMarginBottom,
      textAlign: AITemplateConfig.layout.titleAlign,
    } as React.CSSProperties,
    content: {
      fontSize: AITemplateConfig.typography.contentFontSize,
      fontWeight: AITemplateConfig.typography.contentFontWeight,
      lineHeight: AITemplateConfig.typography.contentLineHeight,
      color: AITemplateConfig.colors.text,
      maxWidth: AITemplateConfig.layout.maxContentWidth,
      margin: "0 auto",
      textAlign: AITemplateConfig.layout.contentAlign,
    } as React.CSSProperties,
    bulletPoint: {
      marginBottom: AITemplateConfig.typography.bulletSpacing,
      paddingLeft: "0.5rem",
    } as React.CSSProperties,
  };
}

