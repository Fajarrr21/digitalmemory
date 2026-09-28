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

/** Shift a plain calendar date by whole days. Pure string → string. */
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * A local wall-clock moment (`2026-09-29` + `19:00` in Jakarta) → the absolute
 * instant, as an ISO string. Used to pin task reminders: "remind me at seven"
 * means seven where she is, whatever the server thinks the time is.
 */
export function zonedDateTimeToUTC(
  dateISO: string,
  time: string,
  timezone?: string | null,
): string {
  const tz = timezone && timezone.length > 0 ? timezone : FALLBACK_TZ;
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  // TZDate#toISOString keeps the zone offset; normalise to a plain UTC instant.
  return new Date(new TZDate(y, m - 1, d, hh || 0, mm || 0, 0, tz).getTime()).toISOString();
}

/** "Sep 30" — the compact form used on task cards. */
export function formatShortDate(iso: string): string {
  return format(new Date(`${iso}T12:00:00`), "MMM d");
}

/** "19:00" from a Postgres `time` value (which arrives as "19:00:00"). */
export function trimTime(time: string | null): string | null {
  return time ? time.slice(0, 5) : null;
}

/** An absolute instant rendered in the user's own timezone: "Sep 29 · 19:00". */
export function formatInstant(iso: string, timezone?: string | null): string {
  const tz = timezone && timezone.length > 0 ? timezone : FALLBACK_TZ;
  return format(new TZDate(new Date(iso).getTime(), tz), "MMM d · HH:mm");
}
