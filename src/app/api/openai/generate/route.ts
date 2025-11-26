import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

export interface OpenAIRequest {
  topic: string;
  goal?: string;
  audience?: string;
  tone?: "formal" | "friendly" | "technical";
  language?: "en" | "ar";
  slideCount: number;
}

export interface OpenAISlide {
  title: string;
  bullets: string[];
  notes?: string;
  layout?: "title-only" | "title-bullets" | "title-two-column";
  imagePrompt?: string;
  needsImage?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: OpenAIRequest = await request.json();
    const { topic, goal, audience, tone, language, slideCount } = body;

    // Validate inputs
    if (!topic || !topic.trim()) {
      return NextResponse.json(
        { error: "Topic is required" },
        { status: 400 }
      );
    }

    if (!slideCount || slideCount < 1 || slideCount > 20) {
      return NextResponse.json(
        { error: "Slide count must be between 1 and 20" },
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

    // Build the prompt for OpenAI
    const goalText = goal ? `Goal: ${goal}. ` : "";
    const audienceText = audience ? `Audience: ${audience}. ` : "";
    const toneText = tone ? `Tone: ${tone}. ` : "";
    const languageText = language === "ar" ? "Language: Arabic. " : "Language: English. ";

    const systemPrompt = `You are an expert corporate presentation designer and strategist. Your task is to create a complete, professional, high-quality business presentation that is ready for executive-level audiences.

Return ONLY valid JSON in this exact format:
{
  "slides": [
    {
      "title": "Slide title",
      "bullets": ["detailed bullet 1", "detailed bullet 2", "detailed bullet 3", "detailed bullet 4", "detailed bullet 5", "detailed bullet 6"],
      "notes": "Comprehensive speaker notes",
      "layout": "title-bullets",
      "imagePrompt": "Detailed description of a suitable professional illustration for this slide",
      "needsImage": true
    }
  ],
  "recommendedTheme": "theme-name",
  "presentationStructure": "Brief description of the chosen structure approach"
}

CRITICAL GUIDELINES:

SLIDE STRUCTURE (FIXED FORMAT):
- Slide 1 (Cover): Title slide with ONLY the presentation topic/title. NO subtitle, NO "AI Generated Presentation" text, NO description. Just the title.
- Slide 2 (Introduction): MUST be an introduction slide that provides context, overview, and sets up the presentation. Title should be "Introduction" or similar, with 4-6 detailed bullet points explaining what the presentation will cover.
- Slides 3 to ${slideCount - 1} (Main Content): Dynamically generated based on the topic, goal, and audience. YOU decide the best content structure:
  * Consider the goal (${goal || "inform"}): persuasive presentations need problem-solution structure, training needs step-by-step, reports need data-analysis structure
  * Consider the audience (${audience || "corporate executives"}): executives need high-level strategy, technical teams need details, general audiences need clear explanations
  * Create a logical flow that tells a compelling story
  * Each slide should cover a distinct aspect of the topic
- Slide ${slideCount} (Conclusion): MUST be a conclusion slide that summarizes key points, provides takeaways, and/or includes a call to action. Title should be "Conclusion", "Summary", "Key Takeaways", or similar.
- Generate exactly ${slideCount} slides total

CONTENT QUALITY:
- Each content slide MUST have 4-6 detailed, professional bullet points (not short phrases)
- Bullet points should be comprehensive, corporate-style statements (2-3 sentences each when possible)
- Content must be professional, detailed, and suitable for executive-level presentations
- Use ${tone || "formal"} corporate tone throughout
- ${language === "ar" ? "Write all content in Arabic" : "Write all content in English"}
- Make content highly relevant to ${audience || "corporate executives"}
- Focus on ${goal || "informing"} the audience with actionable insights
- Ensure depth, substance, and professional quality in every slide

IMAGES:
- Slide 1 (cover): MUST have "needsImage": true and a compelling imagePrompt for a professional cover image
- Other slides: Set "needsImage": true when an image would enhance understanding (data slides, process flows, concepts, examples)
- Set "needsImage": false for slides where images aren't necessary (pure text summaries, simple lists)
- Each slide with "needsImage": true MUST include a detailed "imagePrompt" describing a professional, corporate-style visual
- Image prompts should be specific: "Professional infographic showing market growth trends with upward arrow charts and percentage indicators" or "Modern corporate office with diverse team collaborating around a digital whiteboard showing strategy diagrams"
- Image prompts should match the slide content and enhance the message

THEME RECOMMENDATION:
- Analyze the topic and recommend the best theme: "default", "scdt", "digital-solutions", or "aramco-classic"
- Consider: technical topics → "digital-solutions", corporate/formal → "scdt" or "aramco-classic", general → "default"
- Include "recommendedTheme" in your response

OUTPUT REQUIREMENTS:
- Generate exactly ${slideCount} slides
- All slides must have titles, bullets (except cover), notes, layout, imagePrompt, and needsImage fields
- Ensure the presentation is complete, professional, and ready for use`;

    const userPrompt = `Create a complete, professional, executive-level ${slideCount}-slide corporate presentation about: "${topic}"

Context:
${goalText}${audienceText}${toneText}${languageText}

Your Task:
1. Slide 1: Create a title slide with ONLY the topic/title. NO subtitle, NO "AI Generated Presentation", NO description. Just the title.
2. Slide 2: Create an introduction slide titled "Introduction" (or similar) with 4-6 detailed bullet points providing context and overview.
3. Slides 3 to ${slideCount - 1}: Dynamically generate content slides based on the topic, goal, and audience. Analyze what structure would be most effective and create a compelling narrative flow.
4. Slide ${slideCount}: Create a conclusion slide titled "Conclusion", "Summary", or "Key Takeaways" with 4-6 detailed bullet points summarizing key points and/or providing a call to action.
5. RECOMMEND the best theme based on the topic and audience
6. DECIDE which slides need images (cover always needs one, others when they enhance understanding)
7. CREATE detailed image prompts for slides that need images

Requirements:
- Slide 1 (cover): Title only, no subtitle, no "AI Generated Presentation" text. MUST have needsImage: true with a compelling cover image prompt.
- Slide 2 (introduction): Must be an introduction with 4-6 detailed bullet points.
- Slide ${slideCount} (conclusion): Must be a conclusion/summary with 4-6 detailed bullet points.
- Middle slides: Dynamically generated based on topic analysis - create the most effective structure for the goal and audience.
- All content must be professional, detailed, corporate-style, and executive-ready
- Include comprehensive speaker notes for each slide
- Ensure the presentation tells a complete, compelling story

Generate the complete, high-quality presentation now with all required fields.`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 6000, // Increased for longer, more detailed content
      response_format: { type: "json_object" },
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error("No response from OpenAI");
    }

    // Parse the JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseContent);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", parseError);
      console.error("Response content:", responseContent);
      throw new Error("Invalid JSON response from OpenAI");
    }

