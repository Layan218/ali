"use client";

import { useState, useMemo } from "react";
import {
  analyzeSlide,
  analyzePresentation,
  type SlideContent,
  type PresentationContext,
  type SlideHelpResult,
  type PresentationAnalysisResult,
} from "@/services/smartAssistantService";

interface SmartAssistantPanelProps {
  presentationContext: PresentationContext;
  currentSlide?: SlideContent | null;
  allSlides?: SlideContent[];
  onApplyToSlide?: (data: { content?: string; notes?: string }) => void;
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
}: SmartAssistantPanelProps) {
  const [activeTab, setActiveTab] = useState<"slide" | "presentation">("slide");

  // Analyze current slide
  const slideAnalysis = useMemo<SlideHelpResult | null>(() => {
    if (!currentSlide) return null;
    try {
      return analyzeSlide(currentSlide, presentationContext);
    } catch (error) {
      console.error("Error analyzing slide:", error);
      return null;
    }
  }, [currentSlide, presentationContext]);

  // Analyze full presentation
  const presentationAnalysis = useMemo<PresentationAnalysisResult | null>(() => {
    if (!allSlides || allSlides.length === 0) return null;
    try {
      return analyzePresentation(allSlides, presentationContext);
    } catch (error) {
      console.error("Error analyzing presentation:", error);
      return null;
    }
  }, [allSlides, presentationContext]);

  // Detect language from presentationContext or currentSlide
  const language = currentSlide?.language || presentationContext.language || "en";
  const isArabic = language === "ar";
  const dir = isArabic ? "rtl" : "ltr";
  const textAlign = isArabic ? "text-right" : "text-left";

  return (
    <div 
      className={`h-full w-full flex flex-col gap-3 bg-white dark:bg-[#020817] rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm p-4 overflow-hidden ${textAlign}`}
      dir={dir}
    >
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-[#f4f9fb]">
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
      <div className="flex-1 overflow-y-auto -mx-1 px-1">
        {activeTab === "slide" ? (
          <SlideHelpView
            slideAnalysis={slideAnalysis}
            currentSlide={currentSlide}
            isArabic={isArabic}
            onApplyToSlide={onApplyToSlide}
          />
        ) : (
          <PresentationHelpView
            presentationAnalysis={presentationAnalysis}
            isArabic={isArabic}
          />
        )}
      </div>
    </div>
  );
}

// Slide Help View Component
function SlideHelpView({
  slideAnalysis,
  currentSlide,
  isArabic,
  onApplyToSlide,
}: {
  slideAnalysis: SlideHelpResult | null;
  currentSlide?: SlideContent | null;
  isArabic: boolean;
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
    <div className={`space-y-3 ${textAlign}`}>
      {/* Improved Bullets */}
      {slideAnalysis.improvedBullets.length > 0 && (
        <div className="bg-gray-50/60 dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 space-y-1">
          <div className={`flex items-center justify-between gap-2 ${flexDirection}`}>
            <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
              {isArabic ? "نقاط محسّنة" : "Improved Bullets"}
            </h4>
            {onApplyToSlide && (
              <button
                onClick={handleApplyBullets}
                className="text-xs px-2 py-0.5 rounded-full border border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition whitespace-nowrap"
              >
                {isArabic ? "تطبيق" : "Apply to Slide"}
              </button>
            )}
          </div>
          <ul className={`list-disc space-y-1 text-sm leading-relaxed text-gray-700 dark:text-gray-300 ${isArabic ? "mr-4" : "ml-4"}`}>
            {slideAnalysis.improvedBullets.map((bullet, index) => (
              <li key={index}>
                {stripHtml(bullet)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Rewritten Paragraph */}
      {slideAnalysis.rewrittenParagraph && (
        <div className="bg-gray-50/60 dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 space-y-1">
          <div className={`flex items-center justify-between gap-2 ${flexDirection}`}>
            <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
              {isArabic ? "فقرة محسّنة" : "Rewritten Paragraph"}
            </h4>
            {onApplyToSlide && (
              <button
                onClick={handleApplyParagraph}
                className="text-xs px-2 py-0.5 rounded-full border border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition whitespace-nowrap"
              >
                {isArabic ? "تطبيق" : "Apply to Slide"}
              </button>
            )}
          </div>
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-line">
            {stripHtml(slideAnalysis.rewrittenParagraph)}
          </p>
        </div>
      )}

      {/* Speaker Notes */}
      {slideAnalysis.speakerNotes && (
        <div className="bg-gray-50/60 dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 space-y-1">
          <div className={`flex items-center justify-between gap-2 ${flexDirection}`}>
            <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
              {isArabic ? "ملاحظات المتحدث" : "Speaker Notes"}
            </h4>
            {onApplyToSlide && (
              <button
                onClick={handleApplyNotes}
                className="text-xs px-2 py-0.5 rounded-full border border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition whitespace-nowrap"
              >
                {isArabic ? "تطبيق كملاحظات" : "Apply as Notes"}
              </button>
            )}
          </div>
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-line">
            {stripHtml(slideAnalysis.speakerNotes)}
          </p>
        </div>
      )}

      {/* Suggestions */}
      {slideAnalysis.suggestions.length > 0 && (
        <div className="bg-gray-50/60 dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 space-y-1">
          <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
            {isArabic ? "اقتراحات" : "Suggestions"}
          </h4>
          <ul className={`space-y-1.5 ${isArabic ? "mr-4" : "ml-4"}`}>
            {slideAnalysis.suggestions.map((suggestion, index) => (
              <li
                key={index}
                className={`text-sm leading-relaxed text-gray-700 dark:text-gray-300 flex items-start gap-2 ${flexDirection}`}
              >
                <span className="text-emerald-500 mt-0.5">•</span>
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
}: {
  presentationAnalysis: PresentationAnalysisResult | null;
  isArabic: boolean;
}) {
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
    <div className={`space-y-3 ${textAlign}`}>
      {/* Quality Score */}
      <div className="bg-gray-50/60 dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 space-y-1">
        <div className={`flex items-center justify-between ${flexDirection}`}>
          <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
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
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${getQualityColor(presentationAnalysis.estimatedQualityScore)}`}
            style={{ width: `${presentationAnalysis.estimatedQualityScore}%` }}
          />
        </div>
      </div>

      {/* Summary */}
      {presentationAnalysis.summary && (
        <div className="bg-gray-50/60 dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 space-y-1">
          <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
            {isArabic ? "ملخص" : "Summary"}
          </h4>
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-line">
            {stripHtml(presentationAnalysis.summary)}
          </p>
        </div>
      )}

      {/* Key Points */}
      {presentationAnalysis.keyPoints.length > 0 && (
        <div className="bg-gray-50/60 dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 space-y-1">
          <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
            {isArabic ? "النقاط الرئيسية" : "Key Points"}
          </h4>
          <ul className={`list-disc space-y-1 text-sm leading-relaxed text-gray-700 dark:text-gray-300 ${isArabic ? "mr-4" : "ml-4"}`}>
            {presentationAnalysis.keyPoints.map((point, index) => (
              <li key={index}>
                {stripHtml(point)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Strengths and Weaknesses */}
      <div className="grid grid-cols-1 gap-3">
        {/* Strengths */}
        {presentationAnalysis.strengths.length > 0 && (
          <div className="bg-gray-50/60 dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 space-y-1">
            <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {isArabic ? "نقاط القوة" : "Strengths"}
            </h4>
            <ul className={`space-y-1.5 ${isArabic ? "mr-4" : "ml-4"}`}>
              {presentationAnalysis.strengths.map((strength, index) => (
                <li
                  key={index}
                  className={`text-sm leading-relaxed text-gray-700 dark:text-gray-300 flex items-start gap-2 ${flexDirection}`}
                >
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <span>{stripHtml(strength)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Weaknesses */}
        {presentationAnalysis.weaknesses.length > 0 && (
          <div className="bg-gray-50/60 dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 space-y-1">
            <h4 className="text-xs font-semibold text-red-600 dark:text-red-400">
              {isArabic ? "نقاط الضعف" : "Weaknesses"}
            </h4>
            <ul className={`space-y-1.5 ${isArabic ? "mr-4" : "ml-4"}`}>
              {presentationAnalysis.weaknesses.map((weakness, index) => (
                <li
                  key={index}
                  className={`text-sm leading-relaxed text-gray-700 dark:text-gray-300 flex items-start gap-2 ${flexDirection}`}
                >
                  <span className="text-red-500 mt-0.5">!</span>
                  <span>{stripHtml(weakness)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Recommendations */}
      {presentationAnalysis.recommendations.length > 0 && (
        <div className="bg-gray-50/60 dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 space-y-1">
          <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
            {isArabic ? "التوصيات" : "Recommendations"}
          </h4>
          <ul className={`space-y-1.5 ${isArabic ? "mr-4" : "ml-4"}`}>
            {presentationAnalysis.recommendations.map((recommendation, index) => (
              <li
                key={index}
                className={`text-sm leading-relaxed text-gray-700 dark:text-gray-300 flex items-start gap-2 ${flexDirection}`}
              >
                <span className="text-emerald-500 mt-0.5">→</span>
                <span>{stripHtml(recommendation)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
