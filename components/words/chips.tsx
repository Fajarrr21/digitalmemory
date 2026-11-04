"use client";

import { cn } from "@/lib/utils";
import type { Option } from "@/lib/words/options";

/** A row of soft pill choices — single (radio) or multi (checkbox). */
export function Chips<K extends string>({
  options,
  value,
  onChange,
  multiple = false,
  allowNone = false,
  size = "md",
  label,
  showHints = false,
}: {
  options: Option<K>[];
  value: K | K[] | null;
  onChange: (next: K | K[] | null) => void;
  multiple?: boolean;
  /** Single mode: tapping the active chip again clears it. */
  allowNone?: boolean;
  size?: "sm" | "md";
  label?: string;
  showHints?: boolean;
}) {
  const selected = (k: K) => (Array.isArray(value) ? value.includes(k) : value === k);
  return (
    <div role={multiple ? "group" : "radiogroup"} aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected(o.key);
        return (
          <button
            key={o.key}
            type="button"
            role={multiple ? "checkbox" : "radio"}
            aria-checked={on}
            onClick={() => {
              if (multiple) {
                const arr = Array.isArray(value) ? value : [];
                onChange(on ? arr.filter((x) => x !== o.key) : [...arr, o.key]);
              } else {
                onChange(on && allowNone ? null : o.key);
              }
            }}
            className={cn(
              "rounded-full border text-left transition active:scale-[0.98]",
              size === "sm" ? "px-3 py-1 text-[13px]" : "px-3.5 py-1.5 text-sm",
              on
                ? "border-accent-ink/50 bg-blush/60 text-ink shadow-[var(--shadow-lift)]"
                : "border-rule bg-paper text-ink-soft hover:border-accent-ink/30 hover:text-ink",
            )}
          >
            {o.label}
            {showHints && o.hint ? <span className="ml-1.5 text-[11px] text-ink-faint">{o.hint}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** A labelled field block, used across The Muse / The Rewrite / send. */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">{label}</p>
        {hint ? <p className="text-xs text-ink-faint">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border border-rule bg-ground/60 px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint focus:border-accent-ink/50 focus:outline-none";
