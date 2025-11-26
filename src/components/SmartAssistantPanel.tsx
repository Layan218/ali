"use client";

import { useState, useEffect } from "react";
import {
  analyzeSlide,
  analyzePresentation,
  type SlideContent,
  type PresentationContext,
  type SlideHelpResult,
  type PresentationAnalysisResult,
} from "@/services/smartAssistantService";
import styles from "./SmartAssistantPanel.module.css";

interface SmartAssistantPanelProps {
  presentationContext: PresentationContext;
  currentSlide?: SlideContent | null;
  allSlides?: SlideContent[];
  onApplyToSlide?: (data: { content?: string; notes?: string }) => void;
  onClose?: () => void;
}

// Helper function to strip HTML tags and return plain text
function stripHtml(html: string): string {
  if (!html) return "";
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, "");
  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
  // Clean up multiple spaces (but preserve newlines)
  text = text.replace(/[ \t]+/g, " ").replace(/\n\s*\n/g, "\n").trim();
  return text;
}

// Helper function to format bullets as plain text
function formatBulletsAsPlainText(bullets: string[]): string {
  if (!bullets || bullets.length === 0) return "";
  return bullets
    .map((bullet) => {
      // Strip any HTML from the bullet
      const cleanBullet = stripHtml(bullet);
      // Add bullet prefix
      return `• ${cleanBullet}`;
    })
    .join("\n");
}

// Helper function to format paragraph as plain text
function formatParagraphAsPlainText(paragraph: string | undefined): string {
  if (!paragraph) return "";
  // Strip HTML and return clean text
  return stripHtml(paragraph);
}

