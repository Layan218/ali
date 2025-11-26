/**
 * AI Presentation Generation Service
 * 
 * Generates structured presentation slides using local mock AI logic.
 * Works without any external API keys or network dependencies.
 * 
 * Features:
 * - Topic-based content generation
 * - Goal-aware structure (Inform, Persuade, Train, etc.)
 * - Audience-aware language (Executives, Team, Technical, etc.)
 * - Tone-aware phrasing (Formal, Friendly, Technical)
 * - Language support (English, Arabic placeholder)
 * - Progress callbacks for UI updates
 * - Always returns valid slides (safe fallbacks)
 */

export interface AIPresentationRequest {
  topic: string;
  goal?: string; // e.g., "Inform", "Persuade", "Train", "Review", "Propose"
  audience?: string; // e.g., "Executives", "Team members", "Clients", "Technical team"
  tone?: "formal" | "friendly" | "technical";
  language?: "en" | "ar";
  slideCount: number; // 1-20
}

export interface AIPresentationSlide {
  title: string;
  bullets: string[]; // 4-6 detailed bullet points for professional presentations
  notes?: string; // Optional speaker notes
  layout?: "title-only" | "title-bullets" | "title-two-column";
  imagePrompt?: string; // Suggested illustration description for the slide
  needsImage?: boolean; // Whether this slide should have an image
}

export interface AIGenerationProgress {
  currentSlide: number;
  totalSlides: number;
  message: string;
}

/**
 * Generates a complete presentation based on user requirements.
 * Uses OpenAI API if available, falls back to local generation if API fails.
 * 
 * @param request - User's presentation requirements
 * @param onProgress - Optional callback for progress updates
 * @returns Promise resolving to array of generated slides
 */
export async function generatePresentation(
  request: AIPresentationRequest,
  onProgress?: (progress: AIGenerationProgress) => void
): Promise<AIPresentationSlide[]> {
  try {
    // Validate and normalize inputs
    const topic = request.topic.trim() || "Untitled Presentation";
    const goal = request.goal?.trim().toLowerCase() || "inform";
    const audience = request.audience?.trim() || "General audience";
    const tone = request.tone || "formal";
    const language = request.language || "en";
    const slideCount = Math.max(1, Math.min(20, request.slideCount || 6));

    // Report initial progress
    if (onProgress) {
      onProgress({
        currentSlide: 0,
        totalSlides: slideCount,
        message: `Connecting to AI service...`,
      });
    }

    // Try OpenAI API first
    try {
      if (onProgress) {
        onProgress({
          currentSlide: 0,
          totalSlides: slideCount,
          message: `Generating presentation with AI...`,
        });
      }

      const response = await fetch("/api/openai/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic,
          goal,
          audience,
          tone,
          language,
          slideCount,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.slides && Array.isArray(data.slides) && data.slides.length > 0) {
        // Final progress update
        if (onProgress) {
          onProgress({
            currentSlide: slideCount,
            totalSlides: slideCount,
            message: `Completed! Generated ${data.slides.length} slides.`,
          });
        }

        console.log(`[AI Service] Successfully generated ${data.slides.length} slides using OpenAI for topic: "${topic}"`);
        console.log(`[AI Service] Recommended theme: ${data.recommendedTheme || "default"}`);
        console.log(`[AI Service] Presentation structure: ${data.presentationStructure || "standard"}`);
        
        // Store recommended theme and structure for use in presentation creation
        // Attach metadata to all slides for easy access
        const slidesWithMetadata = data.slides.map((slide: any) => ({
          ...slide,
          _recommendedTheme: data.recommendedTheme || "default",
          _presentationStructure: data.presentationStructure || "",
        }));
        
        return slidesWithMetadata as AIPresentationSlide[];
      } else {
        throw new Error("Invalid response format from OpenAI API");
      }
    } catch (apiError: any) {
      console.warn("[AI Service] OpenAI API failed, falling back to local generation:", apiError);
      
      // Fall back to local generation
      if (onProgress) {
        onProgress({
          currentSlide: 0,
          totalSlides: slideCount,
          message: `Using local AI generator...`,
        });
      }

      return generateLocalPresentation(request, onProgress);
    }

  } catch (error) {
    console.error("[AI Service] Error generating presentation:", error);
    
    // Return safe fallback slides
    return generateFallbackSlides(request);
  }
}

/**
 * Local presentation generation (fallback when OpenAI API is unavailable)
 */
