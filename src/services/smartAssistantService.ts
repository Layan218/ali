/**
 * Smart Assistant Service
 * 
 * Provides AI-powered analysis and suggestions for presentations and slides.
 * Uses local/mock AI logic - no external API calls required.
 * 
 * Features:
 * - Slide-level analysis and improvement suggestions
 * - Presentation-level analysis and quality scoring
 * - Support for English and Arabic content
 * - Rule-based heuristics for smart suggestions
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
 * Analyzes a single slide and provides improvement suggestions
 */
export function analyzeSlide(
  slide: SlideContent,
  context?: PresentationContext
): SlideHelpResult {
  const language = slide.language || context?.language || "en";
  const content = slide.content || "";
  const title = slide.title || "";
  const notes = slide.notes || "";

  // Extract bullet points from content
  const bullets = extractBullets(content, language);
  const wordCount = countWords(content);
  const hasExamples = detectExamples(content, language);
  const hasProblemWords = detectProblemWords(content, language);
  const hasSolutionWords = detectSolutionWords(content, language);
  const hasBenefits = detectBenefits(content, language);
  const isDefinition = detectDefinition(content, language);

  const suggestions: string[] = [];
  const improvedBullets: string[] = [];

  // Analyze content quality
  if (wordCount < 20) {
    suggestions.push(language === "ar" 
      ? "المحتوى قصير جداً - أضف المزيد من التفاصيل والأمثلة"
      : "Content is too short - add more details and examples");
  }

  if (bullets.length < 3) {
    suggestions.push(language === "ar"
      ? "أضف المزيد من النقاط الرئيسية (3-5 نقاط مثالية)"
      : "Add more bullet points (3-5 points ideal)");
  }

  if (isDefinition && !hasExamples) {
    suggestions.push(language === "ar"
      ? "هذه الشريحة تبدو كتعريف - أضف أمثلة عملية لتوضيح المفهوم"
      : "This slide looks like a definition - add practical examples to illustrate the concept");
  }

  if (hasProblemWords && !hasSolutionWords) {
    suggestions.push(language === "ar"
      ? "تم ذكر المشكلة - أضف حلول أو استراتيجيات للتخفيف"
      : "Problem mentioned - add solutions or mitigation strategies");
  }

  if (!hasBenefits && (hasProblemWords || hasSolutionWords)) {
    suggestions.push(language === "ar"
      ? "أضف الفوائد والنتائج الإيجابية المتوقعة"
      : "Add benefits and expected positive outcomes");
  }

  // Generate improved bullets
  if (bullets.length > 0) {
    improvedBullets.push(...improveBullets(bullets, title, language, {
      needsExamples: !hasExamples && isDefinition,
      needsSolutions: hasProblemWords && !hasSolutionWords,
      needsBenefits: !hasBenefits && (hasProblemWords || hasSolutionWords),
      needsDetail: wordCount < 20,
    }));
  } else {
    // Generate bullets from paragraph content
    improvedBullets.push(...generateBulletsFromContent(content, title, language));
  }

  // Generate rewritten paragraph
  const rewrittenParagraph = generateParagraph(bullets.length > 0 ? bullets : [content], title, language);

  // Generate speaker notes
  const speakerNotes = generateSpeakerNotes(title, content, bullets, language, context);

  return {
    improvedBullets: improvedBullets.length > 0 ? improvedBullets : bullets,
    rewrittenParagraph,
    speakerNotes,
    suggestions: suggestions.length > 0 ? suggestions : [
      language === "ar" 
        ? "الشريحة جيدة - يمكن تحسينها بإضافة أمثلة أو تفاصيل إضافية"
        : "Slide looks good - could be improved with examples or additional details"
    ],
  };
}

/**
 * Analyzes a full presentation and provides comprehensive feedback
 */
