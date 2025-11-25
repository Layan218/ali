"use client";

import { useState, useRef } from "react";
import styles from "./ExportPresentation.module.css";

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

type ExportPresentationProps = {
  slides: Slide[];
  scriptSegments: ScriptSegment[];
  presentationId: string;
  onClose: () => void;
};

export default function ExportPresentation({
  slides,
  scriptSegments,
  presentationId,
  onClose,
}: ExportPresentationProps) {
  const [exportType, setExportType] = useState<"video" | "audio-slides" | "interactive">("interactive");
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      if (exportType === "interactive") {
        // For interactive, just save the presentation state
        // This is already handled by the main presentation page
        setExportUrl(`${window.location.origin}/present?presentationId=${presentationId}&autoPlay=true`);
        setExportProgress(100);
      } else if (exportType === "audio-slides") {
        // Generate audio for all segments and create a downloadable package
        await exportAudioSlides();
      } else if (exportType === "video") {
        // Export as video (this would require more complex video generation)
        await exportVideo();
      }
    } catch (error) {
      console.error("Export error:", error);
      alert("Failed to export presentation. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const exportAudioSlides = async () => {
    // This is a simplified version - in production, you'd want to:
    // 1. Generate audio files for each segment using a TTS service
    // 2. Package them with slide images/HTML
    // 3. Create a ZIP file for download

    setExportProgress(30);

    // Create a JSON manifest with slide data and script
    const manifest = {
      presentationId,
      slides: slides.map((slide) => ({
        id: slide.id,
        title: slide.title,
        content: slide.content,
        notes: slide.notes,
      })),
      scriptSegments,
      exportDate: new Date().toISOString(),
    };

    setExportProgress(60);

    // Create downloadable JSON file
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `presentation-${presentationId}-audio-slides.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setExportProgress(100);
    setExportUrl("Downloaded successfully!");
  };

  const exportVideo = async () => {
    // Video export is complex and would typically require:
    // 1. Server-side video generation using FFmpeg or similar
    // 2. Combining slide images with audio tracks
    // 3. Adding transitions and effects

    setExportProgress(20);
    alert(
      "Video export requires server-side processing. This feature will be available in a future update. For now, please use the 'Audio + Slides' export option."
    );
    setExportProgress(100);
  };

  return (
    <div className={styles.exportModal}>
      <div className={styles.exportContent}>
        <div className={styles.exportHeader}>
          <h2>Export AI Presentation</h2>
          <button onClick={onClose} className={styles.closeButton}>
            ×
          </button>
        </div>

        <div className={styles.exportOptions}>
          <label className={styles.exportOption}>
            <input
              type="radio"
              name="exportType"
              value="interactive"
              checked={exportType === "interactive"}
              onChange={(e) => setExportType(e.target.value as typeof exportType)}
            />
            <div className={styles.optionContent}>
              <h3>Interactive Auto-Presentation</h3>
              <p>Keep it online as an interactive auto-presentation that can be shared via URL.</p>
            </div>
          </label>

          <label className={styles.exportOption}>
            <input
              type="radio"
              name="exportType"
              value="audio-slides"
              checked={exportType === "audio-slides"}
              onChange={(e) => setExportType(e.target.value as typeof exportType)}
            />
            <div className={styles.optionContent}>
              <h3>Audio + Slides Package</h3>
              <p>Download a package containing the generated script, slide data, and audio files.</p>
            </div>
          </label>

          <label className={styles.exportOption}>
            <input
              type="radio"
              name="exportType"
              value="video"
              checked={exportType === "video"}
              onChange={(e) => setExportType(e.target.value as typeof exportType)}
            />
            <div className={styles.optionContent}>
              <h3>Video Export</h3>
              <p>Export as a complete video file with synchronized audio and slides. (Coming soon)</p>
            </div>
          </label>
        </div>

        {isExporting && (
          <div className={styles.exportProgress}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${exportProgress}%` }} />
            </div>
            <div className={styles.progressText}>Exporting... {exportProgress}%</div>
          </div>
        )}

        {exportUrl && !isExporting && (
          <div className={styles.exportSuccess}>
            {exportType === "interactive" ? (
              <div>
                <p>Interactive presentation URL:</p>
                <a href={exportUrl} target="_blank" rel="noopener noreferrer" className={styles.exportLink}>
                  {exportUrl}
                </a>
              </div>
            ) : (
              <p>{exportUrl}</p>
            )}
          </div>
        )}

        <div className={styles.exportActions}>
          <button onClick={onClose} className={styles.cancelButton} disabled={isExporting}>
            Cancel
          </button>
          <button onClick={handleExport} className={styles.exportButton} disabled={isExporting}>
            {isExporting ? "Exporting..." : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
}