function generateLocalPresentation(
  request: AIPresentationRequest,
  onProgress?: (progress: AIGenerationProgress) => void
): AIPresentationSlide[] {
  // Validate and normalize inputs
  const topic = request.topic.trim() || "Untitled Presentation";
  const goal = request.goal?.trim().toLowerCase() || "inform";
  const audience = request.audience?.trim() || "General audience";
  const tone = request.tone || "formal";
  const language = request.language || "en";
  const slideCount = Math.max(1, Math.min(20, request.slideCount || 6));

  // Report initial progress
  if (onProgress) {
    onProgress({
      currentSlide: 0,
      totalSlides: slideCount,
      message: `Analyzing topic: ${topic}...`,
    });
  }

  // Analyze topic to extract keywords and category
  const topicAnalysis = analyzeTopic(topic);
  
  // Generate slides based on structure
  const slides: AIPresentationSlide[] = [];
  
  // Slide 1: Title slide
  if (onProgress) {
    onProgress({
      currentSlide: 1,
      totalSlides: slideCount,
      message: `Generating slide 1 of ${slideCount}: Title slide...`,
    });
  }
  
  slides.push(generateTitleSlide(topic, goal, audience, tone, language, topicAnalysis));

  if (slideCount <= 1) {
    return slides;
  }

  // Slide 2: Introduction/Overview
  if (onProgress) {
    onProgress({
      currentSlide: 2,
      totalSlides: slideCount,
      message: `Generating slide 2 of ${slideCount}: Introduction...`,
    });
  }
  
  slides.push(generateIntroductionSlide(topic, goal, audience, tone, language, topicAnalysis));

  if (slideCount <= 2) {
    return slides;
  }

  // Determine slide structure based on goal
  const structure = getSlideStructure(goal, slideCount - 2, language, topicAnalysis.category); // Excluding title and intro

  // Generate content slides
  for (let i = 0; i < structure.length; i++) {
    const slideType = structure[i];
    const slideNumber = i + 3; // +3 because we have title (1) and intro (2)
    
    if (onProgress) {
      onProgress({
        currentSlide: slideNumber,
        totalSlides: slideCount,
        message: `Generating slide ${slideNumber} of ${slideCount}: ${slideType}...`,
      });
    }

    const slide = generateContentSlide(
      topic,
      slideType,
      goal,
      audience,
      tone,
      language,
      topicAnalysis,
      i,
      structure.length
    );
    
    slides.push(slide);
  }

  // Ensure we have exactly the requested number of slides
  if (slides.length > slideCount) {
    slides.splice(slideCount);
  } else if (slides.length < slideCount) {
    // Add additional content slides if needed
    const additionalNeeded = slideCount - slides.length;
    for (let i = 0; i < additionalNeeded; i++) {
      const slideNumber = slides.length + 1;
      if (onProgress) {
        onProgress({
          currentSlide: slideNumber,
          totalSlides: slideCount,
          message: `Generating slide ${slideNumber} of ${slideCount}: Additional content...`,
        });
      }
      
      slides.push(generateContentSlide(
        topic,
        "Key Points",
        goal,
        audience,
        tone,
        language,
        topicAnalysis,
        slides.length - 2,
        additionalNeeded
      ));
    }
  }

  // Final progress update
  if (onProgress) {
    onProgress({
      currentSlide: slideCount,
      totalSlides: slideCount,
      message: `Completed! Generated ${slideCount} slides.`,
    });
  }

  console.log(`[AI Service] Successfully generated ${slides.length} slides locally for topic: "${topic}"`);
  return slides;
}

/**
 * Analyzes the topic to extract keywords and determine category
 */
function analyzeTopic(topic: string): {
  keywords: string[];
  category: "business" | "technology" | "training" | "strategy" | "general";
  mainConcept: string;
} {
  const lowerTopic = topic.toLowerCase();
  const words = lowerTopic.split(/\s+/).filter(w => w.length > 2);
  
  // Detect category
  let category: "business" | "technology" | "training" | "strategy" | "general" = "general";
  
  const techKeywords = ["technology", "digital", "software", "ai", "machine learning", "data", "cloud", "cyber", "system", "platform", "app", "application"];
  const businessKeywords = ["business", "strategy", "market", "sales", "revenue", "profit", "customer", "client", "organization", "company", "enterprise"];
  const trainingKeywords = ["training", "learning", "education", "course", "workshop", "tutorial", "guide", "how to"];
  const strategyKeywords = ["strategy", "plan", "roadmap", "vision", "mission", "goals", "objectives", "initiative"];
  
  if (techKeywords.some(kw => lowerTopic.includes(kw))) {
    category = "technology";
  } else if (trainingKeywords.some(kw => lowerTopic.includes(kw))) {
    category = "training";
  } else if (strategyKeywords.some(kw => lowerTopic.includes(kw))) {
    category = "strategy";
  } else if (businessKeywords.some(kw => lowerTopic.includes(kw))) {
    category = "business";
  }
  
  return {
    keywords: words,
    category,
    mainConcept: words[0] || topic,
  };
}

/**
 * Determines slide structure based on goal
 */
function getSlideStructure(
  goal: string,
  availableSlides: number,
  language?: string,
  category?: string
): string[] {
  const goalLower = goal.toLowerCase();
  const isArabic = language === "ar";
  const isTechnical = category === "technology";
  
  if (goalLower.includes("persuade") || goalLower.includes("propose")) {
    // Problem-Solution structure
    const structure = [
      "Problem Statement",
      "Solution Overview",
      "Key Benefits",
      "Implementation Plan",
      "Expected Outcomes",
      "Call to Action",
    ];
    // For Arabic technical topics, add "How It Works" slide
    if (isArabic && isTechnical && availableSlides >= 5) {
      structure.splice(3, 0, "How It Works");
    }
    return structure.slice(0, availableSlides);
  } else if (goalLower.includes("train") || goalLower.includes("educate")) {
    // Step-by-step training structure
    const structure = [
      "Learning Objectives",
      "Key Concepts",
      "Step-by-Step Process",
      "Best Practices",
      "Common Pitfalls",
      "Summary & Next Steps",
    ];
    // For Arabic technical topics, add "How It Works" and "Examples" slides
    if (isArabic && isTechnical && availableSlides >= 6) {
      structure.splice(3, 0, "How It Works");
      structure.splice(5, 0, "Examples & Use Cases");
    }
    return structure.slice(0, availableSlides);
  } else if (goalLower.includes("review") || goalLower.includes("report")) {
    // Review/Report structure
    return [
      "Overview",
      "Key Findings",
      "Analysis",
      "Recommendations",
      "Next Steps",
    ].slice(0, availableSlides);
  } else {
    // Default informative structure
    const structure = [
      "Overview",
      "Key Concepts",
      "Important Aspects",
      "Applications & Use Cases",
      "Benefits & Impact",
      "Conclusion",
    ];
    // For Arabic technical topics, add "How It Works" slide
    if (isArabic && isTechnical && availableSlides >= 5) {
      structure.splice(3, 0, "How It Works");
    }
    return structure.slice(0, availableSlides);
  }
}

/**
 * Generates title slide
 */
