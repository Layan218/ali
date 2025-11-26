/**
 * Smart Assistant Service
 * 
 * Provides AI-powered analysis and suggestions for presentations and slides.
 * Uses OpenAI API for intelligent analysis and suggestions.
 * 
 * Features:
 * - Slide-level analysis and improvement suggestions
 * - Presentation-level analysis and quality scoring
 * - Support for English and Arabic content
 * - OpenAI-powered intelligent suggestions
 */

export interface SlideContent {
  id: string;
  title: string;
  content: string;
  notes?: string;
  language?: "en" | "ar";
}

export interface PresentationContext {
  id: string;
  title: string;
  totalSlides: number;
  language?: "en" | "ar";
  audience?: string;
  goal?: string; // e.g. "Inform", "Persuade", "Train"
}

export interface SlideHelpResult {
  improvedBullets: string[];      // better bullet points for this slide
  rewrittenParagraph?: string;    // a more polished paragraph version
  speakerNotes?: string;          // suggested speaker notes
  suggestions: string[];          // "human-readable" tips like: "Add an example", etc.
}

export interface PresentationAnalysisResult {
  summary: string;                // executive summary of the whole presentation
  keyPoints: string[];            // top 5–8 key points
  strengths: string[];            // what is good in this deck
  weaknesses: string[];           // what is missing/weak
  recommendations: string[];      // concrete improvement suggestions
  estimatedQualityScore: number;  // 0–100
}

/**
 * Analyzes a single slide and provides improvement suggestions using OpenAI
 */
