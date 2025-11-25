/**
 * ElevenLabs TTS Integration
 * High-quality, natural voice synthesis with Saudi/Gulf English accent support
 */

export type VoiceStyle = "calm" | "formal" | "saudi-english" | "casual";

export interface TTSOptions {
  voiceStyle: VoiceStyle;
  stability?: number; // 0-1, default 0.5
  similarityBoost?: number; // 0-1, default 0.75
  style?: number; // 0-1, default 0.5
}

// ElevenLabs Voice IDs for different styles
const VOICE_IDS: Record<VoiceStyle, string> = {
  calm: "pNInz6obpgDQGcFmaJgB", // Adam - calm, professional
  formal: "EXAVITQu4vr4xnSDxMaL", // Bella - formal, clear
  "saudi-english": "21m00Tcm4TlvDq8ikWAM", // Rachel - neutral, works well for Gulf English
  casual: "VR6AewLTigWG4xSOukaG", // Arnold - friendly, casual
};

/**
 * Generate speech using ElevenLabs API
 */
export async function generateSpeechElevenLabs(
  text: string,
  options: TTSOptions,
  apiKey?: string
): Promise<{ audioData: ArrayBuffer; duration: number } | null> {
  const key = apiKey || process.env.ELEVEN_LABS_API_KEY;

  if (!key) {
    console.warn("ElevenLabs API key not configured, falling back to alternative TTS");
    return null;
  }

  try {
    // Clean text - remove pause markers, they're handled by the API
    const cleanText = text.replace(/\.\.\./g, ",").replace(/\s+/g, " ").trim();
    
    const voiceId = VOICE_IDS[options.voiceStyle] || VOICE_IDS.calm;

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": key,
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: options.stability ?? 0.5,
          similarity_boost: options.similarityBoost ?? 0.75,
          style: options.style ?? (options.voiceStyle === "calm" ? 0.3 : options.voiceStyle === "casual" ? 0.7 : 0.5),
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", response.status, errorText);
      return null;
    }

    const audioBlob = await response.blob();
    const arrayBuffer = await audioBlob.arrayBuffer();

    // Estimate duration (rough calculation: ~150 words per minute)
    const wordCount = cleanText.split(/\s+/).length;
    const duration = Math.max(1, (wordCount / 150) * 60);

    // Return as ArrayBuffer for server-side processing
    return { audioData: arrayBuffer, duration };
  } catch (error) {
    console.error("ElevenLabs TTS error:", error);
    return null;
  }
}

/**
 * Generate speech using Google Cloud TTS (fallback)
 */
export async function generateSpeechGoogle(
  text: string,
  options: TTSOptions,
  apiKey?: string
): Promise<{ audioData: ArrayBuffer; duration: number } | null> {
  const key = apiKey || process.env.GOOGLE_CLOUD_TTS_API_KEY;

  if (!key) {
    return null;
  }

  try {
    // Clean text
    const cleanText = text.replace(/\.\.\./g, ",").replace(/\s+/g, " ").trim();

    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: { text: cleanText },
          voice: {
            languageCode: "en-US",
            name: options.voiceStyle === "saudi-english" ? "en-US-Neural2-D" : "en-US-Neural2-F",
            ssmlGender: "FEMALE",
          },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate: options.voiceStyle === "calm" ? 0.9 : 1.0,
            pitch: 1.0,
            volumeGainDb: 0,
          },
        }),
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const audioData = data.audioContent;

    // Convert base64 to blob
    const binaryString = atob(audioData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const wordCount = cleanText.split(/\s+/).length;
    const duration = Math.max(1, (wordCount / 150) * 60);

    return { audioData: bytes.buffer, duration };
  } catch (error) {
    console.error("Google Cloud TTS error:", error);
    return null;
  }
}

/**
 * Generate speech using Azure TTS (fallback)
 */
export async function generateSpeechAzure(
  text: string,
  options: TTSOptions,
  apiKey?: string,
  region?: string
): Promise<{ audioData: ArrayBuffer; duration: number } | null> {
  const key = apiKey || process.env.AZURE_TTS_KEY;
  const reg = region || process.env.AZURE_TTS_REGION;

  if (!key || !reg) {
    return null;
  }

  try {
    // Clean text
    const cleanText = text.replace(/\.\.\./g, ",").replace(/\s+/g, " ").trim();

    // Get access token
    const tokenResponse = await fetch(`https://${reg}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "",
    });

    if (!tokenResponse.ok) {
      return null;
    }

    const token = await tokenResponse.text();

    // Select voice
    const voiceName = options.voiceStyle === "saudi-english" ? "en-SA-ZariyahNeural" : "en-US-JennyNeural";

    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
      <voice name="${voiceName}">
        <prosody rate="${options.voiceStyle === "calm" ? "medium" : "medium"}">
          ${cleanText}
        </prosody>
      </voice>
    </speak>`;

    const ttsResponse = await fetch(`https://${reg}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
      },
      body: ssml,
    });

    if (!ttsResponse.ok) {
      return null;
    }

    const audioBlob = await ttsResponse.blob();
    const arrayBuffer = await audioBlob.arrayBuffer();

    const wordCount = cleanText.split(/\s+/).length;
    const duration = Math.max(1, (wordCount / 150) * 60);

    return { audioData: arrayBuffer, duration };
  } catch (error) {
    console.error("Azure TTS error:", error);
    return null;
  }
}

/**
 * Generate speech with automatic fallback chain
 * Tries ElevenLabs -> Google Cloud -> Azure
 */
export async function generateSpeech(
  text: string,
  options: TTSOptions,
  apiKeys?: {
    elevenLabs?: string;
    google?: string;
    azure?: { key: string; region: string };
  }
): Promise<{ audioData: ArrayBuffer; duration: number; provider: string } | null> {
  // Try ElevenLabs first (best quality)
  const elevenLabsResult = await generateSpeechElevenLabs(text, options, apiKeys?.elevenLabs);
  if (elevenLabsResult) {
    return { ...elevenLabsResult, provider: "elevenlabs" };
  }

  // Fallback to Google Cloud TTS
  const googleResult = await generateSpeechGoogle(text, options, apiKeys?.google);
  if (googleResult) {
    return { ...googleResult, provider: "google" };
  }

  // Fallback to Azure TTS
  const azureResult = apiKeys?.azure
    ? await generateSpeechAzure(text, options, apiKeys.azure.key, apiKeys.azure.region)
    : null;
  if (azureResult) {
    return { ...azureResult, provider: "azure" };
  }

  return null;
}

