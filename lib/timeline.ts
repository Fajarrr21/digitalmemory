import "server-only";
import { createClient } from "@/lib/supabase/server";
import { signPaths } from "@/lib/media";
import type { MemoryMedia } from "@/components/memory/memory-card";

export type TimelineMemory = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  media: MemoryMedia[];
};

export type DayEntry = {
  date: string;
  rating: { score: number; mood: string | null } | null;
  letterStatus: "sealed" | "opened" | null;
  memories: TimelineMemory[];
};

export type Timeline = { days: DayEntry[]; hasMore: boolean; total: number };

/** Newest-first journal of the user's days (any day with a rating, activity, or
 *  letter). Candidate dates are cheap to gather; media is fetched only for the
 *  visible page. */
export async function getTimeline(userId: string, take: number): Promise<Timeline> {
  const supabase = await createClient();

  const [{ data: actDates }, { data: ratDates }, { data: letDates }] = await Promise.all([
    supabase.from("daily_activities").select("activity_date").eq("user_id", userId),
    supabase.from("daily_ratings").select("rating_date").eq("user_id", userId),
    supabase.from("daily_letters").select("letter_date").eq("recipient_id", userId),
  ]);

  const dates = new Set<string>();
  actDates?.forEach((r) => dates.add(r.activity_date));
  ratDates?.forEach((r) => dates.add(r.rating_date));
  letDates?.forEach((r) => dates.add(r.letter_date));

  const allDates = Array.from(dates).sort().reverse();
  const pageDates = allDates.slice(0, take);
  if (pageDates.length === 0) return { days: [], hasMore: false, total: 0 };

  const [{ data: ratings }, { data: letters }, { data: activities }] = await Promise.all([
    supabase
      .from("daily_ratings")
      .select("rating_date, score, mood")
      .eq("user_id", userId)
      .in("rating_date", pageDates),
    supabase
      .from("daily_letters")
      .select("letter_date, status")
      .eq("recipient_id", userId)
      .in("letter_date", pageDates),
    supabase
      .from("daily_activities")
      .select("id, title, description, location, activity_date")
      .eq("user_id", userId)
      .in("activity_date", pageDates)
      .order("created_at", { ascending: false }),
  ]);

  const ids = (activities ?? []).map((a) => a.id);
  const { data: media } = ids.length
    ? await supabase
        .from("media")
        .select("id, activity_id, type, storage_path, alt_text")
        .in("activity_id", ids)
    : { data: [] as const };

  const urls = await signPaths((media ?? []).map((m) => m.storage_path));
  const mediaByActivity = new Map<string, MemoryMedia[]>();
  for (const m of media ?? []) {
    if (!m.activity_id) continue;
    const list = mediaByActivity.get(m.activity_id) ?? [];
    list.push({ id: m.id, type: m.type, url: urls[m.storage_path] ?? null, alt: m.alt_text });
    mediaByActivity.set(m.activity_id, list);
  }

  const ratingByDate = new Map((ratings ?? []).map((r) => [r.rating_date, r]));
  const letterByDate = new Map((letters ?? []).map((l) => [l.letter_date, l]));
  const memoriesByDate = new Map<string, TimelineMemory[]>();
  for (const a of activities ?? []) {
    const list = memoriesByDate.get(a.activity_date) ?? [];
    list.push({
      id: a.id,
      title: a.title,
      description: a.description,
      location: a.location,
      media: mediaByActivity.get(a.id) ?? [],
    });
    memoriesByDate.set(a.activity_date, list);
  }

  const days: DayEntry[] = pageDates.map((date) => {
    const r = ratingByDate.get(date);
    const l = letterByDate.get(date);
    return {
      date,
      rating: r ? { score: r.score, mood: r.mood } : null,
      letterStatus: l ? l.status : null,
      memories: memoriesByDate.get(date) ?? [],
    };
  });

  return { days, hasMore: allDates.length > take, total: allDates.length };
}

export type MonthMark = { activityCount: number; score: number | null; hasLetter: boolean };

/** Per-day markers for a calendar month (1-indexed month). */
export async function getMonthMarks(
  userId: string,
  year: number,
  month: number,
): Promise<Map<string, MonthMark>> {
  const supabase = await createClient();
  const mm = String(month).padStart(2, "0");
  const start = `${year}-${mm}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;

  const [{ data: activities }, { data: ratings }, { data: letters }] = await Promise.all([
    supabase
      .from("daily_activities")
      .select("activity_date")
      .eq("user_id", userId)
      .gte("activity_date", start)
      .lte("activity_date", end),
    supabase
      .from("daily_ratings")
      .select("rating_date, score")
      .eq("user_id", userId)
      .gte("rating_date", start)
      .lte("rating_date", end),
    supabase
      .from("daily_letters")
      .select("letter_date")
      .eq("recipient_id", userId)
      .gte("letter_date", start)
      .lte("letter_date", end),
  ]);

  const map = new Map<string, MonthMark>();
  const get = (d: string) => map.get(d) ?? { activityCount: 0, score: null, hasLetter: false };

  for (const a of activities ?? []) {
    const m = get(a.activity_date);
    m.activityCount += 1;
    map.set(a.activity_date, m);
  }
  for (const r of ratings ?? []) {
    const m = get(r.rating_date);
    m.score = r.score;
    map.set(r.rating_date, m);
  }
  for (const l of letters ?? []) {
    const m = get(l.letter_date);
    m.hasLetter = true;
    map.set(l.letter_date, m);
  }
  return map;
}