export default function SmartAssistantPanel({
  presentationContext,
  currentSlide,
  allSlides = [],
  onApplyToSlide,
  onClose,
}: SmartAssistantPanelProps) {
  const [activeTab, setActiveTab] = useState<"slide" | "presentation">("slide");

  const [slideAnalysis, setSlideAnalysis] = useState<SlideHelpResult | null>(null);
  const [presentationAnalysis, setPresentationAnalysis] = useState<PresentationAnalysisResult | null>(null);
  const [isAnalyzingSlide, setIsAnalyzingSlide] = useState(false);
  const [isAnalyzingPresentation, setIsAnalyzingPresentation] = useState(false);

  // Analyze current slide with OpenAI
  useEffect(() => {
    if (!currentSlide) {
      setSlideAnalysis(null);
      return;
    }

    setIsAnalyzingSlide(true);
    analyzeSlide(currentSlide, presentationContext)
      .then((result) => {
        setSlideAnalysis(result);
        setIsAnalyzingSlide(false);
      })
      .catch((error) => {
        console.error("Error analyzing slide:", error);
        setSlideAnalysis(null);
        setIsAnalyzingSlide(false);
      });
  }, [currentSlide, presentationContext]);

  // Analyze full presentation with OpenAI
  useEffect(() => {
    if (!allSlides || allSlides.length === 0) {
      setPresentationAnalysis(null);
      return;
    }

    setIsAnalyzingPresentation(true);
    analyzePresentation(allSlides, presentationContext)
      .then((result) => {
        setPresentationAnalysis(result);
        setIsAnalyzingPresentation(false);
      })
      .catch((error) => {
        console.error("Error analyzing presentation:", error);
        setPresentationAnalysis(null);
        setIsAnalyzingPresentation(false);
      });
  }, [allSlides, presentationContext]);

  // Detect language from presentationContext or currentSlide
  const language = currentSlide?.language || presentationContext.language || "en";
  const isArabic = language === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const textAlign = isArabic ? "text-right" : "text-left";

  return (
    <div className={styles.aiAssistantPopup}>
      {onClose && (
        <button className={styles.aiAssistantClose} onClick={onClose}>
          ×
        </button>
      )}
      <div 
        className={`w-full flex flex-col bg-transparent overflow-hidden ${textAlign}`}
        dir={dir}
      >
      {/* Header */}
      <div className="flex flex-col gap-3 pb-4 flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
        <h3 className={styles.aiAssistantHeader}>
          {isArabic ? "المساعد الذكي بالذكاء الاصطناعي" : "AI Smart Assistant"}
        </h3>
        
        {/* Tabs */}
        <div className={`flex items-center gap-2 ${isArabic ? "flex-row-reverse" : ""}`}>
          <button
            onClick={() => setActiveTab("slide")}
            disabled={!currentSlide}
            className={`flex-1 py-1.5 text-sm rounded-full border transition-colors ${
              activeTab === "slide"
                ? "bg-emerald-500 text-white border-emerald-500"
                : currentSlide
                ? "bg-transparent text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                : "bg-transparent text-gray-400 dark:text-gray-500 border-gray-300 dark:border-gray-600 opacity-50 cursor-not-allowed"
            }`}
          >
            {isArabic ? "مساعدة الشريحة" : "Slide Help"}
          </button>
          <button
            onClick={() => setActiveTab("presentation")}
            disabled={!allSlides || allSlides.length === 0}
            className={`flex-1 py-1.5 text-sm rounded-full border transition-colors ${
              activeTab === "presentation"
                ? "bg-emerald-500 text-white border-emerald-500"
                : allSlides && allSlides.length > 0
                ? "bg-transparent text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                : "bg-transparent text-gray-400 dark:text-gray-500 border-gray-300 dark:border-gray-600 opacity-50 cursor-not-allowed"
            }`}
          >
            {isArabic ? "مساعدة العرض" : "Presentation Help"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 pt-4">
        {activeTab === "slide" ? (
          <SlideHelpView
            slideAnalysis={slideAnalysis}
            currentSlide={currentSlide}
            isArabic={isArabic}
            isAnalyzing={isAnalyzingSlide}
            onApplyToSlide={onApplyToSlide}
          />
        ) : (
          <PresentationHelpView
            presentationAnalysis={presentationAnalysis}
            isArabic={isArabic}
            isAnalyzing={isAnalyzingPresentation}
          />
        )}
      </div>
      </div>
    </div>
  );
}

// Slide Help View Component
function SlideHelpView({
  slideAnalysis,
  currentSlide,
  isArabic,
  isAnalyzing,
  onApplyToSlide,
}: {
  slideAnalysis: SlideHelpResult | null;
  currentSlide?: SlideContent | null;
  isArabic: boolean;
  isAnalyzing: boolean;
  onApplyToSlide?: (data: { content?: string; notes?: string }) => void;
}) {
  if (!currentSlide) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p className="text-sm">
          {isArabic
            ? "اختر شريحة للحصول على مساعدة الذكاء الاصطناعي"
            : "Select a slide to get AI help"}
        </p>
      </div>
    );
  }

  if (!slideAnalysis) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p className="text-sm">
          {isArabic
            ? "حدث خطأ في تحليل الشريحة"
            : "Error analyzing slide"}
        </p>
      </div>
    );
  }

  const textAlign = isArabic ? "text-right" : "text-left";
  const flexDirection = isArabic ? "flex-row-reverse" : "";

  const handleApplyBullets = () => {
    if (!onApplyToSlide || !slideAnalysis.improvedBullets.length) return;
    const plainTextBullets = formatBulletsAsPlainText(slideAnalysis.improvedBullets);
    onApplyToSlide({ content: plainTextBullets });
  };

  const handleApplyParagraph = () => {
    if (!onApplyToSlide || !slideAnalysis.rewrittenParagraph) return;
    const plainTextParagraph = formatParagraphAsPlainText(slideAnalysis.rewrittenParagraph);
    onApplyToSlide({ content: plainTextParagraph });
  };

  const handleApplyNotes = () => {
    if (!onApplyToSlide || !slideAnalysis.speakerNotes) return;
    const plainTextNotes = formatParagraphAsPlainText(slideAnalysis.speakerNotes);
    onApplyToSlide({ notes: plainTextNotes });
  };

  return (
    <div className={`space-y-5 ${textAlign}`}>
      {/* Improved Bullets */}
      {slideAnalysis.improvedBullets.length > 0 && (
        <div className={styles.aiAssistantSection}>
          <h4 className={styles.aiAssistantSectionTitle}>
            {isArabic ? "نقاط محسّنة" : "Improved Bullets"}
          </h4>
          <ul className={`${styles.aiAssistantText} list-none space-y-2 ${isArabic ? "pr-0" : "pl-0"}`}>
            {slideAnalysis.improvedBullets.map((bullet, index) => (
              <li key={index} className="flex items-start gap-2.5">
                <span className="text-emerald-500 mt-0.5 flex-shrink-0">•</span>
                <span>{stripHtml(bullet)}</span>
              </li>
            ))}
          </ul>
          {onApplyToSlide && (
            <div className={styles.aiAssistantActions}>
              <button
                onClick={handleApplyBullets}
                className={styles.aiAssistantButton}
              >
                {isArabic ? "تطبيق" : "Apply to Slide"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Rewritten Paragraph */}
      {slideAnalysis.rewrittenParagraph && (
        <div className={styles.aiAssistantSection}>
          <h4 className={styles.aiAssistantSectionTitle}>
            {isArabic ? "فقرة محسّنة" : "Rewritten Paragraph"}
          </h4>
          <p className={`${styles.aiAssistantText} whitespace-pre-line`}>
            {stripHtml(slideAnalysis.rewrittenParagraph)}
          </p>
          {onApplyToSlide && (
            <div className={styles.aiAssistantActions}>
              <button
                onClick={handleApplyParagraph}
                className={styles.aiAssistantButton}
              >
                {isArabic ? "تطبيق" : "Apply to Slide"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Speaker Notes */}
      {slideAnalysis.speakerNotes && (
        <div className={styles.aiAssistantSection}>
          <h4 className={styles.aiAssistantSectionTitle}>
            {isArabic ? "ملاحظات المتحدث" : "Speaker Notes"}
          </h4>
          <p className={`${styles.aiAssistantText} whitespace-pre-line`}>
            {stripHtml(slideAnalysis.speakerNotes)}
          </p>
          {onApplyToSlide && (
            <div className={styles.aiAssistantActions}>
              <button
                onClick={handleApplyNotes}
                className={styles.aiAssistantButton}
              >
                {isArabic ? "تطبيق كملاحظات" : "Apply as Notes"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Suggestions */}
      {slideAnalysis.suggestions.length > 0 && (
        <div className={styles.aiAssistantSection}>
          <h4 className={styles.aiAssistantSectionTitle}>
            {isArabic ? "اقتراحات" : "Suggestions"}
          </h4>
          <ul className={`${styles.aiAssistantText} space-y-2 ${isArabic ? "pr-0" : "pl-0"}`}>
            {slideAnalysis.suggestions.map((suggestion, index) => (
              <li
                key={index}
                className={`flex items-start gap-2.5 ${flexDirection}`}
              >
                <span className="text-emerald-500 mt-0.5 flex-shrink-0">•</span>
                <span>{stripHtml(suggestion)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Presentation Help View Component
function PresentationHelpView({
  presentationAnalysis,
  isArabic,
  isAnalyzing,
}: {
  presentationAnalysis: PresentationAnalysisResult | null;
  isArabic: boolean;
  isAnalyzing: boolean;
}) {
  if (isAnalyzing) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p className="text-sm">
          {isArabic
            ? "جاري تحليل العرض..."
            : "Analyzing presentation..."}
        </p>
      </div>
    );
  }

  if (!presentationAnalysis) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p className="text-sm">
          {isArabic
            ? "حدث خطأ في تحليل العرض"
            : "Error analyzing presentation"}
        </p>
      </div>
    );
  }

  const textAlign = isArabic ? "text-right" : "text-left";
  const flexDirection = isArabic ? "flex-row-reverse" : "";

  const getQualityColor = (score: number) => {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className={`space-y-5 ${textAlign}`}>
      {/* Quality Score */}
      <div>
        <div className={`flex items-center justify-between mb-3 ${flexDirection}`}>
          <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100">
            {isArabic ? "درجة الجودة" : "Quality Score"}
          </h4>
          <span className={`text-base font-bold ${
            presentationAnalysis.estimatedQualityScore >= 80
              ? "text-emerald-500"
              : presentationAnalysis.estimatedQualityScore >= 60
              ? "text-yellow-500"
              : "text-red-500"
          }`}>
            {presentationAnalysis.estimatedQualityScore}/100
          </span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all ${getQualityColor(presentationAnalysis.estimatedQualityScore)}`}
            style={{ width: `${presentationAnalysis.estimatedQualityScore}%` }}
          />
        </div>
      </div>

      {/* Summary */}
      {presentationAnalysis.summary && (
        <div className={styles.aiAssistantSection}>
          <h4 className={styles.aiAssistantSectionTitle}>
            {isArabic ? "ملخص" : "Summary"}
          </h4>
          <p className={`${styles.aiAssistantText} whitespace-pre-line`}>
            {stripHtml(presentationAnalysis.summary)}
          </p>
        </div>
      )}

      {/* Key Points */}
      {presentationAnalysis.keyPoints.length > 0 && (
        <div className={styles.aiAssistantSection}>
          <h4 className={styles.aiAssistantSectionTitle}>
            {isArabic ? "النقاط الرئيسية" : "Key Points"}
          </h4>
          <ul className={`${styles.aiAssistantText} list-none space-y-2 ${isArabic ? "pr-0" : "pl-0"}`}>
            {presentationAnalysis.keyPoints.map((point, index) => (
              <li key={index} className="flex items-start gap-2.5">
                <span className="text-emerald-500 mt-0.5 flex-shrink-0">•</span>
                <span>{stripHtml(point)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Strengths and Weaknesses */}
      <div className="space-y-5">
        {/* Strengths */}
        {presentationAnalysis.strengths.length > 0 && (
          <div className={styles.aiAssistantSection}>
            <h4 className={styles.aiAssistantSectionTitle}>
              {isArabic ? "نقاط القوة" : "Strengths"}
            </h4>
            <ul className={`${styles.aiAssistantText} space-y-2 ${isArabic ? "pr-0" : "pl-0"}`}>
              {presentationAnalysis.strengths.map((strength, index) => (
                <li
                  key={index}
                  className={`flex items-start gap-2.5 ${flexDirection}`}
                >
                  <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>
                  <span>{stripHtml(strength)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Weaknesses */}
        {presentationAnalysis.weaknesses.length > 0 && (
          <div className={styles.aiAssistantSection}>
            <h4 className={styles.aiAssistantSectionTitle}>
              {isArabic ? "نقاط الضعف" : "Weaknesses"}
            </h4>
            <ul className={`${styles.aiAssistantText} space-y-2 ${isArabic ? "pr-0" : "pl-0"}`}>
              {presentationAnalysis.weaknesses.map((weakness, index) => (
                <li
                  key={index}
                  className={`flex items-start gap-2.5 ${flexDirection}`}
                >
                  <span className="text-red-500 mt-0.5 flex-shrink-0">!</span>
                  <span>{stripHtml(weakness)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Recommendations */}
      {presentationAnalysis.recommendations.length > 0 && (
        <div className={styles.aiAssistantSection}>
          <h4 className={styles.aiAssistantSectionTitle}>
            {isArabic ? "التوصيات" : "Recommendations"}
          </h4>
          <ul className={`${styles.aiAssistantText} space-y-2 ${isArabic ? "pr-0" : "pl-0"}`}>
            {presentationAnalysis.recommendations.map((recommendation, index) => (
              <li
                key={index}
                className={`flex items-start gap-2.5 ${flexDirection}`}
              >
                <span className="text-emerald-500 mt-0.5 flex-shrink-0">→</span>
                <span>{stripHtml(recommendation)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
