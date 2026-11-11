import type { AdoreStatus } from "@/lib/supabase/database.types";

export type AdoreLike = { status: AdoreStatus; publish_at: string };

/** What the studio shows: a published row with a future publish_at is "scheduled". */
export function effectiveStatus(c: AdoreLike, now: Date = new Date()): AdoreStatus | "scheduled" {
  if (c.status === "published" && new Date(c.publish_at) > now) return "scheduled";
  return c.status;
}

/** Visible to the keeper right now — mirrors the RLS select policy. */
export function isAvailable(c: AdoreLike, now: Date = new Date()): boolean {
  return effectiveStatus(c, now) === "published";
}

/** Reader order: oldest first, so reason 01 is the first one ever opened to her. */
export function readerOrder<T extends AdoreLike & { created_at: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => a.publish_at.localeCompare(b.publish_at) || a.created_at.localeCompare(b.created_at),
  );
}

/** "01", "02" … "100". */
export function noteNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}

/** A random index, never the current one when there's another choice. */
export function randomOther(length: number, current: number, rand: () => number = Math.random): number {
  if (length <= 1) return 0;
  const pick = Math.floor(rand() * (length - 1));
  return pick >= current ? pick + 1 : pick;
}

export type PoolItem = { id: string; opened_at: string | null; repeat_allowed: boolean };

/**
 * One surprise from the pool (already RLS-filtered to what she may read).
 * Unopened first; opened ones only when repeat is allowed; never the one she
 * just saw if there's any other choice. null = nothing to give → warm default.
 */
export function pickSurprise<T extends PoolItem>(
  pool: T[],
  lastId: string | null,
  rand: () => number = Math.random,
): T | null {
  const fresh = pool.filter((p) => !p.opened_at);
  const usable = fresh.length > 0 ? fresh : pool.filter((p) => p.repeat_allowed);
  const choices = usable.length > 1 ? usable.filter((p) => p.id !== lastId) : usable;
  return choices.length ? choices[Math.floor(rand() * choices.length)] : null;
}

export const MILESTONES = [10, 25, 50, 100, 365, 500, 1000];

/** Milestones reached so far, and the next one (null past 1000). */
export function milestoneProgress(count: number): { reached: number[]; next: number | null } {
  return { reached: MILESTONES.filter((m) => count >= m), next: MILESTONES.find((m) => count < m) ?? null };
}

/** "001" for A Thousand Times, You. */
export function thousandNumber(n: number): string {
  return String(n).padStart(3, "0");
}

const DAY_MS = 24 * 3600_000;

/**
 * My Favorite Notification → WhatsApp: only if she opted in (perDay > 0),
 * under her daily cap, and not stale (a note that came due >24h ago while
 * nobody opened the app stays in-app only rather than arriving late).
 */
export function adoreWhatsAppDue(perDay: number, sentToday: number, publishAt: string, now: Date = new Date()): boolean {
  const age = now.getTime() - new Date(publishAt).getTime();
  return perDay > 0 && sentToday < perDay && age >= 0 && age <= DAY_MS;
}

/** profiles.notif_prefs.adore_whatsapp_per_day, clamped; default 0 = off. */
export function adoreWhatsAppPerDay(prefs: Record<string, unknown> | null | undefined): number {
  const n = Number(prefs?.adore_whatsapp_per_day ?? 0);
  return Number.isInteger(n) ? Math.min(3, Math.max(0, n)) : 0;
}
