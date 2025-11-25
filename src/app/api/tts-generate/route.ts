import { NextRequest, NextResponse } from "next/server";
import { generateSpeechPolly, type VoiceStyle as PollyVoiceStyle } from "@/lib/tts-polly-server";
import { generateSpeech, type VoiceStyle as ElevenLabsVoiceStyle, type TTSOptions } from "@/lib/tts-elevenlabs";

/**
 * TTS Generation API Route
 * Supports multiple TTS providers with automatic fallback:
 * 1. Amazon Polly (Gulf Arabic voices for Saudi English)
 * 2. ElevenLabs (premium quality)
 * 3. Google Cloud TTS (fallback)
 * 
 * At least one provider must be configured via environment variables.
 */
export async function POST(request: NextRequest) {
  try {
    const { text, voiceStyle = "calm" } = await request.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    console.log(`[TTS] Generating audio for voice style: ${voiceStyle}, text length: ${text.length}`);

    // Map new voice styles to provider-specific styles
    const mapVoiceStyle = (style: string): { polly: PollyVoiceStyle; elevenlabs: ElevenLabsVoiceStyle } => {
      switch (style) {
        case "saudi-english-male":
          return { polly: "saudi-english-male", elevenlabs: "saudi-english" };
        case "saudi-english-female":
          return { polly: "saudi-english-female", elevenlabs: "saudi-english" };
        case "calm":
          return { polly: "calm", elevenlabs: "calm" };
        case "formal":
          return { polly: "formal", elevenlabs: "formal" };
        case "casual":
          return { polly: "casual", elevenlabs: "casual" };
        default:
          return { polly: "calm", elevenlabs: "calm" };
      }
    };

    const voiceMapping = mapVoiceStyle(voiceStyle);

    // Try providers in order: Amazon Polly -> ElevenLabs -> Google Cloud TTS
    let result: { audioData: ArrayBuffer; duration: number; provider: string } | null = null;
    let lastError: Error | null = null;

    // 1. Try Amazon Polly (best for Saudi/Gulf English accent)
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || "us-east-1";

    if (accessKeyId && secretAccessKey) {
      try {
        console.log("[TTS] Attempting Amazon Polly...");
        const pollyResult = await generateSpeechPolly(
          text,
          voiceMapping.polly,
          accessKeyId,
          secretAccessKey,
          region
        );
        if (pollyResult) {
          result = { ...pollyResult, provider: "amazon-polly" };
          console.log("[TTS] ✓ Amazon Polly succeeded");
        }
      } catch (error) {
        console.warn("[TTS] Amazon Polly failed:", error instanceof Error ? error.message : error);
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    // 2. Try ElevenLabs (premium quality)
    if (!result && process.env.ELEVEN_LABS_API_KEY) {
      try {
        console.log("[TTS] Attempting ElevenLabs...");
        const elevenLabsResult = await generateSpeech(
          text,
          { voiceStyle: voiceMapping.elevenlabs },
          {
            elevenLabs: process.env.ELEVEN_LABS_API_KEY,
            google: process.env.GOOGLE_CLOUD_TTS_API_KEY,
            azure: process.env.AZURE_TTS_KEY && process.env.AZURE_TTS_REGION
              ? { key: process.env.AZURE_TTS_KEY, region: process.env.AZURE_TTS_REGION }
              : undefined,
          }
        );
        if (elevenLabsResult) {
          result = elevenLabsResult;
          console.log(`[TTS] ✓ ${result.provider} succeeded`);
        }
      } catch (error) {
        console.warn("[TTS] ElevenLabs/fallback failed:", error instanceof Error ? error.message : error);
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    // 3. Try Google Cloud TTS directly (if ElevenLabs didn't work)
    if (!result && process.env.GOOGLE_CLOUD_TTS_API_KEY) {
      try {
        console.log("[TTS] Attempting Google Cloud TTS...");
        const googleResult = await generateSpeech(
          text,
          { voiceStyle: voiceMapping.elevenlabs },
          {
            google: process.env.GOOGLE_CLOUD_TTS_API_KEY,
          }
        );
        if (googleResult) {
          result = googleResult;
          console.log(`[TTS] ✓ Google Cloud TTS succeeded`);
        }
      } catch (error) {
        console.warn("[TTS] Google Cloud TTS failed:", error instanceof Error ? error.message : error);
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    // If no provider worked, return error
    if (!result) {
      const missingKeys = [];
      if (!accessKeyId || !secretAccessKey) missingKeys.push("AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY");
      if (!process.env.ELEVEN_LABS_API_KEY) missingKeys.push("ELEVEN_LABS_API_KEY");
      if (!process.env.GOOGLE_CLOUD_TTS_API_KEY) missingKeys.push("GOOGLE_CLOUD_TTS_API_KEY");

      return NextResponse.json(
        {
          success: false,
          error: `No TTS provider available. Please configure at least one: ${missingKeys.join(" OR ")}. Last error: ${lastError?.message || "Unknown error"}`,
          fallback: true,
        },
        { status: 503 }
      );
    }

    // Convert ArrayBuffer to base64 for client-side playback
    const base64Audio = Buffer.from(result.audioData).toString("base64");
    console.log(`[TTS] Audio generated successfully. Length: ${base64Audio.length} chars, Provider: ${result.provider}`);

    return NextResponse.json({
      success: true,
      audioData: base64Audio,
      audioFormat: "audio/mpeg",
      duration: result.duration,
      provider: result.provider,
    });
  } catch (error) {
    console.error("[TTS] Generation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return NextResponse.json(
      {
        success: false,
        error: `Failed to generate speech: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}

