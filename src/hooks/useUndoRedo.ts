/**
 * Custom hook for managing undo/redo functionality for slide editing
 */

import { useCallback, useRef, useState } from "react";
import type { SlideSnapshot, SlideData } from "@/types/editor";

const MAX_STACK_SIZE = 20;
const DEBOUNCE_DELAY_MS = 500;

/**
 * Checks if two snapshots are identical
 */
function isDuplicate(
  newSnapshot: SlideSnapshot,
  lastSnapshot: SlideSnapshot | undefined
): boolean {
  if (!lastSnapshot) return false;
  return (
    newSnapshot.slideId === lastSnapshot.slideId &&
    newSnapshot.titleHtml === lastSnapshot.titleHtml &&
    newSnapshot.subtitleHtml === lastSnapshot.subtitleHtml &&
    newSnapshot.contentHtml === lastSnapshot.contentHtml &&
    newSnapshot.notesText === lastSnapshot.notesText
  );
}

/**
 * Pushes a snapshot to a stack with size limit
 */
function pushToStack(
  stack: SlideSnapshot[],
  newSnapshot: SlideSnapshot
): SlideSnapshot[] {
  const updated = [...stack, newSnapshot];
  if (updated.length > MAX_STACK_SIZE) {
    updated.shift(); // Remove oldest
  }
  return updated;
}

type UseUndoRedoParams = {
  titleRef: React.RefObject<HTMLDivElement | null>;
  subtitleRef: React.RefObject<HTMLDivElement | null>;
  notesRef: React.RefObject<HTMLTextAreaElement | null>;
  selectedSlide: SlideData | undefined;
  selectedSlideId: string;
  setSlides: React.Dispatch<React.SetStateAction<SlideData[]>>;
};

type UseUndoRedoReturn = {
  undo: () => void;
  redo: () => void;
  captureSnapshotDebounced: (slideId: string) => void;
  captureSnapshotImmediate: (slideId: string) => void;
  captureSnapshotOnSlideChange: (previousSlideId: string, slides: SlideData[]) => void;
  canUndo: boolean;
  canRedo: boolean;
};