function generateTitleSlide(
  topic: string,
  goal: string,
  audience: string,
  tone: string,
  language: string,
  analysis: ReturnType<typeof analyzeTopic>
): AIPresentationSlide {
  const title = formatTitle(topic, tone, language);
  
  let subtitle = "";
  if (language === "en") {
    if (tone === "formal") {
      subtitle = `Presented to ${audience}`;
    } else if (tone === "friendly") {
      subtitle = `Welcome, ${audience}!`;
    } else {
      subtitle = `${audience} Overview`;
    }
  } else {
    // Arabic subtitle
    if (tone === "formal") {
      subtitle = audience ? `عرض تقديمي مقدم إلى ${audience}` : "عرض تقديمي احترافي";
    } else if (tone === "friendly") {
      subtitle = audience ? `مرحباً ${audience}!` : "عرض تقديمي تفاعلي";
    } else {
      subtitle = audience ? `نظرة عامة تقنية لـ ${audience}` : "نظرة عامة تقنية";
    }
  }

  return {
    title,
    bullets: [],
    notes: `Opening slide for ${topic}. Goal: ${goal}. Audience: ${audience}.`,
    layout: "title-only",
  };
}

/**
 * Generates introduction/overview slide
 */
function generateIntroductionSlide(
  topic: string,
  goal: string,
  audience: string,
  tone: string,
  language: string,
  analysis: ReturnType<typeof analyzeTopic>
): AIPresentationSlide {
  const bullets: string[] = [];
  
  if (language === "en") {
    if (tone === "formal") {
      bullets.push(
        `This presentation provides a comprehensive overview of ${topic}.`,
        `We will explore key concepts, important aspects, and practical applications.`,
        `Our objective is to enhance understanding and facilitate informed decision-making.`,
        `This session is designed for ${audience} seeking actionable insights.`
      );
    } else if (tone === "friendly") {
      bullets.push(
        `Welcome! Today we're diving into ${topic}.`,
        `We'll cover the essentials and share some practical tips along the way.`,
        `Feel free to ask questions - this is an interactive session!`,
        `Let's make this valuable for everyone, especially our ${audience}.`
      );
    } else {
      // Technical
      bullets.push(
        `This technical overview covers ${topic} in detail.`,
        `We'll examine core components, architecture, and implementation considerations.`,
        `Focus areas include technical specifications and best practices.`,
        `Designed for ${audience} with technical background.`
      );
    }
  } else {
    // Arabic introduction with richer content
    if (tone === "formal") {
      bullets.push(
        `يقدم هذا العرض التقديمي نظرة شاملة ومتعمقة حول موضوع ${topic} مع التركيز على الجوانب العملية والتطبيقية.`,
        `سنستكشف خلال هذا العرض المفاهيم الأساسية والمبادئ الرئيسية التي تشكل أساس فهم هذا الموضوع المهم.`,
        `يهدف هذا العرض إلى تعزيز الفهم العميق وتمكين الحضور من اتخاذ قرارات مستنيرة ومبنية على المعرفة الصحيحة.`,
        `تم تصميم هذا العرض خصيصاً لـ ${audience || "الحضور"} الذين يسعون للحصول على رؤى قابلة للتطبيق ومعلومات عملية قيمة.`
      );
    } else if (tone === "friendly") {
      bullets.push(
        `مرحباً بكم! اليوم سنتعمق في موضوع ${topic} بطريقة تفاعلية وممتعة مع التركيز على الجوانب العملية.`,
        `سنغطي خلال هذا العرض النقاط الأساسية والمهمة مع مشاركة نصائح عملية وتجارب واقعية يمكن تطبيقها فوراً.`,
        `نشجعكم على طرح الأسئلة والمشاركة في النقاش لأن هذا عرض تفاعلي هدفه الاستفادة للجميع.`,
        `دعونا نجعل هذا العرض مفيداً وقيمياً للجميع وخاصة لـ ${audience || "أعضاء الفريق"} الذين يشاركوننا اليوم.`
      );
    } else {
      // Technical
      bullets.push(
        `تغطي هذه النظرة التقنية الشاملة موضوع ${topic} بالتفصيل مع التركيز على المكونات الأساسية والهندسة المعمارية.`,
        `سنفحص خلال هذا العرض المكونات الأساسية والبنية التحتية والاعتبارات التقنية المتعلقة بالتنفيذ والتطبيق العملي.`,
        `تشمل مجالات التركيز المواصفات التقنية وأفضل الممارسات والمعايير الصناعية المعتمدة في هذا المجال.`,
        `تم تصميم هذا العرض خصيصاً لـ ${audience || "الفريق التقني"} الذي يمتلك خلفية تقنية ويرغب في التعمق في التفاصيل.`
      );
    }
  }

  // For Arabic, ensure we have at least 4 bullets
  const finalBullets = language === "ar" ? bullets.slice(0, Math.max(4, bullets.length)) : bullets.slice(0, 4);

  return {
    title: language === "ar" 
      ? (tone === "formal" ? "مقدمة" : tone === "friendly" ? "مرحباً ونظرة عامة" : "نظرة عامة تقنية")
      : (tone === "formal" ? "Introduction" : tone === "friendly" ? "Welcome & Overview" : "Technical Overview"),
    bullets: finalBullets,
    notes: `Introduction slide setting context for ${topic}.`,
    layout: "title-bullets",
  };
}

/**
 * Generates a content slide based on type
 */
function generateContentSlide(
  topic: string,
  slideType: string,
  goal: string,
  audience: string,
  tone: string,
  language: string,
  analysis: ReturnType<typeof analyzeTopic>,
  index: number,
  total: number
): AIPresentationSlide {
  const bullets = generateBulletsForSlideType(
    topic,
    slideType,
    goal,
    audience,
    tone,
    language,
    analysis,
    index,
    total
  );

  const title = formatSlideTitle(slideType, tone, language);
  const notes = generateSpeakerNotes(topic, slideType, tone);

  return {
    title,
    bullets,
    notes,
    layout: bullets.length > 0 ? "title-bullets" : "title-only",
  };
}

