import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

export interface AssistantRequest {
  type: "slide" | "presentation";
  slide?: {
    id: string;
    title: string;
    content: string;
    notes?: string;
    language?: "en" | "ar";
  };
  slides?: Array<{
    id: string;
    title: string;
    content: string;
    notes?: string;
    language?: "en" | "ar";
  }>;
  context?: {
    id: string;
    title: string;
    totalSlides: number;
    language?: "en" | "ar";
    audience?: string;
    goal?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: AssistantRequest = await request.json();
    const { type, slide, slides, context } = body;

    // Validate inputs
    if (!type || (type !== "slide" && type !== "presentation")) {
      return NextResponse.json(
        { error: "Type must be 'slide' or 'presentation'" },
        { status: 400 }
      );
    }

    if (type === "slide" && !slide) {
      return NextResponse.json(
        { error: "Slide data is required for slide analysis" },
        { status: 400 }
      );
    }

    if (type === "presentation" && (!slides || slides.length === 0)) {
      return NextResponse.json(
        { error: "Slides array is required for presentation analysis" },
        { status: 400 }
      );
    }

    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured" },
        { status: 500 }
      );
    }

    const language = slide?.language || context?.language || "en";
    const isArabic = language === "ar";

    if (type === "slide") {
      // Analyze single slide
      const systemPrompt = isArabic
        ? `أنت مساعد ذكي متخصص في تحليل وتحسين شرائح العروض التقديمية. قم بتحليل الشريحة المقدمة وقدم اقتراحات عملية لتحسينها.

قم بإرجاع JSON فقط بهذا التنسيق الدقيق:
{
  "improvedBullets": ["نقطة محسنة 1", "نقطة محسنة 2", "نقطة محسنة 3"],
  "rewrittenParagraph": "فقرة محسنة ومصقولة",
  "speakerNotes": "ملاحظات المتحدث المقترحة",
  "suggestions": ["اقتراح 1", "اقتراح 2"]
}

المتطلبات:
- قدم 3-5 نقاط محسنة (improvedBullets) بناءً على محتوى الشريحة
- أعد كتابة فقرة محسنة (rewrittenParagraph) تجمع النقاط الرئيسية بشكل احترافي
- قدم ملاحظات المتحدث (speakerNotes) التي تساعد في العرض
- قدم 2-4 اقتراحات عملية (suggestions) لتحسين الشريحة
- استخدم لغة عربية احترافية ومناسبة للعروض التقديمية`
        : `You are an expert AI assistant specializing in analyzing and improving presentation slides. Analyze the provided slide and provide practical suggestions for improvement.

Return ONLY valid JSON in this exact format:
{
  "improvedBullets": ["Improved bullet 1", "Improved bullet 2", "Improved bullet 3"],
  "rewrittenParagraph": "Improved and polished paragraph",
  "speakerNotes": "Suggested speaker notes",
  "suggestions": ["Suggestion 1", "Suggestion 2"]
}

Requirements:
- Provide 3-5 improved bullets (improvedBullets) based on the slide content
- Rewrite an improved paragraph (rewrittenParagraph) that professionally summarizes key points
- Provide speaker notes (speakerNotes) that help with presentation
- Provide 2-4 practical suggestions (suggestions) for improving the slide
- Use professional, corporate-style language suitable for presentations`;

      const userPrompt = isArabic
        ? `حلل الشريحة التالية وقدم اقتراحات لتحسينها:

العنوان: ${slide!.title}
المحتوى: ${slide!.content || "لا يوجد محتوى"}
الملاحظات: ${slide!.notes || "لا توجد ملاحظات"}
${context ? `\nالسياق: ${context.title} (${context.totalSlides} شريحة)` : ""}
${context?.audience ? `\nالجمهور: ${context.audience}` : ""}
${context?.goal ? `\nالهدف: ${context.goal}` : ""}

قم بتحليل الشريحة وقدم:
1. نقاط محسنة (3-5 نقاط)
2. فقرة محسنة
3. ملاحظات المتحدث
4. اقتراحات عملية للتحسين`
        : `Analyze the following slide and provide improvement suggestions:

Title: ${slide!.title}
Content: ${slide!.content || "No content"}
Notes: ${slide!.notes || "No notes"}
${context ? `\nContext: ${context.title} (${context.totalSlides} slides)` : ""}
${context?.audience ? `\nAudience: ${context.audience}` : ""}
${context?.goal ? `\nGoal: ${context.goal}` : ""}

Analyze the slide and provide:
1. Improved bullets (3-5 points)
2. Improved paragraph
3. Speaker notes
4. Practical improvement suggestions`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error("No response from OpenAI");
      }

      const parsedResponse = JSON.parse(responseContent);
      return NextResponse.json(parsedResponse);
    } else {
      // Analyze full presentation
      const systemPrompt = isArabic
        ? `أنت مساعد ذكي متخصص في تحليل العروض التقديمية الكاملة. قم بتحليل العرض المقدم وقدم تحليلاً شاملاً.

قم بإرجاع JSON فقط بهذا التنسيق الدقيق:
{
  "summary": "ملخص تنفيذي للعرض",
  "keyPoints": ["نقطة رئيسية 1", "نقطة رئيسية 2"],
  "strengths": ["قوة 1", "قوة 2"],
  "weaknesses": ["ضعف 1", "ضعف 2"],
  "recommendations": ["توصية 1", "توصية 2"],
  "estimatedQualityScore": 75
}

المتطلبات:
- قدم ملخصاً تنفيذياً (summary) للعرض بأكمله
- استخرج 5-8 نقاط رئيسية (keyPoints)
- حدد نقاط القوة (strengths) في العرض
- حدد نقاط الضعف (weaknesses) في العرض
- قدم توصيات عملية (recommendations) للتحسين
- قيّم جودة العرض (estimatedQualityScore) من 0-100
- استخدم لغة عربية احترافية`
        : `You are an expert AI assistant specializing in analyzing complete presentations. Analyze the provided presentation and provide comprehensive feedback.

Return ONLY valid JSON in this exact format:
{
  "summary": "Executive summary of the presentation",
  "keyPoints": ["Key point 1", "Key point 2"],
  "strengths": ["Strength 1", "Strength 2"],
  "weaknesses": ["Weakness 1", "Weakness 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "estimatedQualityScore": 75
}

Requirements:
- Provide an executive summary (summary) of the entire presentation
- Extract 5-8 key points (keyPoints)
- Identify strengths (strengths) in the presentation
- Identify weaknesses (weaknesses) in the presentation
- Provide practical recommendations (recommendations) for improvement
- Rate presentation quality (estimatedQualityScore) from 0-100
- Use professional, corporate-style language`;

      const slidesText = slides!
        .map((s, i) => `Slide ${i + 1}: ${s.title}\nContent: ${s.content || "No content"}\nNotes: ${s.notes || "No notes"}`)
        .join("\n\n");

      const userPrompt = isArabic
        ? `حلل العرض التقديمي التالي:

العنوان: ${context?.title || "Untitled"}
عدد الشرائح: ${slides!.length}
${context?.audience ? `الجمهور: ${context.audience}` : ""}
${context?.goal ? `الهدف: ${context.goal}` : ""}

الشرائح:
${slidesText}

قم بتحليل العرض وقدم:
1. ملخص تنفيذي
2. النقاط الرئيسية (5-8 نقاط)
3. نقاط القوة
4. نقاط الضعف
5. توصيات للتحسين
6. تقييم الجودة (0-100)`
        : `Analyze the following presentation:

Title: ${context?.title || "Untitled"}
Total Slides: ${slides!.length}
${context?.audience ? `Audience: ${context.audience}` : ""}
${context?.goal ? `Goal: ${context.goal}` : ""}

Slides:
${slidesText}

Analyze the presentation and provide:
1. Executive summary
2. Key points (5-8 points)
3. Strengths
4. Weaknesses
5. Improvement recommendations
6. Quality score (0-100)`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 3000,
        response_format: { type: "json_object" },
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error("No response from OpenAI");
      }

      const parsedResponse = JSON.parse(responseContent);
      return NextResponse.json(parsedResponse);
    }
  } catch (error: any) {
    console.error("OpenAI Assistant API error:", error);

    if (error instanceof OpenAI.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          { error: "Invalid OpenAI API key" },
          { status: 401 }
        );
      } else if (error.status === 429) {
        return NextResponse.json(
          { error: "OpenAI API rate limit exceeded. Please try again later." },
          { status: 429 }
        );
      } else if (error.status === 500) {
        return NextResponse.json(
          { error: "OpenAI API server error. Please try again later." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: error.message || "Failed to analyze with AI Assistant" },
      { status: 500 }
    );
  }
}

