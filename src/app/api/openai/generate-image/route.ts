import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, topic } = body;

    if (!prompt && !topic) {
      return NextResponse.json(
        { error: "Prompt or topic is required" },
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

    // Create a professional image prompt for the cover slide
    const imagePrompt = prompt || `Professional, modern, corporate presentation cover image for "${topic}". Clean, minimalist design with abstract geometric elements, professional color scheme, suitable for business presentation. High quality, 16:9 aspect ratio, professional photography style.`;

    try {
      // Generate image using DALL-E 3
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: imagePrompt,
        size: "1024x1024", // DALL-E 3 supports 1024x1024, 1792x1024, or 1024x1792
        quality: "standard",
        n: 1,
      });

      const imageUrl = response.data[0]?.url;
      
      if (!imageUrl) {
        throw new Error("No image URL returned from OpenAI");
      }

      return NextResponse.json({ 
        imageUrl,
        prompt: imagePrompt 
      });

    } catch (dalleError: any) {
      console.error("DALL-E API error:", dalleError);
      
      // Fallback to DALL-E 2 if DALL-E 3 fails
      try {
        const response = await openai.images.generate({
          model: "dall-e-2",
          prompt: imagePrompt,
          size: "1024x1024",
          n: 1,
        });

        const imageUrl = response.data[0]?.url;
        
        if (!imageUrl) {
          throw new Error("No image URL returned from OpenAI");
        }

        return NextResponse.json({ 
          imageUrl,
          prompt: imagePrompt 
        });
      } catch (dalle2Error: any) {
        console.error("DALL-E 2 API error:", dalle2Error);
        throw dalle2Error;
      }
    }

  } catch (error: any) {
    console.error("OpenAI Image Generation error:", error);
    
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
      } else if (error.status === 400) {
        return NextResponse.json(
          { error: "Invalid image generation request. The prompt may contain inappropriate content." },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: error.message || "Failed to generate image" },
      { status: 500 }
    );
  }
}

