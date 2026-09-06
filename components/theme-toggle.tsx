"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Mode = "system" | "light" | "dark";

function apply(mode: Mode) {
  const root = document.documentElement;
  if (mode === "system") {
    root.removeAttribute("data-theme");
    try {
      localStorage.removeItem("theme");
    } catch {}
  } else {
    root.setAttribute("data-theme", mode);
    try {
      localStorage.setItem("theme", mode);
    } catch {}
  }
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme");
      if (stored === "light" || stored === "dark") setMode(stored);
    } catch {}
  }, []);

  function cycle() {
    const order: Mode[] = ["system", "light", "dark"];
    const next = order[(order.indexOf(mode) + 1) % order.length];
    setMode(next);
    apply(next);
  }

  const label =
    mode === "system" ? "Auto theme" : mode === "light" ? "Light" : "Dark";

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${label} (tap to change)`}
      aria-label={`Theme: ${label}. Tap to change.`}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-rule text-ink-soft transition hover:text-accent-ink hover:border-accent-ink/40",
      )}
    >
      {mode === "dark" ? (
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z" strokeLinejoin="round" />
        </svg>
      ) : mode === "light" ? (
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" stroke="none" opacity="0.35" />
        </svg>
      )}
    </button>
  );
}
