export type Daypart = "morning" | "afternoon" | "evening" | "night";

export function daypart(hour: number): Daypart {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

/**
 * Time-of-day greeting. `name` is the reader's nickname (optional).
 * Intentionally warm but not saccharine — one small line, never a paragraph.
 */
export function greeting(hour: number, name?: string | null): string {
  const who = name && name.trim().length > 0 ? name.trim() : null;
  switch (daypart(hour)) {
    case "morning":
      return who ? `Good morning, ${who}.` : "Good morning, beautiful.";
    case "afternoon":
      return "How's your day going?";
    case "evening":
      return who ? `How was your day, ${who}?` : "How was your day, love?";
    case "night":
      return "Before you sleep…";
  }
}
