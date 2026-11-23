"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      className="v2-theme-toggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
      title={`Use ${theme === "light" ? "dark" : "light"} theme`}
    >
      {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
    </button>
  );
}
