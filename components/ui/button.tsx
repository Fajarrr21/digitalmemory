import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "soft" | "ghost";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-[#4a2b30] shadow-[var(--shadow-lift)] hover:brightness-[1.03] hover:-translate-y-px",
  soft: "bg-paper text-ink border border-rule hover:border-accent-ink/40 hover:-translate-y-px",
  ghost: "text-ink-soft hover:text-accent-ink hover:bg-blush/30",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-[15px]",
  lg: "h-12 px-7 text-base",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}
