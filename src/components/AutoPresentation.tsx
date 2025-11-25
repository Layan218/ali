"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import ExportPresentation from "./ExportPresentation";
import styles from "./AutoPresentation.module.css";

export type VoiceStyle = "calm" | "formal" | "saudi-english-male" | "saudi-english-female" | "casual";

type Slide = {
  id: string;
  order: number;
  title: string;
  content: string;
  notes: string;
  theme: string;
};

type ScriptSegment = {
  slideIndex: number;
  script: string;
  estimatedDuration: number;
};

type AutoPresentationProps = {
  slides: Slide[];
  onSlideChange: (index: number) => void;
  currentSlideIndex: number;
  presentationId?: string;
  autoStart?: boolean;
};

export default function AutoPresentation({
  slides,
  onSlideChange,
  currentSlideIndex,
  presentationId = "",
  autoStart = false,
}: AutoPresentationProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voiceStyle, setVoiceStyle] = useState<VoiceStyle>("calm");
  const [scriptSegments, setScriptSegments] = useState<ScriptSegment[]>([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPresenter, setShowPresenter] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showExport, setShowExport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scriptError, setScriptError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const segmentTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  // Generate script when component mounts or slides change
  useEffect(() => {
    if (slides.length > 0) {
      setError(null);
      setScriptError(null);
      // Only generate if we have valid slide data
      const hasContent = slides.some(
        (slide) => slide.title?.trim() || slide.content?.trim() || slide.notes?.trim()
      );
      if (hasContent) {
        generateScript();
      } else {
        setScriptError("Slides are empty. Please add content to your slides before generating a script.");
      }
    } else {
      setError("No slides available. Please add slides to your presentation first.");
      setScriptSegments([]);
    }
  }, [slides]);

  // Auto-start if requested (after script is generated)
  useEffect(() => {
    if (autoStart && slides.length > 0 && !isPlaying && !isGenerating && !isPaused) {
      if (scriptSegments.length > 0) {
        // Script already generated, start playing
        const timer = setTimeout(() => {
          setIsPlaying(true);
          setIsPaused(false);
          setCurrentSegmentIndex(0);
          playSegment(0);
        }, 500);
        return () => clearTimeout(timer);
      } else if (!isGenerating) {
        // Need to generate script first
        generateScript().then(() => {
          // Wait for state to update, then start
          setTimeout(() => {
            if (scriptSegments.length > 0 && !scriptError) {
              setIsPlaying(true);
              setIsPaused(false);
              setCurrentSegmentIndex(0);
              playSegment(0);
            }
          }, 300);
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, slides.length, scriptSegments.length, isPlaying, isGenerating, isPaused]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up audio
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.src = "";
          audioRef.current = null;
        } catch (error) {
          console.error("Error cleaning up audio:", error);
        }
      }
      // Clean up timeouts
      segmentTimeoutsRef.current.forEach((timeout) => {
        if (timeout) clearTimeout(timeout);
      });
      segmentTimeoutsRef.current = [];
    };
  }, []);

  const generateScript = async () => {
    if (slides.length === 0) {
      setScriptError("Cannot generate script: No slides available.");
      return;
    }

    setIsGenerating(true);
    setScriptError(null);
    try {
      console.log("Generating script for", slides.length, "slides");
      
      const response = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slides }),
      });

      const responseText = await response.text();
      let data;
      
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Invalid response from server: ${responseText.substring(0, 100)}`);
      }

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status} ${response.statusText}`);
      }
      
      if (!data.success) {
        throw new Error(data.error || "Script generation failed");
      }

      if (!data.segments || data.segments.length === 0) {
        throw new Error("Generated script is empty. Please check your slide content.");
      }

      console.log("Script generated successfully:", data.segments.length, "segments");
      setScriptSegments(data.segments || []);
      setScriptError(null);
      // Clear any previous errors when script generation succeeds
      setError(null);
    } catch (error) {
      console.error("Error generating script:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate script. Please try again.";
      setScriptError(errorMessage);
      setScriptSegments([]);
    } finally {
      setIsGenerating(false);
    }
  };

  const playSegment = useCallback(
    async (segmentIndex: number) => {
      if (segmentIndex >= scriptSegments.length) {
        // Presentation complete
        setIsPlaying(false);
        setCurrentSegmentIndex(0);
        setProgress(0);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
        }
        return;
      }

      const segment = scriptSegments[segmentIndex];
      if (!segment) return;

      // Navigate to the slide for this segment with smooth fade transition
      // This ensures slides are visible even if audio generation fails
      onSlideChange(segment.slideIndex);
      
      // Small delay to ensure slide transition is visible
      await new Promise(resolve => setTimeout(resolve, 100));

      // Calculate progress
      const totalDuration = scriptSegments.reduce((sum, s) => sum + s.estimatedDuration, 0);
      const elapsedDuration = scriptSegments
        .slice(0, segmentIndex)
        .reduce((sum, s) => sum + s.estimatedDuration, 0);
      setProgress((elapsedDuration / totalDuration) * 100);

      // Clean up previous audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }

      // Generate and play audio using premium TTS
      setIsLoadingAudio(true);
      try {
        // Remove SSML tags for API call (we'll handle pauses differently)
        const cleanText = segment.script.replace(/<break[^>]*>/g, " ").replace(/\s+/g, " ").trim();

        const response = await fetch("/api/tts-generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: cleanText, voiceStyle }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to generate audio");
        }

        const data = await response.json();
        if (!data.success || !data.audioData) {
          throw new Error(data.error || "No audio data returned");
        }

        // Log audio length for debugging
        console.log("TTS audio length:", data.audioData.length);
        console.log("TTS provider:", data.provider || "unknown");

        // Convert base64 to blob and create audio URL
        const audioBytes = Uint8Array.from(atob(data.audioData), (c) => c.charCodeAt(0));
        const audioBlob = new Blob([audioBytes], { type: data.audioFormat || "audio/mpeg" });
        const audioUrl = URL.createObjectURL(audioBlob);

        // Create audio element and play
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        // Clean up blob URL when done
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          // When this segment ends, play the next one
          if (isPlaying && !isPaused) {
            playSegment(segmentIndex + 1);
          }
        };

        audio.onerror = (error) => {
          URL.revokeObjectURL(audioUrl);
          console.error("Audio playback error:", error);
          // Continue to next segment on error
          if (isPlaying && !isPaused) {
            playSegment(segmentIndex + 1);
          }
        };

        audio.onloadeddata = () => {
          setIsLoadingAudio(false);
        };

        setCurrentSegmentIndex(segmentIndex);
        await audio.play();
      } catch (error) {
        console.error("TTS generation error:", error);
        setIsLoadingAudio(false);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        setError(`Audio generation failed: ${errorMessage}. Script is still available.`);
        // Continue to next segment on error (slides will still advance)
        if (isPlaying && !isPaused) {
          setTimeout(() => playSegment(segmentIndex + 1), 500);
        }
      }
    },
    [scriptSegments, voiceStyle, isPlaying, isPaused, onSlideChange]
  );

  const handlePlay = async () => {
    if (slides.length === 0) {
      setError("Cannot start presentation: No slides available.");
      return;
    }

    if (scriptSegments.length === 0) {
      if (isGenerating) {
        setError("Please wait for script generation to complete.");
        return;
      }
      
      // Generate script first
      await generateScript();
      
      // Check if generation was successful by checking state after a brief delay
      // (since setState is async)
      setTimeout(() => {
        if (scriptError) {
          // Error already set by generateScript
          return;
        }
        // Try to get the latest segments - if still empty, show error
        if (scriptSegments.length === 0) {
          setScriptError("Script generation completed but no segments were created. Please check your slide content.");
          return;
        }
        // Start playing if we have segments
        setIsPlaying(true);
        setIsPaused(false);
        setCurrentSegmentIndex(0);
        playSegment(0);
      }, 200);
      return;
    }

    if (isPaused) {
      if (audioRef.current) {
        audioRef.current.play().catch(console.error);
      }
      setIsPaused(false);
    } else {
      setIsPlaying(true);
      setIsPaused(false);
      playSegment(currentSegmentIndex);
    }
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPaused(true);
  };

  const handleStop = () => {
    // Stop audio playback
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      } catch (error) {
        console.error("Error stopping audio:", error);
      }
    }
    // Reset state
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentSegmentIndex(0);
    setProgress(0);
    onSlideChange(0);
  };

  const totalDuration = scriptSegments.reduce((sum, s) => sum + s.estimatedDuration, 0);
  const formattedDuration = totalDuration > 0 ? `${Math.floor(totalDuration / 60)}:${String(totalDuration % 60).padStart(2, "0")}` : "0:00";

  return (
    <div className={styles.autoPresentation}>
      <div className={styles.controlsHeader}>
        <h3 className={styles.controlsTitle}>🤖 AI Auto-Presentation</h3>
      </div>

      {(error || scriptError) && (
        <div className={styles.errorMessage}>
          <strong>⚠️ {error ? "Error" : "Script Generation Error"}:</strong> {error || scriptError}
          {error && slides.length === 0 && (
            <div className={styles.errorHint}>
              Make sure your presentation has slides saved. Go back to the editor and save your slides first.
            </div>
          )}
        </div>
      )}

      <div className={styles.controls}>
        {slides.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No slides available for auto-presentation.</p>
            <p className={styles.emptyStateHint}>
              Please ensure your presentation has slides saved in Firebase.
            </p>
          </div>
        ) : (
          <>
            <div className={styles.voiceSelector}>
              <label htmlFor="voice-style">Voice Style:</label>
              <select
                id="voice-style"
                value={voiceStyle}
                onChange={(e) => {
                  setVoiceStyle(e.target.value as VoiceStyle);
                  if (isPlaying) {
                    handleStop();
                  }
                }}
                disabled={isPlaying || isGenerating}
                className={styles.select}
              >
              <option value="calm">Calm & Clear</option>
              <option value="formal">Formal Academic</option>
              <option value="saudi-english-male">Saudi English (Male) ⭐</option>
              <option value="saudi-english-female">Saudi English (Female) ⭐</option>
              <option value="casual">Casual Presentation</option>
              </select>
            </div>

        <div className={styles.presenterToggle}>
          <label>
            <input
              type="checkbox"
              checked={showPresenter}
              onChange={(e) => setShowPresenter(e.target.checked)}
              disabled={isPlaying}
            />
            Show AI Presenter
          </label>
        </div>

        <button
          onClick={() => setShowExport(true)}
          className={styles.exportButton}
          disabled={scriptSegments.length === 0}
        >
          📥 Export Presentation
        </button>

            <div className={styles.playbackControls}>
              {!isPlaying ? (
                <button 
                  onClick={handlePlay} 
                  disabled={isGenerating || slides.length === 0 || !!scriptError} 
                  className={styles.playButton}
                  title={slides.length === 0 ? "No slides available" : scriptError || "Start auto-presentation"}
                >
                  {isGenerating ? "⏳ Generating Script..." : "▶ Start Auto-Presentation"}
                </button>
              ) : (
                <>
                  {isPaused ? (
                    <button onClick={handlePlay} className={styles.playButton}>
                      ▶ Resume
                    </button>
                  ) : (
                    <button onClick={handlePause} className={styles.pauseButton}>
                      ⏸ Pause
                    </button>
                  )}
                  <button onClick={handleStop} className={styles.stopButton}>
                    ⏹ Stop
                  </button>
                </>
              )}
            </div>

            {(isGenerating || isLoadingAudio) && (
              <div className={styles.statusMessage}>
                <span>
                  {isGenerating
                    ? `⏳ Generating script from ${slides.length} slide${slides.length !== 1 ? "s" : ""}...`
                    : "🎙️ Generating high-quality audio..."}
                </span>
              </div>
            )}

            {/* Show script segments even if audio generation fails */}
            {scriptSegments.length > 0 && (
              <div className={styles.statusMessage} style={{ marginTop: "1rem", padding: "0.75rem", background: "rgba(0,0,0,0.05)", borderRadius: "8px" }}>
                <strong>📝 Generated Script ({scriptSegments.length} segments):</strong>
                <div style={{ marginTop: "0.5rem", maxHeight: "200px", overflowY: "auto", fontSize: "0.9rem" }}>
                  {scriptSegments.map((seg, idx) => (
                    <div key={idx} style={{ marginBottom: "0.5rem", padding: "0.5rem", background: "rgba(255,255,255,0.5)", borderRadius: "4px" }}>
                      <strong>Slide {seg.slideIndex + 1}:</strong> {seg.script.substring(0, 150)}{seg.script.length > 150 ? "..." : ""}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isPlaying && (
              <div className={styles.progressContainer}>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                </div>
                <div className={styles.progressText}>
                  Slide {currentSegmentIndex + 1} of {scriptSegments.length} • {formattedDuration}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showPresenter && isPlaying && (
        <div className={styles.presenterContainer}>
          <div className={styles.presenterAvatar}>
            <div className={styles.presenterFace}>
              <div className={styles.presenterEyes}>
                <div className={styles.eye} />
                <div className={styles.eye} />
              </div>
              <div className={styles.presenterMouth} />
            </div>
            <div className={styles.presenterBody} />
          </div>
        </div>
      )}

      {showExport && (
        <ExportPresentation
          slides={slides}
          scriptSegments={scriptSegments}
          presentationId={presentationId}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}

