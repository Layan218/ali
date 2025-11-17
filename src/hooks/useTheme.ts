"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "app-theme";

const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") {
    return stored;
  }

  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  return prefersDark ? "dark" : "light";
};

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [hasManualOverride, setHasManualOverride] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) !== null;
  });

  // Only listen to system preference changes if user hasn't manually set a preference
  useEffect(() => {
    if (typeof window === "undefined" || hasManualOverride) return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      if (!hasManualOverride) {
        setTheme(event.matches ? "dark" : "light");
      }
    };

    const modernListener = typeof media.addEventListener === "function";

    if (modernListener) {
      media.addEventListener("change", handleChange);
    } else if (typeof media.addListener === "function") {
      media.addListener(handleChange);
    }

    return () => {
      if (modernListener) {
        media.removeEventListener("change", handleChange);
      } else if (typeof media.removeListener === "function") {
        media.removeListener(handleChange);
      }
    };
  }, [hasManualOverride]);

  // Apply theme to document and persist to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    
    // Remove all theme classes first
    root.classList.remove("light-theme", "dark-theme", "dark");

    // Apply the appropriate theme class
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      // Explicitly ensure dark is removed for light mode
      root.classList.remove("dark");
    }

    // Persist to localStorage
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setHasManualOverride(true);
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return { theme, toggleTheme };
}
