import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

/**
 * Timezone-aware "today". The user's day (and therefore which Daily Letter,
 * rating, and reflection belong to it) is derived from their profile timezone,
 * never the server's UTC offset or the device clock. See PLAN §18, §25.
 */

const FALLBACK_TZ = "Asia/Jakarta";

/** IANA timezone → local calendar date as `YYYY-MM-DD`. */
export function localDateISO(timezone?: string | null, now: Date = new Date()): string {
  const tz = timezone && timezone.length > 0 ? timezone : FALLBACK_TZ;
  const zoned = new TZDate(now.getTime(), tz);
  return format(zoned, "yyyy-MM-dd");
}

/** Hour (0–23) in the user's timezone — used for the time-of-day greeting. */
export function localHour(timezone?: string | null, now: Date = new Date()): number {
  const tz = timezone && timezone.length > 0 ? timezone : FALLBACK_TZ;
  return new TZDate(now.getTime(), tz).getHours();
}

/** Human-friendly date label, e.g. "September 6, 2026". */
export function formatDateLabel(iso: string): string {
  // iso is a plain calendar date; parse as local noon to avoid tz drift.
  const d = new Date(`${iso}T12:00:00`);
  return format(d, "MMMM d, yyyy");
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
