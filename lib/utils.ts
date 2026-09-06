/** Tiny className joiner — keeps deps lean; our utility usage is controlled. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