    // Validate and format the response
    const rawSlides: any[] = parsedResponse.slides || [];
    const recommendedTheme = parsedResponse.recommendedTheme || "default";
    const presentationStructure = parsedResponse.presentationStructure || "";
    
    if (rawSlides.length === 0) {
      throw new Error("No slides generated");
    }

    // Filter out invalid slides - only keep slides with real title and at least one bullet
    const validSlides = rawSlides.filter((slide, index) => {
      const hasTitle = slide.title && typeof slide.title === "string" && slide.title.trim().length > 0;
      const hasBullets = Array.isArray(slide.bullets) && slide.bullets.length > 0 && 
                        slide.bullets.some((bullet: any) => typeof bullet === "string" && bullet.trim().length > 0);
      
      // Cover slide (index 0) only needs title, other slides need both title and bullets
      if (index === 0) {
        return hasTitle;
      }
      return hasTitle && hasBullets;
    });

    if (validSlides.length === 0) {
      throw new Error("No valid slides generated - all slides were missing required data");
    }

    // Limit to requested slide count (don't add placeholders)
    const slides = validSlides.slice(0, slideCount);

    // Format slides with proper validation
    const formattedSlides: OpenAISlide[] = slides.map((slide, index) => {
      let bullets = Array.isArray(slide.bullets) ? slide.bullets.filter((b: any) => typeof b === "string" && b.trim().length > 0) : [];
      const needsImage = slide.needsImage !== undefined ? slide.needsImage : (index === 0 ? true : index < 3);
      
      // For content slides (not cover), ensure we have bullets (but don't pad with placeholders)
      // If bullets are missing, that slide should have been filtered out above
      if (bullets.length > 6) {
        // Limit to 6 bullets max
        bullets = bullets.slice(0, 6);
      }
      
      // Validate title exists (should always be true after filtering)
      const title = slide.title && typeof slide.title === "string" && slide.title.trim().length > 0
        ? slide.title.trim()
        : `Slide ${index + 1}`;
      
      return {
        title: title,
        bullets: bullets,
        notes: slide.notes || "",
        layout: slide.layout || (index === 0 ? "title-only" : "title-bullets"),
        imagePrompt: needsImage ? (slide.imagePrompt || `Professional illustration related to ${title}`) : undefined,
        needsImage: needsImage,
      };
    });

    return NextResponse.json({ 
      slides: formattedSlides,
      recommendedTheme: recommendedTheme,
      presentationStructure: presentationStructure
    });

  } catch (error: any) {
    console.error("OpenAI API error:", error);
    
    // Return user-friendly error messages
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
      { error: error.message || "Failed to generate presentation" },
      { status: 500 }
    );
  }
}

