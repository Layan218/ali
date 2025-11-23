"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import styles from "./ThemeToggle.module.css";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Only render after component has mounted on the client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Return a placeholder during SSR to avoid hydration mismatch
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle dark mode"
        className={styles.themeToggle}
        style={{ visibility: "hidden" }}
      >
        <svg className={styles.icon} width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" stroke="currentColor" strokeWidth="1.8"/>
        </svg>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      onClick={toggleTheme}
      className={styles.themeToggle}
    >
      {theme === "dark" ? (
        // Sun icon for Dark Mode (switch to Light)
        <svg className={`${styles.icon} ${styles.iconSpin}`} width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" stroke="currentColor" strokeWidth="1.8"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      ) : (
        // Moon icon for Light Mode (switch to Dark)
        <svg className={`${styles.icon} ${styles.iconSpin}`} width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" stroke="currentColor" strokeWidth="1.8" fill="none"/>
        </svg>
      )}
    </button>
  );
}

