"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "app-theme";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  mounted: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Always start with "light" to avoid hydration mismatch
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  // Initialize theme after mount to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") {
      setTheme(stored);
      // Apply theme immediately
      const root = document.documentElement;
      root.classList.remove("light-theme", "dark-theme", "dark");
      if (stored === "dark") {
        root.classList.add("dark-theme", "dark");
      } else {
        root.classList.add("light-theme");
      }
    } else {
      // Check system preference
      const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
      const initialTheme = prefersDark ? "dark" : "light";
      setTheme(initialTheme);
      const root = document.documentElement;
      root.classList.remove("light-theme", "dark-theme", "dark");
      if (initialTheme === "dark") {
        root.classList.add("dark-theme", "dark");
      } else {
        root.classList.add("light-theme");
      }
    }
  }, []);

  // Listen to system theme changes (only after mount)
  useEffect(() => {
    if (!mounted) return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      // Only update if user hasn't manually set a preference
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setTheme(event.matches ? "dark" : "light");
      }
    };

    const modernListener = typeof media.addEventListener === "function";

    if (modernListener) {
      media.addEventListener("change", handleChange);
    } else {
      // @ts-ignore Support older browsers
      media.addListener(handleChange);
    }

    return () => {
      if (modernListener) {
        media.removeEventListener("change", handleChange);
      } else {
        // @ts-ignore Support older browsers
        media.removeListener(handleChange);
      }
    };
  }, [mounted]);

  // Update DOM and localStorage when theme changes (only after mount)
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    root.classList.remove("light-theme", "dark-theme", "dark");

    if (theme === "dark") {
      root.classList.add("dark-theme", "dark");
    } else {
      root.classList.add("light-theme");
    }

    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, mounted]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