/**
 * Generates bullet points for a specific slide type
 */
function generateBulletsForSlideType(
  topic: string,
  slideType: string,
  goal: string,
  audience: string,
  tone: string,
  language: string,
  analysis: ReturnType<typeof analyzeTopic>,
  index: number,
  total: number
): string[] {
  const bullets: string[] = [];
  const typeLower = slideType.toLowerCase();
  const { keywords, category, mainConcept } = analysis;

  if (language === "en") {
    // Problem Statement
    if (typeLower.includes("problem")) {
      if (tone === "formal") {
        bullets.push(
          `Organizations face significant challenges related to ${topic}.`,
          `Current approaches may not adequately address evolving requirements.`,
          `Inefficiencies and gaps in existing processes impact overall performance.`,
          `Strategic intervention is required to overcome these obstacles.`
        );
      } else if (tone === "friendly") {
        bullets.push(
          `Let's talk about the challenges we're seeing with ${topic}.`,
          `Many teams struggle with outdated methods and processes.`,
          `We've noticed some gaps that are holding us back.`,
          `The good news? There are solutions we can implement!`
        );
      } else {
        bullets.push(
          `Technical challenges in ${topic} include scalability and integration issues.`,
          `Legacy systems create bottlenecks and limit functionality.`,
          `Performance degradation and maintenance overhead are key concerns.`,
          `Architectural improvements are necessary for optimal operation.`
        );
      }
    }
    // Solution Overview
    else if (typeLower.includes("solution")) {
      if (tone === "formal") {
        bullets.push(
          `Our proposed solution addresses the core challenges of ${topic}.`,
          `A comprehensive framework ensures systematic implementation.`,
          `Phased approach allows for manageable deployment and risk mitigation.`,
          `Measurable outcomes and ROI demonstrate clear value proposition.`
        );
      } else if (tone === "friendly") {
        bullets.push(
          `Here's how we can tackle ${topic} together!`,
          `We've designed a practical approach that works step by step.`,
          `You'll see progress quickly, and we'll support you along the way.`,
          `The benefits are real - let's make this happen!`
        );
      } else {
        bullets.push(
          `Technical solution leverages modern architecture and best practices.`,
          `Modular design enables scalability and maintainability.`,
          `Integration points are well-defined with clear APIs and protocols.`,
          `Performance optimization and monitoring ensure reliable operation.`
        );
      }
    }
    // Key Benefits
    else if (typeLower.includes("benefit") || typeLower.includes("advantage")) {
      bullets.push(
        `Enhanced efficiency and productivity in ${mainConcept} operations.`,
        `Improved decision-making through better data and insights.`,
        `Cost reduction and resource optimization opportunities.`,
        `Competitive advantage and market positioning improvements.`
      );
    }
    // Implementation Plan
    else if (typeLower.includes("implement") || typeLower.includes("plan")) {
      bullets.push(
        `Phase 1: Assessment and planning (Weeks 1-2)`,
        `Phase 2: Development and configuration (Weeks 3-6)`,
        `Phase 3: Testing and refinement (Weeks 7-8)`,
        `Phase 4: Deployment and training (Weeks 9-10)`
      );
    }
    // Learning Objectives
    else if (typeLower.includes("learning") || typeLower.includes("objective")) {
      bullets.push(
        `Understand the fundamental concepts of ${topic}.`,
        `Learn practical techniques and best practices.`,
        `Apply knowledge to real-world scenarios.`,
        `Develop skills for continued success.`
      );
    }
    // Key Concepts
    else if (typeLower.includes("concept") || typeLower.includes("overview")) {
      const conceptBullets = generateConceptBullets(topic, category, tone, mainConcept);
      bullets.push(...conceptBullets);
    }
    // Best Practices
    else if (typeLower.includes("practice") || typeLower.includes("pitfall")) {
      bullets.push(
        `Establish clear guidelines and standards for ${mainConcept}.`,
        `Regular monitoring and continuous improvement processes.`,
        `Team training and knowledge sharing initiatives.`,
        `Documentation and lessons learned capture.`
      );
    }
    // Conclusion / Summary
    else if (typeLower.includes("conclusion") || typeLower.includes("summary") || typeLower.includes("next step")) {
      bullets.push(
        `We've covered essential aspects of ${topic}.`,
        `Key takeaways highlight the importance of strategic approach.`,
        `Next steps involve implementation and continuous improvement.`,
        `Thank you for your attention. Questions and discussion welcome.`
      );
    }
    // Default / Generic content
    else {
      const genericBullets = generateGenericBullets(topic, category, tone, mainConcept, index, total);
      bullets.push(...genericBullets);
    }
  } else {
    // Arabic content generation with rich, specific content
    bullets.push(...generateArabicBullets(topic, slideType, goal, audience, tone, analysis, index, total));
  }

  // Ensure 3-5 bullets
  while (bullets.length < 3) {
    bullets.push(`Additional important point about ${topic}.`);
  }
  if (bullets.length > 5) {
    return bullets.slice(0, 5);
  }

  return bullets;
}

/**
 * Generates concept-specific bullets based on category
 */
function generateConceptBullets(
  topic: string,
  category: string,
  tone: string,
  mainConcept: string
): string[] {
  const bullets: string[] = [];

  if (category === "technology") {
    bullets.push(
      `${topic} encompasses modern technological solutions and innovations.`,
      `Core components include architecture, infrastructure, and integration layers.`,
      `Key technologies enable scalability, security, and performance.`,
      `Implementation requires technical expertise and strategic planning.`
    );
  } else if (category === "business") {
    bullets.push(
      `${topic} is essential for organizational success and growth.`,
      `Strategic alignment with business objectives drives value creation.`,
      `Key stakeholders and processes must be considered.`,
      `Market dynamics and competitive landscape influence approach.`
    );
  } else if (category === "training") {
    bullets.push(
      `${topic} training builds essential skills and knowledge.`,
      `Structured learning path ensures comprehensive understanding.`,
      `Practical exercises reinforce theoretical concepts.`,
      `Assessment and feedback support continuous improvement.`
    );
  } else {
    bullets.push(
      `${topic} involves multiple interconnected components and considerations.`,
      `Understanding key principles is fundamental to success.`,
      `Practical application requires careful planning and execution.`,
      `Continuous learning and adaptation are essential.`
    );
  }

  return bullets.slice(0, 4);
}

