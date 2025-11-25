import { NextRequest, NextResponse } from "next/server";

/**
 * Premium TTS API Route
 * Supports Google Cloud TTS, Azure TTS, or ElevenLabs
 * Falls back to instructions for Web Speech API if no API keys configured
 */

export async function POST(request: NextRequest) {
  try {
    const { text, voiceStyle = "calm", language = "en-US" } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    // Check for premium TTS API keys
    const googleApiKey = process.env.GOOGLE_CLOUD_TTS_API_KEY;
    const azureKey = process.env.AZURE_TTS_KEY;
    const azureRegion = process.env.AZURE_TTS_REGION;
    const elevenLabsKey = process.env.ELEVEN_LABS_API_KEY;

    // Try Google Cloud TTS first (best quality, supports Saudi English accent)
    if (googleApiKey) {
      try {
        const response = await fetch(
          `https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleApiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              input: { text },
              voice: {
                languageCode: "en-US",
                name: voiceStyle === "saudi-male" || voiceStyle === "saudi-female" 
                  ? "en-US-Neural2-D" // Neutral voice that works well for Gulf English
                  : voiceStyle === "formal"
                  ? "en-US-Neural2-J" // Professional voice
                  : "en-US-Neural2-F", // Natural, friendly voice
                ssmlGender: voiceStyle === "saudi-female" ? "FEMALE" : "MALE",
              },
              audioConfig: {
                audioEncoding: "MP3",
                speakingRate: voiceStyle === "calm" ? 0.9 : voiceStyle === "casual" ? 1.1 : 1.0,
                pitch: voiceStyle === "saudi-female" ? 1.1 : voiceStyle === "saudi-male" ? 0.9 : 1.0,
                volumeGainDb: 0,
              },
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json({
            success: true,
            audioData: data.audioContent,
            format: "mp3",
            provider: "google-cloud",
          });
        }
      } catch (error) {
        console.error("Google Cloud TTS error:", error);
      }
    }

    // Try Azure TTS (good quality, supports various accents)
    if (azureKey && azureRegion) {
      try {
        const tokenResponse = await fetch(
          `https://${azureRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
          {
            method: "POST",
            headers: {
              "Ocp-Apim-Subscription-Key": azureKey,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: "",
          }
        );

        if (tokenResponse.ok) {
          const token = await tokenResponse.text();
          
          // Select voice based on style
          const voiceName = voiceStyle === "saudi-male" || voiceStyle === "saudi-female"
            ? "en-SA-ZariyahNeural" // Saudi English voice
            : voiceStyle === "formal"
            ? "en-US-AriaNeural"
            : "en-US-JennyNeural";

          const ssml = `
            <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
              <voice name="${voiceName}">
                <prosody rate="${voiceStyle === "calm" ? "medium" : voiceStyle === "casual" ? "fast" : "medium"}">
                  ${text}
                </prosody>
              </voice>
            </speak>
          `;

          const ttsResponse = await fetch(
            `https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/ssml+xml",
                "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
              },
              body: ssml,
            }
          );

          if (ttsResponse.ok) {
            const audioBuffer = await ttsResponse.arrayBuffer();
            const base64Audio = Buffer.from(audioBuffer).toString("base64");
            
            return NextResponse.json({
              success: true,
              audioData: base64Audio,
              format: "mp3",
              provider: "azure",
            });
          }
        }
      } catch (error) {
        console.error("Azure TTS error:", error);
      }
    }

    // Try ElevenLabs (premium quality, very natural)
    if (elevenLabsKey) {
      try {
        // Select voice ID based on style
        const voiceId = voiceStyle === "saudi-male" || voiceStyle === "saudi-female"
          ? "21m00Tcm4TlvDq8ikWAM" // Neutral voice
          : "pNInz6obpgDQGcFmaJgB"; // Default voice

        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: "POST",
          headers: {
            Accept: "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": elevenLabsKey,
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: voiceStyle === "calm" ? 0.3 : voiceStyle === "casual" ? 0.7 : 0.5,
              use_speaker_boost: true,
            },
          }),
        });

        if (response.ok) {
          const audioBuffer = await response.arrayBuffer();
          const base64Audio = Buffer.from(audioBuffer).toString("base64");
          
          return NextResponse.json({
            success: true,
            audioData: base64Audio,
            format: "mp3",
            provider: "elevenlabs",
          });
        }
      } catch (error) {
        console.error("ElevenLabs TTS error:", error);
      }
    }

    // Fallback: Return instructions for Web Speech API
    return NextResponse.json({
      success: false,
      fallback: true,
      message: "No premium TTS API keys configured. Using browser Web Speech API.",
      instructions: {
        useWebSpeechAPI: true,
        voiceStyle,
        text,
      },
    });
  } catch (error) {
    console.error("TTS API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate speech" },
      { status: 500 }
    );
  }
}

