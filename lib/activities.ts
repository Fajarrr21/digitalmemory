import "server-only";
import { createClient } from "@/lib/supabase/server";
import { signPaths } from "@/lib/media";
import type { MemoryMedia } from "@/components/memory/memory-card";

export type DayMemory = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  activity_date: string;
  media: MemoryMedia[];
};

/** A user's activities for one date, newest first, with signed media URLs. */
export async function getDayActivities(userId: string, date: string): Promise<DayMemory[]> {
  const supabase = await createClient();

  const { data: activities } = await supabase
    .from("daily_activities")
    .select("id, title, description, location, activity_date")
    .eq("user_id", userId)
    .eq("activity_date", date)
    .order("created_at", { ascending: false });

  if (!activities || activities.length === 0) return [];

  const ids = activities.map((a) => a.id);
  const { data: media } = await supabase
    .from("media")
    .select("id, activity_id, type, storage_path, alt_text")
    .in("activity_id", ids);

  const urls = await signPaths((media ?? []).map((m) => m.storage_path));

  const byActivity = new Map<string, MemoryMedia[]>();
  for (const m of media ?? []) {
    if (!m.activity_id) continue;
    const list = byActivity.get(m.activity_id) ?? [];
    list.push({ id: m.id, type: m.type, url: urls[m.storage_path] ?? null, alt: m.alt_text });
    byActivity.set(m.activity_id, list);
  }

  return activities.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    location: a.location,
    activity_date: a.activity_date,
    media: byActivity.get(a.id) ?? [],
  }));
}
