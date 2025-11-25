/**
 * Text-to-Speech utilities using Web Speech API
 * Supports multiple voice styles and languages
 */

export type VoiceStyle = "calm" | "formal" | "saudi-male" | "saudi-female" | "casual" | "saudi-english";

export interface TTSOptions {
  voiceStyle: VoiceStyle;
  rate?: number; // 0.1 to 10, default 1
  pitch?: number; // 0 to 2, default 1
  volume?: number; // 0 to 1, default 1
}

/**
 * Get available voices from the browser
 * Note: Voices may not be immediately available, so this may return empty array initially
 */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return [];
  }
  return window.speechSynthesis.getVoices();
}

/**
 * Wait for voices to be loaded (required for some browsers)
 */
export function waitForVoices(callback: () => void, maxWait = 5000): void {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    callback();
    return;
  }

  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    callback();
    return;
  }

  // Voices may load asynchronously
  let attempts = 0;
  const maxAttempts = maxWait / 100;
  const checkInterval = setInterval(() => {
    attempts++;
    const currentVoices = window.speechSynthesis.getVoices();
    if (currentVoices.length > 0 || attempts >= maxAttempts) {
      clearInterval(checkInterval);
      callback();
    }
  }, 100);

  // Also listen for voiceschanged event
  window.speechSynthesis.onvoiceschanged = () => {
    clearInterval(checkInterval);
    callback();
  };
}

/**
 * Find the best voice for the given style
 */
export function findVoiceForStyle(style: VoiceStyle): SpeechSynthesisVoice | null {
  const voices = getAvailableVoices();
  if (voices.length === 0) return null;

  // Voice selection logic based on style
  const stylePatterns: Record<VoiceStyle, string[]> = {
    calm: ["calm", "gentle", "soft", "smooth", "en-US"],
    formal: ["formal", "professional", "business", "english", "en-US"],
    "saudi-male": ["arabic", "ar-SA", "male", "en-US"],
    "saudi-female": ["arabic", "ar-SA", "female", "en-US"],
    "saudi-english": ["english", "en-US", "neutral", "international"],
    casual: ["casual", "friendly", "conversational", "en-US"],
  };

  const patterns = stylePatterns[style];
  const lang = style === "saudi-male" || style === "saudi-female" ? "ar-SA" : "en-US";

  // Try to find a voice matching the style
  for (const pattern of patterns) {
    const voice = voices.find(
      (v) =>
        v.lang.startsWith(lang) &&
        (v.name.toLowerCase().includes(pattern) || v.name.toLowerCase().includes(lang.toLowerCase()))
    );
    if (voice) return voice;
  }

  // Fallback: find any voice in the target language
  const langVoice = voices.find((v) => v.lang.startsWith(lang));
  if (langVoice) return langVoice;

  // Final fallback: use default voice
  return voices[0] || null;
}

/**
 * Get TTS options for a voice style
 */
export function getTTSOptionsForStyle(style: VoiceStyle): Omit<TTSOptions, "voiceStyle"> {
  const styleOptions: Record<VoiceStyle, Omit<TTSOptions, "voiceStyle">> = {
    calm: { rate: 0.85, pitch: 1.0, volume: 1.0 },
    formal: { rate: 0.95, pitch: 1.0, volume: 1.0 },
    "saudi-male": { rate: 0.9, pitch: 0.95, volume: 1.0 },
    "saudi-female": { rate: 0.9, pitch: 1.05, volume: 1.0 },
    "saudi-english": { rate: 0.9, pitch: 1.0, volume: 1.0 },
    casual: { rate: 1.05, pitch: 1.0, volume: 1.0 },
  };

  return styleOptions[style];
}

/**
 * Speak text using Web Speech API with improved voice selection
 */
export function speakText(
  text: string,
  options: TTSOptions,
  onEnd?: () => void,
  onError?: (error: Error) => void
): SpeechSynthesisUtterance | null {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onError?.(new Error("Speech synthesis not supported in this browser"));
    return null;
  }

  // Clean text for better pronunciation
  const cleanText = text
    .replace(/\.\.\./g, ",") // Replace pause markers with commas for natural pauses
    .replace(/\s+/g, " ")
    .trim();

  const utterance = new SpeechSynthesisUtterance(cleanText);
  
  // Try to get voice immediately, or wait for voices to load
  const voices = getAvailableVoices();
  if (voices.length === 0) {
    // Voices not loaded yet, wait for them
    waitForVoices(() => {
      const voice = findVoiceForStyle(options.voiceStyle);
      if (voice) {
        utterance.voice = voice;
      }
      configureUtterance(utterance, options);
      window.speechSynthesis.speak(utterance);
    });
  } else {
    // Voices available, use immediately
    const voice = findVoiceForStyle(options.voiceStyle);
    if (voice) {
      utterance.voice = voice;
    }
    configureUtterance(utterance, options);
    window.speechSynthesis.speak(utterance);
  }

  function configureUtterance(utt: SpeechSynthesisUtterance, opts: TTSOptions) {
    const styleOptions = getTTSOptionsForStyle(opts.voiceStyle);
    utt.rate = opts.rate ?? styleOptions.rate ?? 0.9; // Slightly slower for clarity
    utt.pitch = opts.pitch ?? styleOptions.pitch ?? 1.0;
    utt.volume = opts.volume ?? styleOptions.volume ?? 1.0;

    // Add natural pauses by splitting on commas
    utt.onboundary = (event) => {
      // Natural pause handling
    };

    utt.onend = () => {
      onEnd?.();
    };

    utt.onerror = (event) => {
      onError?.(new Error(`Speech synthesis error: ${event.error}`));
    };
  }

  return utterance;
}

/**
 * Stop all speech
 */
export function stopSpeech(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Pause speech
 */
export function pauseSpeech(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.pause();
  }
}

/**
 * Resume speech
 */
export function resumeSpeech(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.resume();
  }
}

