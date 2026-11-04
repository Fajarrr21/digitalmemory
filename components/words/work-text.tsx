import { cn } from "@/lib/utils";
import type { WorkType } from "@/lib/supabase/database.types";

/**
 * Typography for reading a literary work. Poetry keeps every line break and
 * stanza gap; prose and letters read as paragraphs with room to breathe;
 * a quote sits large and centred. The font is the app's display serif.
 */
export function WorkText({
  text,
  type,
  size = "md",
  className,
}: {
  text: string;
  type: WorkType;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const blocks = text.replace(/\r\n?/g, "\n").trim().split(/\n\s*\n/);
  const base =
    size === "lg" ? "text-[19px] leading-[1.9] md:text-[21px]" : size === "sm" ? "text-[15px] leading-[1.75]" : "text-[17px] leading-[1.85]";

  if (type === "quote") {
    return (
      <div className={cn("font-display italic text-ink text-balance", size === "sm" ? "text-lg" : "text-2xl md:text-[28px]", "leading-snug", className)}>
        {blocks.map((b, i) => (
          <p key={i} className="whitespace-pre-line [&+p]:mt-4">
            {b}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("font-display text-ink", base, className)}>
      {blocks.map((b, i) => (
        <p
          key={i}
          className={cn(
            "whitespace-pre-line [&+p]:mt-[1.1em]",
            type === "poetry" ? "" : "text-pretty",
            type === "letter" && i === 0 ? "" : "",
          )}
        >
          {b}
        </p>
      ))}
    </div>
  );
}
