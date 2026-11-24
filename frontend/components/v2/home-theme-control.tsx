"use client";

import { useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";

export function HomeThemeControl() {
  const { ready, theme, toggleTheme } = useTheme();
  const previousTheme = useRef<string | null>(null);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (!ready) return;
    // Restoring the saved theme is initialization, not a user transition.
    if (previousTheme.current !== null && previousTheme.current !== theme) {
      setRotation((angle) => angle + 360);
    }
    previousTheme.current = theme;
  }, [ready, theme]);

  return (
    <button
      type="button"
      className="v2-theme-toggle home-theme-control"
      onClick={toggleTheme}
      aria-label={ready ? `Switch to ${theme === "light" ? "dark" : "light"} theme` : "Change color theme"}
      title={ready ? `Current theme: ${theme}` : "Change color theme"}
    >
      <span className="home-theme-indicator" aria-hidden="true" style={{ transform: `rotate(${rotation}deg)` }}>
        <Sun className="home-theme-sun" size={20} />
        <Moon className="home-theme-moon" size={20} />
      </span>
    </button>
  );
}