/**
 * Generates generic bullets when slide type doesn't match specific patterns
 */
function generateGenericBullets(
  topic: string,
  category: string,
  tone: string,
  mainConcept: string,
  index: number,
  total: number
): string[] {
  const bullets: string[] = [];
  const position = index + 1;
  const isEarly = position <= total / 3;
  const isLate = position > (total * 2) / 3;

  if (isEarly) {
    bullets.push(
      `Exploring fundamental aspects of ${topic}.`,
      `Key considerations for ${mainConcept} implementation.`,
      `Important factors that influence success.`,
      `Strategic approach to maximize effectiveness.`
    );
  } else if (isLate) {
    bullets.push(
      `Building on previous concepts, we examine advanced topics.`,
      `Practical applications and real-world examples.`,
      `Lessons learned and best practices.`,
      `Preparing for next steps and future development.`
    );
  } else {
    bullets.push(
      `Delving deeper into ${topic} components.`,
      `Critical analysis and evaluation of options.`,
      `Integration with existing systems and processes.`,
      `Optimization strategies for improved outcomes.`
    );
  }

  return bullets;
}

/**
 * Generates rich Arabic bullets for different slide types
 */
function generateArabicBullets(
  topic: string,
  slideType: string,
  goal: string,
  audience: string,
  tone: string,
  analysis: ReturnType<typeof analyzeTopic>,
  index: number,
  total: number
): string[] {
  const bullets: string[] = [];
  const typeLower = slideType.toLowerCase();
  const { keywords, category, mainConcept } = analysis;
  const goalLower = goal.toLowerCase();

  // Problem Statement
  if (typeLower.includes("problem") || typeLower.includes("challenge")) {
    if (tone === "formal") {
      bullets.push(
        `تواجه المنظمات والمؤسسات تحديات كبيرة ومتعددة الأوجه فيما يتعلق بموضوع ${topic} مما يتطلب حلولاً استراتيجية شاملة.`,
        `الأساليب والنهج الحالية قد لا تكون كافية لمواجهة المتطلبات المتطورة والمتغيرة باستمرار في هذا المجال.`,
        `عدم الكفاءة والفجوات الموجودة في العمليات الحالية تؤثر بشكل مباشر على الأداء العام والنتائج المرجوة.`,
        `التدخل الاستراتيجي والتحسين المنهجي أصبح ضرورياً للتغلب على هذه العقبات وتحقيق الأهداف المرجوة.`
      );
    } else if (tone === "friendly") {
      bullets.push(
        `دعونا نتحدث عن التحديات التي نواجهها في مجال ${topic} وكيف يمكننا معالجتها بطريقة عملية وفعالة.`,
        `الكثير من الفرق تواجه صعوبات مع الأساليب والعمليات القديمة التي لم تعد مناسبة للوضع الحالي.`,
        `لاحظنا وجود بعض الفجوات والعقبات التي تعيق تقدمنا وتحول دون تحقيق النتائج المطلوبة بفعالية.`,
        `الخبر السار هو أن هناك حلول عملية وواضحة يمكننا تطبيقها لتحسين الوضع وتحقيق النجاح المطلوب.`
      );
    } else {
      bullets.push(
        `التحديات التقنية في مجال ${topic} تشمل مشاكل قابلية التوسع والتكامل مع الأنظمة الأخرى والبنية التحتية.`,
        `الأنظمة القديمة والتراثية تخلق اختناقات وتحد من الوظائف المتاحة وتؤثر سلباً على الأداء العام.`,
        `تدهور الأداء وزيادة تكاليف الصيانة والعمليات أصبحت من الاهتمامات الرئيسية التي تحتاج إلى معالجة فورية.`,
        `التحسينات المعمارية والهيكلية أصبحت ضرورية لضمان التشغيل الأمثل وتحقيق الكفاءة المطلوبة.`
      );
    }
  }
  // Solution Overview
  else if (typeLower.includes("solution") || typeLower.includes("approach")) {
    if (tone === "formal") {
      bullets.push(
        `الحل المقترح يعالج التحديات الأساسية المتعلقة بموضوع ${topic} من خلال نهج شامل ومنهجي مدروس بعناية.`,
        `الإطار الشامل يضمن التنفيذ المنهجي والمنظم مع مراعاة جميع الجوانب والاعتبارات المهمة في هذا المجال.`,
        `النهج التدريجي والمرحلي يسمح بالنشر والإدارة بشكل يمكن التحكم فيه مع تقليل المخاطر إلى أدنى حد ممكن.`,
        `النتائج القابلة للقياس والعائد على الاستثمار يوضحان القيمة الواضحة والفوائد الملموسة لهذا الحل المقترح.`
      );
    } else if (tone === "friendly") {
      bullets.push(
        `إليكم كيف يمكننا معالجة موضوع ${topic} معاً من خلال نهج عملي وتدريجي يضمن النجاح والاستفادة للجميع.`,
        `لقد صممنا نهجاً عملياً يعمل خطوة بخطوة مع إمكانية رؤية التقدم والنتائج بسرعة ووضوح.`,
        `ستلاحظون التحسينات والتقدم بسرعة وسنكون معكم في كل خطوة لتقديم الدعم والمساعدة اللازمة.`,
        `الفوائد حقيقية وملموسة ويمكن تحقيقها بسهولة - دعونا نبدأ في تطبيق هذا الحل وتحقيق النجاح المطلوب.`
      );
    } else {
      bullets.push(
        `الحل التقني يستفيد من أحدث المعماريات وأفضل الممارسات المعتمدة في الصناعة لضمان الكفاءة والموثوقية.`,
        `التصميم المعياري والوحدات المستقلة يسمح بقابلية التوسع والصيانة السهلة والتطوير المستمر بمرونة عالية.`,
        `نقاط التكامل محددة بوضوح مع واجهات برمجية وبروتوكولات واضحة تضمن التوافق والتفاعل السلس مع الأنظمة الأخرى.`,
        `تحسين الأداء والمراقبة المستمرة يضمن التشغيل الموثوق والكشف المبكر عن أي مشاكل أو تحديات محتملة.`
      );
    }
  }
  // Key Benefits
  else if (typeLower.includes("benefit") || typeLower.includes("advantage") || typeLower.includes("impact")) {
    const audienceText = audience ? `لـ ${audience}` : "للمؤسسة";
    bullets.push(
      `تحسين الكفاءة والإنتاجية بشكل كبير في عمليات ${mainConcept} مما يؤدي إلى توفير الوقت والموارد بشكل ملحوظ.`,
      `تحسين عملية اتخاذ القرارات من خلال توفير بيانات أفضل ورؤى أعمق تساعد في الاختيار الصحيح والاستراتيجي.`,
      `تخفيض التكاليف وتحسين استخدام الموارد المتاحة مع زيادة العائد على الاستثمار وتحقيق أقصى استفادة ممكنة.`,
      `الميزة التنافسية وتحسين الموقف في السوق من خلال الابتكار والتميز في الأداء والخدمات المقدمة ${audienceText}.`
    );
  }
  // Implementation Plan
  else if (typeLower.includes("implement") || typeLower.includes("plan") || typeLower.includes("roadmap")) {
    bullets.push(
      `المرحلة الأولى: التقييم والتخطيط الشامل خلال الأسابيع الأولى والثانية مع تحديد المتطلبات والأهداف بوضوح.`,
      `المرحلة الثانية: التطوير والإعداد والتهيئة خلال الأسابيع من الثالث إلى السادس مع بناء البنية التحتية اللازمة.`,
      `المرحلة الثالثة: الاختبار والتحسين والصقل خلال الأسابيع السابع والثامن مع ضمان الجودة والموثوقية.`,
      `المرحلة الرابعة: النشر والتدريب والتشغيل خلال الأسابيع التاسع والعاشر مع ضمان الانتقال السلس والنجاح.`
    );
  }
  // Learning Objectives
  else if (typeLower.includes("learning") || typeLower.includes("objective") || typeLower.includes("goal")) {
    bullets.push(
      `فهم المفاهيم الأساسية والمبادئ الرئيسية المتعلقة بموضوع ${topic} بشكل شامل وعميق مع التركيز على التطبيق العملي.`,
      `تعلم التقنيات والأساليب العملية وأفضل الممارسات المعتمدة في هذا المجال مع إمكانية التطبيق الفوري.`,
      `تطبيق المعرفة المكتسبة على سيناريوهات واقعية وحالات عملية من خلال أمثلة وتجارب عملية واضحة ومفيدة.`,
      `تطوير المهارات والقدرات اللازمة للنجاح المستمر والنمو في هذا المجال مع بناء الخبرة العملية المطلوبة.`
    );
  }
  // Key Concepts / Overview
  else if (typeLower.includes("concept") || typeLower.includes("overview") || typeLower.includes("introduction")) {
    if (category === "technology") {
      bullets.push(
        `موضوع ${topic} يشمل الحلول التقنية الحديثة والابتكارات التكنولوجية المتقدمة التي تساهم في تحسين العمليات.`,
        `المكونات الأساسية تشمل البنية المعمارية والبنية التحتية وطبقات التكامل التي تعمل معاً بشكل متناسق.`,
        `التقنيات الرئيسية تمكن من قابلية التوسع والأمان والأداء العالي مع ضمان الموثوقية والاستمرارية.`,
        `التنفيذ يتطلب الخبرة التقنية والتخطيط الاستراتيجي مع مراعاة أفضل الممارسات والمعايير المعتمدة.`
      );
    } else if (category === "business") {
      bullets.push(
        `موضوع ${topic} ضروري لنجاح المؤسسة ونموها المستمر مع التركيز على خلق القيمة والتميز في الأداء.`,
        `المواءمة الاستراتيجية مع أهداف العمل تدفع خلق القيمة والتحسين المستمر في العمليات والنتائج.`,
        `أصحاب المصلحة والعمليات الرئيسية يجب أن تؤخذ في الاعتبار مع ضمان المشاركة الفعالة والالتزام.`,
        `ديناميكيات السوق والبيئة التنافسية تؤثر على النهج والاستراتيجية المتبعة مع ضرورة التكيف المستمر.`
      );
    } else if (category === "training") {
      bullets.push(
        `تدريب ${topic} يبني المهارات الأساسية والمعرفة اللازمة للنجاح في هذا المجال مع التركيز على التطبيق العملي.`,
        `مسار التعلم المنظم يضمن الفهم الشامل والعميق مع تغطية جميع الجوانب المهمة بشكل متدرج ومنطقي.`,
        `التمارين العملية تعزز المفاهيم النظرية من خلال التطبيق المباشر والخبرة العملية الملموسة.`,
        `التقييم والملاحظات البناءة تدعم التحسين المستمر وضمان تحقيق أهداف التعلم المطلوبة بفعالية.`
      );
    } else {
      bullets.push(
        `موضوع ${topic} يتضمن مكونات واعتبارات متعددة ومترابطة تتطلب فهماً شاملاً ومنهجياً للتعامل معها بفعالية.`,
        `فهم المبادئ الأساسية أمر أساسي للنجاح في هذا المجال مع التركيز على التطبيق العملي والنتائج الملموسة.`,
        `التطبيق العملي يتطلب التخطيط الدقيق والتنفيذ المنظم مع مراعاة جميع الجوانب والاعتبارات المهمة.`,
        `التعلم المستمر والتكيف مع التغييرات أمر ضروري لضمان النجاح المستمر والبقاء في المقدمة.`
      );
    }
  }
  // How It Works (for technical topics)
  else if (typeLower.includes("how") || typeLower.includes("work") || typeLower.includes("mechanism")) {
    bullets.push(
      `يعمل ${topic} من خلال سلسلة من العمليات والخطوات المنظمة التي تبدأ بالمدخلات وتنتهي بالمخرجات المطلوبة.`,
      `الآلية الأساسية تعتمد على ${mainConcept} مع تفاعل المكونات المختلفة بشكل متناسق لتحقيق الهدف المطلوب.`,
      `كل مرحلة من المراحل لها دور محدد وواضح مع ضمان الانتقال السلس والكفاءة في الأداء بين المراحل المختلفة.`,
      `النتيجة النهائية هي ${goalLower.includes("improve") ? "تحسين" : goalLower.includes("increase") ? "زيادة" : "تحقيق"} ${mainConcept} مع ضمان الجودة والموثوقية في كل خطوة.`
    );
  }
  // Examples / Use Cases
  else if (typeLower.includes("example") || typeLower.includes("use case") || typeLower.includes("application")) {
    bullets.push(
      `من الأمثلة العملية على تطبيق ${topic} هو استخدامه في ${category === "technology" ? "الأنظمة التقنية الحديثة" : category === "business" ? "العمليات التجارية" : "البرامج التدريبية"} لتحسين الأداء.`,
      `حالة استخدام أخرى تشمل تطبيق ${mainConcept} في ${audience ? `بيئة ${audience}` : "البيئات المختلفة"} لتحقيق نتائج ملموسة وفعالة.`,
      `يمكن أيضاً استخدام ${topic} في ${goalLower.includes("train") ? "برامج التدريب والتطوير" : goalLower.includes("improve") ? "تحسين العمليات" : "المشاريع المختلفة"} لتحقيق أهداف محددة.`,
      `النتائج المتحققة من هذه التطبيقات العملية تظهر الفوائد الحقيقية والقيمة المضافة التي يمكن تحقيقها بفعالية.`
    );
  }
  // Best Practices
  else if (typeLower.includes("practice") || typeLower.includes("tip") || typeLower.includes("recommendation")) {
    bullets.push(
      `إنشاء إرشادات ومعايير واضحة لـ ${mainConcept} يضمن الاتساق والجودة في التنفيذ والنتائج المحققة.`,
      `المراقبة المنتظمة وعمليات التحسين المستمر تضمن البقاء في المقدمة والتكيف مع التغييرات والتطورات.`,
      `تدريب الفريق ومشاركة المعرفة والمعلومات تخلق بيئة تعاونية فعالة تساهم في النجاح الجماعي.`,
      `توثيق الدروس المستفادة والخبرات المكتسبة يساعد في تحسين الأداء المستقبلي وتجنب الأخطاء السابقة.`
    );
  }
  // Common Pitfalls / Challenges
  else if (typeLower.includes("pitfall") || typeLower.includes("challenge") || typeLower.includes("mistake")) {
    bullets.push(
      `من الأخطاء الشائعة في ${topic} هو عدم التخطيط الكافي والاستعجال في التنفيذ دون دراسة متأنية للعواقب.`,
      `تجاهل الجوانب المهمة مثل ${mainConcept} يمكن أن يؤدي إلى نتائج غير مرغوبة وتحديات إضافية غير متوقعة.`,
      `عدم التواصل الفعال مع ${audience || "أصحاب المصلحة"} يمكن أن يخلق سوء فهم ويعيق تحقيق الأهداف المطلوبة.`,
      `عدم المراقبة والتقييم المستمر يمكن أن يؤدي إلى تفاقم المشاكل وعدم اكتشافها في الوقت المناسب.`
    );
  }
  // Conclusion / Summary
  else if (typeLower.includes("conclusion") || typeLower.includes("summary") || typeLower.includes("next step")) {
    bullets.push(
      `لقد غطينا خلال هذا العرض الجوانب الأساسية والمهمة المتعلقة بموضوع ${topic} مع التركيز على التطبيق العملي.`,
      `النقاط الرئيسية المستفادة تسلط الضوء على أهمية النهج الاستراتيجي والمنهجي في التعامل مع هذا الموضوع.`,
      `الخطوات التالية تشمل التنفيذ والتحسين المستمر مع مراقبة النتائج وضمان تحقيق الأهداف المرجوة بفعالية.`,
      `نشكركم على اهتمامكم ومشاركتكم ونتطلع إلى مناقشة الأسئلة والاستفسارات لضمان الفهم الكامل والاستفادة القصوى.`
    );
  }
  // Generic / Default content
  else {
    const position = index + 1;
    const isEarly = position <= total / 3;
    const isLate = position > (total * 2) / 3;

    if (isEarly) {
      bullets.push(
        `استكشاف الجوانب الأساسية والمهمة المتعلقة بموضوع ${topic} مع التركيز على الفهم العميق والشامل.`,
        `الاعتبارات الرئيسية لتطبيق ${mainConcept} تتطلب فهماً واضحاً للعناصر الأساسية والمتطلبات اللازمة.`,
        `العوامل المهمة التي تؤثر على النجاح تشمل التخطيط الجيد والتنفيذ المنظم والمراقبة المستمرة للنتائج.`,
        `النهج الاستراتيجي يضمن تحقيق أقصى فعالية ممكنة مع ضمان الاستفادة القصوى من الموارد المتاحة.`
      );
    } else if (isLate) {
      bullets.push(
        `بناءً على المفاهيم السابقة نستكشف المواضيع المتقدمة والتطبيقات العملية والأمثلة الواقعية في هذا المجال.`,
        `التطبيقات العملية والأمثلة الحقيقية توضح كيفية استخدام ${mainConcept} في مواقف مختلفة لتحقيق نتائج ملموسة.`,
        `الدروس المستفادة وأفضل الممارسات تساعد في تحسين الأداء وتجنب الأخطاء الشائعة في هذا المجال.`,
        `التحضير للخطوات التالية والتطوير المستقبلي يتطلب التخطيط الاستراتيجي والاستعداد للتغييرات القادمة.`
      );
    } else {
      bullets.push(
        `التعمق في مكونات ${topic} يتطلب تحليلاً دقيقاً وتقييماً شاملاً للخيارات والبدائل المتاحة في هذا المجال.`,
        `التحليل النقدي والتقييم الدقيق للخيارات يساعد في اختيار الحلول الأكثر ملاءمة وفعالية للوضع الحالي.`,
        `التكامل مع الأنظمة والعمليات الموجودة يتطلب التخطيط الدقيق والتنفيذ المنظم لضمان الانتقال السلس.`,
        `استراتيجيات التحسين والتحسين المستمر تساعد في تحقيق نتائج أفضل وتحسين الأداء العام بشكل مستمر.`
      );
    }
  }

  // Ensure at least 4 bullets (Arabic requirement)
  while (bullets.length < 4) {
    bullets.push(`نقطة إضافية مهمة حول ${topic} تتطلب الاهتمام والدراسة المتأنية لضمان الفهم الكامل والاستفادة القصوى.`);
  }
  
  // Limit to 5 bullets max
  if (bullets.length > 5) {
    return bullets.slice(0, 5);
  }

  return bullets;
}