export async function analyzeSlide(
  slide: SlideContent,
  context?: PresentationContext
): Promise<SlideHelpResult> {
  const language = slide.language || context?.language || "en";

  try {
    // Call OpenAI API for slide analysis
    const response = await fetch("/api/openai/assistant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "slide",
        slide: {
          id: slide.id,
          title: slide.title,
          content: slide.content || "",
          notes: slide.notes || "",
          language: language,
        },
        context: context ? {
          id: context.id,
          title: context.title,
          totalSlides: context.totalSlides,
          language: context.language,
          audience: context.audience,
          goal: context.goal,
        } : undefined,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Ensure all required fields are present
    return {
      improvedBullets: Array.isArray(data.improvedBullets) ? data.improvedBullets : [],
      rewrittenParagraph: data.rewrittenParagraph || "",
      speakerNotes: data.speakerNotes || "",
      suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
    };
  } catch (error) {
    console.error("Error calling OpenAI Assistant API:", error);
    // Fallback to basic response if API fails
    return {
      improvedBullets: [],
      rewrittenParagraph: "",
      speakerNotes: "",
      suggestions: [
        language === "ar"
          ? "حدث خطأ في تحليل الشريحة. يرجى المحاولة مرة أخرى."
          : "Error analyzing slide. Please try again.",
      ],
    };
  }
}

/**
 * Analyzes a full presentation and provides comprehensive feedback using OpenAI
 */
export async function analyzePresentation(
  slides: SlideContent[],
  context: PresentationContext
): Promise<PresentationAnalysisResult> {
  const language = context.language || "en";

  try {
    // Call OpenAI API for presentation analysis
    const response = await fetch("/api/openai/assistant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "presentation",
        slides: slides.map(s => ({
          id: s.id,
          title: s.title,
          content: s.content || "",
          notes: s.notes || "",
          language: s.language || language,
        })),
        context: {
          id: context.id,
          title: context.title,
          totalSlides: context.totalSlides,
          language: context.language,
          audience: context.audience,
          goal: context.goal,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Ensure all required fields are present
    return {
      summary: data.summary || "",
      keyPoints: Array.isArray(data.keyPoints) ? data.keyPoints : [],
      strengths: Array.isArray(data.strengths) ? data.strengths : [],
      weaknesses: Array.isArray(data.weaknesses) ? data.weaknesses : [],
      recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
      estimatedQualityScore: typeof data.estimatedQualityScore === "number" 
        ? Math.min(100, Math.max(0, data.estimatedQualityScore))
        : 50,
    };
  } catch (error) {
    console.error("Error calling OpenAI Assistant API:", error);
    // Fallback to basic response if API fails
    return {
      summary: language === "ar" 
        ? "حدث خطأ في تحليل العرض. يرجى المحاولة مرة أخرى."
        : "Error analyzing presentation. Please try again.",
      keyPoints: [],
      strengths: [],
      weaknesses: [],
      recommendations: [
        language === "ar"
          ? "حدث خطأ في التحليل. يرجى المحاولة مرة أخرى."
          : "Error during analysis. Please try again.",
      ],
      estimatedQualityScore: 50,
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function extractBullets(content: string, language: "en" | "ar"): string[] {
  if (!content) return [];
  
  // Split by bullet markers
  const bulletMarkers = language === "ar" 
    ? /[•\-\*]\s*|^\d+[\.\)]\s*/gm
    : /[•\-\*]\s*|^\d+[\.\)]\s*/gm;
  
  const lines = content.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
  const bullets: string[] = [];
  
  for (const line of lines) {
    const cleaned = line.replace(bulletMarkers, "").trim();
    if (cleaned.length > 5) {
      bullets.push(cleaned);
    }
  }
  
  return bullets.length > 0 ? bullets : [content];
}

function countWords(text: string): number {
  if (!text) return 0;
  // Count words (handles both English and Arabic)
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  return words.length;
}

function detectExamples(content: string, language: "en" | "ar"): boolean {
  const lower = content.toLowerCase();
  const examples = language === "ar"
    ? ["مثال", "مثلاً", "على سبيل المثال", "مثل", "حالة استخدام", "تطبيق"]
    : ["example", "for instance", "such as", "case", "use case", "instance", "illustration"];
  return examples.some(e => lower.includes(e));
}

function detectProblemWords(content: string, language: "en" | "ar"): boolean {
  const lower = content.toLowerCase();
  const problems = language === "ar"
    ? ["مشكلة", "تحدي", "صعوبة", "عقبة", "خطر", "مخاطرة", "قضية", "إشكالية"]
    : ["problem", "challenge", "issue", "risk", "difficulty", "obstacle", "barrier", "concern"];
  return problems.some(p => lower.includes(p));
}

function detectSolutionWords(content: string, language: "en" | "ar"): boolean {
  const lower = content.toLowerCase();
  const solutions = language === "ar"
    ? ["حل", "حلول", "استراتيجية", "نهج", "طريقة", "مقترح", "توصية"]
    : ["solution", "solve", "strategy", "approach", "method", "proposal", "recommendation", "mitigation"];
  return solutions.some(s => lower.includes(s));
}

function detectBenefits(content: string, language: "en" | "ar"): boolean {
  const lower = content.toLowerCase();
  const benefits = language === "ar"
    ? ["فائدة", "فوائد", "ميزة", "مزايا", "نتيجة", "نتائج", "تحسين", "زيادة", "تقليل"]
    : ["benefit", "advantage", "improve", "increase", "reduce", "enhance", "gain", "value", "outcome"];
  return benefits.some(b => lower.includes(b));
}

function detectDefinition(content: string, language: "en" | "ar"): boolean {
  const lower = content.toLowerCase();
  const definitionMarkers = language === "ar"
    ? ["هو", "تعريف", "يعني", "يشير إلى", "يقصد به"]
    : ["is", "defined as", "means", "refers to", "denotes"];
  return definitionMarkers.some(m => lower.includes(m)) && countWords(content) < 30;
}

function improveBullets(
  bullets: string[],
  title: string,
  language: "en" | "ar",
  needs: {
    needsExamples: boolean;
    needsSolutions: boolean;
    needsBenefits: boolean;
    needsDetail: boolean;
  }
): string[] {
  const improved: string[] = [];
  
  // Keep existing bullets
  improved.push(...bullets);
  
  // Add missing elements
  if (needs.needsExamples && improved.length < 5) {
    improved.push(language === "ar"
      ? `مثال عملي على تطبيق ${title} في الواقع`
      : `Practical example of applying ${title} in real-world scenarios`);
  }
  
  if (needs.needsSolutions && improved.length < 5) {
    improved.push(language === "ar"
      ? `استراتيجيات وحلول فعالة لمعالجة التحديات المذكورة`
      : `Effective strategies and solutions to address the mentioned challenges`);
  }
  
  if (needs.needsBenefits && improved.length < 5) {
    improved.push(language === "ar"
      ? `الفوائد والنتائج الإيجابية المتوقعة من تطبيق هذه المفاهيم`
      : `Expected benefits and positive outcomes from applying these concepts`);
  }
  
  if (needs.needsDetail && improved.length < 5) {
    improved.push(language === "ar"
      ? `تفاصيل إضافية وأمثلة توضيحية لتعزيز الفهم`
      : `Additional details and illustrative examples to enhance understanding`);
  }
  
  return improved.slice(0, 5); // Max 5 bullets
}

function generateBulletsFromContent(content: string, title: string, language: "en" | "ar"): string[] {
  if (!content || content.trim().length < 10) {
    return [
      language === "ar"
        ? `نقطة رئيسية حول ${title}`
        : `Key point about ${title}`
    ];
  }
  
  // Split content into sentences and create bullets
  const sentences = content.split(/[.!?]\s+/).filter(s => s.trim().length > 10);
  return sentences.slice(0, 4).map(s => s.trim());
}

function generateParagraph(bullets: string[], title: string, language: "en" | "ar"): string {
  if (bullets.length === 0) return "";
  
  if (language === "ar") {
    return `${title} يشمل عدة جوانب مهمة. ${bullets.slice(0, 3).join(" ")}. هذه العناصر تعمل معاً لتحقيق الأهداف المرجوة.`;
  } else {
    return `${title} encompasses several important aspects. ${bullets.slice(0, 3).join(" ")}. These elements work together to achieve the desired goals.`;
  }
}

function generateSpeakerNotes(
  title: string,
  content: string,
  bullets: string[],
  language: "en" | "ar",
  context?: PresentationContext
): string {
  const audience = context?.audience || (language === "ar" ? "الحضور" : "the audience");
  
  if (language === "ar") {
    return `ناقش ${title} بالتفصيل مع ${audience}. ركز على النقاط الرئيسية: ${bullets.slice(0, 2).join(" و")}. شجع على الأسئلة والمناقشة.`;
  } else {
    return `Discuss ${title} in detail with ${audience}. Focus on key points: ${bullets.slice(0, 2).join(" and ")}. Encourage questions and discussion.`;
  }
}

function generatePresentationSummary(
  titles: string[],
  bullets: string[],
  context: PresentationContext,
  language: "en" | "ar"
): string {
  const topic = context.title;
  const slideCount = context.totalSlides;
  
  if (language === "ar") {
    return `هذا العرض التقديمي حول "${topic}" يتكون من ${slideCount} شريحة. يغطي الموضوع من خلال ${titles.slice(1, 4).join(" و")} وغيرها من المواضيع المهمة. العرض يهدف إلى ${context.goal || "إعلام"} ${context.audience || "الجمهور"}.`;
  } else {
    return `This presentation on "${topic}" consists of ${slideCount} slides. It covers the topic through ${titles.slice(1, 4).join(", ")} and other important topics. The presentation aims to ${context.goal || "inform"} ${context.audience || "the audience"}.`;
  }
}

function extractKeyPoints(titles: string[], bullets: string[], language: "en" | "ar"): string[] {
  const keyPoints: string[] = [];
  
  // Use first few titles as key points
  titles.slice(0, 5).forEach(title => {
    if (title && title.length > 3) {
      keyPoints.push(title);
    }
  });
  
  // Add some key bullets if available
  bullets.slice(0, 3).forEach(bullet => {
    if (bullet && bullet.length > 10 && keyPoints.length < 8) {
      keyPoints.push(bullet.substring(0, 80) + (bullet.length > 80 ? "..." : ""));
    }
  });
  
  return keyPoints.slice(0, 8);
}

