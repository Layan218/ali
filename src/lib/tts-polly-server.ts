/**
 * Amazon Polly Server-Side TTS
 * Uses AWS SDK v3 for server-side Polly integration
 */

import { PollyClient, SynthesizeSpeechCommand, VoiceId } from "@aws-sdk/client-polly";
import { Readable } from "stream";

export type VoiceStyle = "calm" | "formal" | "saudi-english-male" | "saudi-english-female" | "casual";

// Amazon Polly Voice IDs - Gulf Arabic voices for natural Saudi/Gulf English accent
const POLLY_VOICES: Record<VoiceStyle, string> = {
  calm: "Joanna", // US English - calm, professional
  formal: "Matthew", // US English - formal, clear
  "saudi-english-male": "Zayd", // Arabic (Gulf) - Male voice speaking English with Gulf accent
  "saudi-english-female": "Hala", // Arabic (Gulf) - Female voice speaking English with Gulf accent
  casual: "Joey", // US English - friendly, casual
};

/**
 * Generate speech using Amazon Polly
 */
export async function generateSpeechPolly(
  text: string,
  voiceStyle: VoiceStyle,
  accessKeyId: string,
  secretAccessKey: string,
  region: string
): Promise<{ audioData: ArrayBuffer; duration: number } | null> {
  try {
    // Clean text - remove pause markers
    const cleanText = text.replace(/\.\.\./g, ",").replace(/\s+/g, " ").trim();
    
    if (!cleanText || cleanText.length === 0) {
      return null;
    }

    const voiceId = POLLY_VOICES[voiceStyle] || POLLY_VOICES.calm;

    // Initialize Polly client
    const pollyClient = new PollyClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    // Synthesize speech
    const command = new SynthesizeSpeechCommand({
      Text: cleanText,
      OutputFormat: "mp3",
      VoiceId: voiceId as VoiceId,
      Engine: "neural", // Use neural engine for best quality
    });

    const response = await pollyClient.send(command);

    if (!response.AudioStream) {
      throw new Error("No audio stream returned from Polly");
    }

    // Convert stream to ArrayBuffer
    // AWS SDK v3 returns AudioStream as a Node.js Readable stream
    const stream = response.AudioStream as Readable;
    const chunks: Buffer[] = [];
    
    // Collect all chunks from the stream
    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      stream.on("end", () => {
        resolve();
      });
      
      stream.on("error", (error) => {
        reject(error);
      });
    });

    // Combine all chunks into a single Buffer, then convert to ArrayBuffer
    const buffer = Buffer.concat(chunks);
    const audioData = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    // Estimate duration (rough calculation: ~150 words per minute)
    const wordCount = cleanText.split(/\s+/).length;
    const duration = Math.max(1, (wordCount / 150) * 60);

    return { audioData, duration };
  } catch (error) {
    console.error("Amazon Polly TTS error:", error);
    throw error;
  }
}