/**
 * Formats slide title based on type and tone
 */
function formatSlideTitle(slideType: string, tone: string, language: string): string {
  if (language === "ar") {
    // Arabic slide titles
    const arabicTitles: Record<string, string> = {
      "Introduction": "مقدمة",
      "Welcome & Overview": "مرحباً ونظرة عامة",
      "Technical Overview": "نظرة عامة تقنية",
      "Problem Statement": "بيان المشكلة",
      "Solution Overview": "نظرة عامة على الحل",
      "Key Benefits": "الفوائد الرئيسية",
      "Benefits & Impact": "الفوائد والتأثير",
      "Implementation Plan": "خطة التنفيذ",
      "Learning Objectives": "أهداف التعلم",
      "Key Concepts": "المفاهيم الرئيسية",
      "Overview": "نظرة عامة",
      "Important Aspects": "الجوانب المهمة",
      "Applications & Use Cases": "التطبيقات وحالات الاستخدام",
      "Best Practices": "أفضل الممارسات",
      "Common Pitfalls": "الأخطاء الشائعة",
      "Conclusion": "الخلاصة",
      "Summary": "ملخص",
      "Next Steps": "الخطوات التالية",
    };
    return arabicTitles[slideType] || slideType;
  }

  if (tone === "friendly") {
    // Make titles more conversational
    const friendlyMap: Record<string, string> = {
      "Problem Statement": "What's the Challenge?",
      "Solution Overview": "Here's Our Approach",
      "Key Benefits": "Why This Matters",
      "Implementation Plan": "How We'll Do It",
      "Learning Objectives": "What You'll Learn",
      "Key Concepts": "The Basics",
      "Best Practices": "Tips for Success",
      "Conclusion": "Wrapping Up",
    };
    return friendlyMap[slideType] || slideType;
  }

  return slideType;
}

