"use client";

import { cn } from "@/lib/utils";

/**
 * A radio choice that looks like a soft card. A real <input type="radio">
 * underneath, so arrow keys, focus rings and screen readers all just work.
 */
export function Choice({
  name,
  value,
  checked,
  onChange,
  title,
  line,
  leading,
  aside,
  disabled = false,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  title: React.ReactNode;
  line?: React.ReactNode;
  leading?: React.ReactNode;
  aside?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink",
        checked
          ? "border-accent bg-blush/45"
          : "border-rule bg-paper hover:border-accent-ink/40",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      {leading ? (
        <span aria-hidden className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-paper-2 text-lg text-accent-ink">
          {leading}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-ink">{title}</span>
        {line ? <span className="mt-0.5 block text-sm text-ink-soft">{line}</span> : null}
      </span>
      {aside}
      <span
        aria-hidden
        className={cn(
          "h-4 w-4 flex-none rounded-full border transition",
          checked ? "border-accent-ink bg-accent-ink shadow-[inset_0_0_0_3px_var(--paper)]" : "border-rule",
        )}
      />
    </label>
  );
}
