import * as React from "react";
import { cn } from "@/lib/utils";

/** A warm paper surface. `lift` reserves the soft shadow for things that
 *  should feel picked up off the page (letters, polaroids). */
export function PaperCard({
  className,
  lift = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { lift?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-rule bg-paper p-6",
        lift && "shadow-[var(--shadow-soft)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