export function useUndoRedo({
  titleRef,
  subtitleRef,
  notesRef,
  selectedSlide,
  selectedSlideId,
  setSlides,
}: UseUndoRedoParams): UseUndoRedoReturn {
  const [undoStack, setUndoStack] = useState<SlideSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<SlideSnapshot[]>([]);
  const snapshotDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Captures the current state of a slide as a snapshot
   */
  const captureSnapshot = useCallback(
    (slideId: string): SlideSnapshot | null => {
      if (!slideId) return null;

      const titleHtml = titleRef.current?.innerHTML || "";
      const subtitleHtml = subtitleRef.current?.innerHTML || "";
      const contentHtml = selectedSlide?.content || "";
      const notesText = notesRef.current?.value || "";

      return {
        slideId,
        titleHtml,
        subtitleHtml,
        contentHtml,
        notesText,
      };
    },
    [selectedSlide, titleRef, subtitleRef, notesRef]
  );

  /**
   * Applies a snapshot to both React state and DOM
   */
  const applySnapshot = useCallback(
    (snapshot: SlideSnapshot) => {
      // Update React state
      setSlides((prev) =>
        prev.map((slide) =>
          slide.id === snapshot.slideId
            ? {
                ...slide,
                title: snapshot.titleHtml,
                subtitle: snapshot.subtitleHtml,
                content: snapshot.contentHtml,
                notes: snapshot.notesText,
              }
            : slide
        )
      );

      // Update DOM (with fallback to plain text)
      try {
        if (titleRef.current) {
          titleRef.current.innerHTML = snapshot.titleHtml;
        }
        if (subtitleRef.current) {
          subtitleRef.current.innerHTML = snapshot.subtitleHtml;
        }
        if (notesRef.current) {
          notesRef.current.value = snapshot.notesText;
        }
      } catch (error) {
        // Fallback: plain text only
        console.warn("Failed to restore HTML, using plain text fallback:", error);
        if (titleRef.current) {
          titleRef.current.textContent = snapshot.titleHtml.replace(/<[^>]*>/g, "");
        }
        if (subtitleRef.current) {
          subtitleRef.current.textContent = snapshot.subtitleHtml.replace(/<[^>]*>/g, "");
        }
        if (notesRef.current) {
          notesRef.current.value = snapshot.notesText;
        }
      }
    },
    [setSlides, titleRef, subtitleRef, notesRef]
  );

  /**
   * Captures a snapshot with debounce (for typing events)
   */
  const captureSnapshotDebounced = useCallback(
    (slideId: string) => {
      // Clear existing timer
      if (snapshotDebounceTimerRef.current) {
        clearTimeout(snapshotDebounceTimerRef.current);
      }

      // Set new timer
      snapshotDebounceTimerRef.current = setTimeout(() => {
        if (!slideId) return;
        const snapshot = captureSnapshot(slideId);
        if (!snapshot) return;

        setUndoStack((prev) => {
          // Check for duplicates
          if (isDuplicate(snapshot, prev[prev.length - 1])) {
            return prev;
          }
          return pushToStack(prev, snapshot);
        });

        // Clear redo stack when new change is made
        setRedoStack([]);
      }, DEBOUNCE_DELAY_MS);
    },
    [captureSnapshot]
  );

  /**
   * Captures a snapshot immediately (for blur events)
   */
  const captureSnapshotImmediate = useCallback(
    (slideId: string) => {
      // Clear any pending debounced snapshot
      if (snapshotDebounceTimerRef.current) {
        clearTimeout(snapshotDebounceTimerRef.current);
        snapshotDebounceTimerRef.current = null;
      }

      const snapshot = captureSnapshot(slideId);
      if (snapshot) {
        setUndoStack((prev) => {
          if (isDuplicate(snapshot, prev[prev.length - 1])) {
            return prev;
          }
          return pushToStack(prev, snapshot);
        });
        setRedoStack([]);
      }
    },
    [captureSnapshot]
  );

  /**
   * Captures a snapshot when slide changes (for slide switching)
   */
  const captureSnapshotOnSlideChange = useCallback(
    (previousSlideId: string, slides: SlideData[]) => {
      if (!previousSlideId) return;

      // Capture from DOM and state
      const titleHtml = titleRef.current?.innerHTML || "";
      const subtitleHtml = subtitleRef.current?.innerHTML || "";
      const prevSlide = slides.find((s) => s.id === previousSlideId);
      const contentHtml = prevSlide?.content || "";
      const notesText = notesRef.current?.value || "";

      const snapshot: SlideSnapshot = {
        slideId: previousSlideId,
        titleHtml,
        subtitleHtml,
        contentHtml,
        notesText,
      };

      setUndoStack((prev) => {
        const lastSnapshot = prev[prev.length - 1];
        if (isDuplicate(snapshot, lastSnapshot)) {
          return prev; // Duplicate, skip
        }
        return pushToStack(prev, snapshot);
      });
      // Clear redo stack when switching slides
      setRedoStack([]);
    },
    [titleRef, subtitleRef, notesRef]
  );

  /**
   * Undo operation
   */
  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    if (!selectedSlideId) return;

    // Capture current state before undo
    const currentSnapshot = captureSnapshot(selectedSlideId);
    if (currentSnapshot) {
      setRedoStack((prev) => pushToStack(prev, currentSnapshot));
    }

    // Pop from undo stack
    const snapshotToRestore = undoStack[undoStack.length - 1];
    if (!snapshotToRestore || snapshotToRestore.slideId !== selectedSlideId) return;

    // Apply the snapshot
    applySnapshot(snapshotToRestore);

    // Remove from undo stack
    setUndoStack((prev) => prev.slice(0, -1));
  }, [undoStack, selectedSlideId, captureSnapshot, applySnapshot]);

  /**
   * Redo operation
   */
  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    if (!selectedSlideId) return;

    // Capture current state before redo
    const currentSnapshot = captureSnapshot(selectedSlideId);
    if (currentSnapshot) {
      setUndoStack((prev) => pushToStack(prev, currentSnapshot));
    }

    // Pop from redo stack
    const snapshotToRestore = redoStack[redoStack.length - 1];
    if (!snapshotToRestore || snapshotToRestore.slideId !== selectedSlideId) return;

    // Apply the snapshot
    applySnapshot(snapshotToRestore);

    // Remove from redo stack
    setRedoStack((prev) => prev.slice(0, -1));
  }, [redoStack, selectedSlideId, captureSnapshot, applySnapshot]);

  return {
    undo,
    redo,
    captureSnapshotDebounced,
    captureSnapshotImmediate,
    captureSnapshotOnSlideChange,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}