export function analyzePresentation(
  slides: SlideContent[],
  context: PresentationContext
): PresentationAnalysisResult {
  const language = context.language || "en";
  const totalSlides = slides.length;
  
  // Extract key information from all slides
  const titles = slides.map(s => s.title).filter(Boolean);
  const allContent = slides.map(s => s.content).filter(Boolean);
  const allBullets = allContent.flatMap(c => extractBullets(c, language));
  
  // Analyze structure
  const hasTitleSlide = titles.length > 0 && (titles[0].toLowerCase().includes("title") || titles[0] === slides[0]?.title);
  const hasIntroduction = titles.some(t => 
    t.toLowerCase().includes("intro") || 
    t.toLowerCase().includes("overview") ||
    (language === "ar" && (t.includes("مقدمة") || t.includes("نظرة عامة")))
  );
  const hasConclusion = titles.some(t => 
    t.toLowerCase().includes("conclusion") || 
    t.toLowerCase().includes("summary") ||
    (language === "ar" && (t.includes("خلاصة") || t.includes("ملخص")))
  );
  
  // Analyze content quality
  const avgWordsPerSlide = allContent.reduce((sum, c) => sum + countWords(c), 0) / Math.max(totalSlides, 1);
  const hasExamples = allContent.some(c => detectExamples(c, language));
  const hasBenefits = allContent.some(c => detectBenefits(c, language));
  const hasProblems = allContent.some(c => detectProblemWords(c, language));
  const hasSolutions = allContent.some(c => detectSolutionWords(c, language));
  
  // Generate summary
  const summary = generatePresentationSummary(titles, allBullets, context, language);
  
  // Extract key points
  const keyPoints = extractKeyPoints(titles, allBullets, language);
  
  // Identify strengths
  const strengths: string[] = [];
  if (totalSlides >= 5 && totalSlides <= 15) {
    strengths.push(language === "ar"
      ? `عدد الشرائح مناسب (${totalSlides} شريحة)`
      : `Good slide count (${totalSlides} slides)`);
  }
  if (hasTitleSlide) {
    strengths.push(language === "ar" ? "يحتوي على شريحة عنوان واضحة" : "Has a clear title slide");
  }
  if (hasIntroduction) {
    strengths.push(language === "ar" ? "يحتوي على مقدمة جيدة" : "Has a good introduction");
  }
  if (hasConclusion) {
    strengths.push(language === "ar" ? "يحتوي على خلاصة أو خاتمة" : "Has a conclusion or summary");
  }
  if (avgWordsPerSlide >= 30) {
    strengths.push(language === "ar"
      ? "المحتوى مفصل بشكل جيد"
      : "Content is well-detailed");
  }
  if (hasExamples) {
    strengths.push(language === "ar" ? "يحتوي على أمثلة عملية" : "Contains practical examples");
  }
  if (hasBenefits) {
    strengths.push(language === "ar" ? "يبرز الفوائد والنتائج" : "Highlights benefits and outcomes");
  }
  
  // Identify weaknesses
  const weaknesses: string[] = [];
  if (totalSlides < 3) {
    weaknesses.push(language === "ar"
      ? "عدد الشرائح قليل جداً - أضف المزيد من المحتوى"
      : "Too few slides - add more content");
  }
  if (totalSlides > 20) {
    weaknesses.push(language === "ar"
      ? "عدد الشرائح كبير جداً - فكر في تقسيم العرض"
      : "Too many slides - consider splitting the presentation");
  }
  if (!hasIntroduction) {
    weaknesses.push(language === "ar"
      ? "يفتقر إلى شريحة مقدمة واضحة"
      : "Missing a clear introduction slide");
  }
  if (!hasConclusion) {
    weaknesses.push(language === "ar"
      ? "يفتقر إلى شريحة خاتمة أو ملخص"
      : "Missing a conclusion or summary slide");
  }
  if (avgWordsPerSlide < 20) {
    weaknesses.push(language === "ar"
      ? "المحتوى قصير - أضف المزيد من التفاصيل"
      : "Content is too brief - add more details");
  }
  if (!hasExamples) {
    weaknesses.push(language === "ar"
      ? "يفتقر إلى أمثلة عملية أو حالات استخدام"
      : "Missing practical examples or use cases");
  }
  if (hasProblems && !hasSolutions) {
    weaknesses.push(language === "ar"
      ? "يذكر المشاكل دون تقديم حلول"
      : "Mentions problems without providing solutions");
  }
  if (!hasBenefits && (hasProblems || hasSolutions)) {
    weaknesses.push(language === "ar"
      ? "لا يبرز الفوائد والنتائج الإيجابية بشكل كافٍ"
      : "Doesn't sufficiently highlight benefits and positive outcomes");
  }
  
  // Generate recommendations
  const recommendations: string[] = [];
  if (!hasIntroduction) {
    recommendations.push(language === "ar"
      ? "أضف شريحة مقدمة توضح الهدف والجمهور"
      : "Add an introduction slide explaining the goal and audience");
  }
  if (!hasConclusion) {
    recommendations.push(language === "ar"
      ? "أضف شريحة خاتمة تلخص النقاط الرئيسية"
      : "Add a conclusion slide summarizing key points");
  }
  if (!hasExamples) {
    recommendations.push(language === "ar"
      ? "أضف أمثلة عملية أو حالات استخدام واقعية"
      : "Add practical examples or real-world use cases");
  }
  if (hasProblems && !hasSolutions) {
    recommendations.push(language === "ar"
      ? "أضف حلول أو استراتيجيات للتخفيف من المشاكل المذكورة"
      : "Add solutions or mitigation strategies for mentioned problems");
  }
  if (avgWordsPerSlide < 30) {
    recommendations.push(language === "ar"
      ? "أضف المزيد من التفاصيل والأمثلة للشرائح القصيرة"
      : "Add more details and examples to short slides");
  }
  if (totalSlides < 5) {
    recommendations.push(language === "ar"
      ? "فكر في إضافة المزيد من الشرائح لتغطية الموضوع بشكل شامل"
      : "Consider adding more slides to comprehensively cover the topic");
  }
  
  // Calculate quality score (0-100)
  let score = 50; // Base score
  
  // Slide count (optimal: 5-15)
  if (totalSlides >= 5 && totalSlides <= 15) score += 10;
  else if (totalSlides >= 3 && totalSlides < 20) score += 5;
  
  // Structure
  if (hasTitleSlide) score += 5;
  if (hasIntroduction) score += 5;
  if (hasConclusion) score += 5;
  
  // Content quality
  if (avgWordsPerSlide >= 30) score += 10;
  else if (avgWordsPerSlide >= 20) score += 5;
  
  // Examples and benefits
  if (hasExamples) score += 5;
  if (hasBenefits) score += 5;
  if (hasSolutions && hasProblems) score += 5;
  
  // Balance
  if (weaknesses.length === 0) score += 5;
  if (strengths.length >= 5) score += 5;
  
  const estimatedQualityScore = Math.min(100, Math.max(0, score));
  
  return {
    summary,
    keyPoints,
    strengths: strengths.length > 0 ? strengths : [
      language === "ar" ? "العرض يحتوي على محتوى أساسي جيد" : "Presentation has good basic content"
    ],
    weaknesses: weaknesses.length > 0 ? weaknesses : [
      language === "ar" ? "لا توجد نقاط ضعف واضحة" : "No obvious weaknesses"
    ],
    recommendations: recommendations.length > 0 ? recommendations : [
      language === "ar" ? "العرض جيد - يمكن تحسينه بإضافة المزيد من التفاصيل" : "Presentation is good - can be improved with more details"
    ],
    estimatedQualityScore,
  };
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