/**
 * Formats main presentation title
 */
function formatTitle(topic: string, tone: string, language?: string): string {
  if (language === "ar") {
    // For Arabic, keep the topic as-is (user will type in Arabic)
    return topic;
  }
  
  if (tone === "formal") {
    return topic.charAt(0).toUpperCase() + topic.slice(1);
  } else if (tone === "friendly") {
    return topic;
  } else {
    // Technical: ensure it's clear and precise
    return topic;
  }
}

/**
 * Generates speaker notes for a slide
 */
function generateSpeakerNotes(topic: string, slideType: string, tone: string): string {
  if (tone === "formal") {
    return `Discuss ${slideType} in detail, emphasizing key points and implications for ${topic}.`;
  } else if (tone === "friendly") {
    return `Engage audience with examples and interactive discussion about ${slideType}.`;
  } else {
    return `Provide technical details and specifications related to ${slideType} for ${topic}.`;
  }
}

/**
 * Generates fallback slides if generation fails
 */
function generateFallbackSlides(request: AIPresentationRequest): AIPresentationSlide[] {
  const topic = request.topic.trim() || "Untitled Presentation";
  const slideCount = Math.max(1, Math.min(20, request.slideCount || 6));

  const slides: AIPresentationSlide[] = [
    {
      title: topic,
      bullets: [],
      notes: "Title slide",
      layout: "title-only",
    },
  ];

  if (slideCount > 1) {
    slides.push({
      title: "Introduction",
      bullets: [
        `This presentation covers ${topic}.`,
        `We will explore key aspects and important considerations.`,
        `The goal is to provide valuable insights and information.`,
      ],
      notes: "Introduction slide",
      layout: "title-bullets",
    });
  }

  // Add generic content slides
  for (let i = 2; i < slideCount; i++) {
    slides.push({
      title: `Section ${i - 1}`,
      bullets: [
        `Important point about ${topic}.`,
        `Key consideration for implementation.`,
        `Practical application and benefits.`,
      ],
      notes: `Content slide ${i - 1}`,
      layout: "title-bullets",
    });
  }

  console.warn("[AI Service] Using fallback slides due to generation error");
  return slides;
}

