import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AdoreType, Database } from "@/lib/supabase/database.types";

export type AdoreContent = Database["public"]["Tables"]["adore_contents"]["Row"];
export type AdoreSealed = Database["public"]["Functions"]["adore_sealed"]["Returns"][number];

/**
 * Everything this user may see (RLS decides: author → all, keeper → only
 * published + due). null = migration 0023 not run yet.
 */
export async function getAdore(spaceId: string, kind?: AdoreType): Promise<AdoreContent[] | null> {
  const supabase = await createClient();
  let q = supabase.from("adore_contents").select("*").eq("space_id", spaceId);
  if (kind) q = q.eq("content_type", kind);
  const { data, error } = await q.order("publish_at", { ascending: true });
  return error ? null : data;
}

/** Published-but-not-yet notes: kind + when, never the words. */
export async function getAdoreSealed(spaceId: string): Promise<AdoreSealed[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("adore_sealed", { p_space: spaceId });
  return data ?? [];
}

/** Home card: how many available notes she hasn't opened yet (null = not set up). */
export async function countAdoreUnopened(spaceId: string): Promise<number | null> {
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("adore_contents")
      .select("id", { count: "exact", head: true })
      .eq("space_id", spaceId)
      .eq("status", "published")
      .lte("publish_at", new Date().toISOString())
      .is("opened_at", null);
    return error ? null : (count ?? 0);
  } catch {
    return null;
  }
}

export type AdoreNotice = { id: string; title: string; detail: string | null; href: string; at: string };

/**
 * 🔔 for her: each My Favorite Notification that's due and unopened (the words
 * ARE the notification), plus one quiet line when a new surprise is waiting —
 * never what the surprise says. Empty for the author / before 0025.
 */
export async function getAdoreNotices(spaceId: string, role: "keeper" | "author"): Promise<AdoreNotice[]> {
  if (role !== "keeper") return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("adore_contents")
      .select("id, content_type, body, publish_at")
      .eq("space_id", spaceId)
      .in("content_type", ["notification", "surprise"])
      .eq("status", "published")
      .lte("publish_at", new Date().toISOString())
      .is("opened_at", null)
      .order("publish_at", { ascending: false })
      .limit(10);
    if (error || !data) return [];
    const notes: AdoreNotice[] = data
      .filter((r) => r.content_type === "notification")
      .map((r) => ({ id: `adore-${r.id}`, title: r.body, detail: null, href: "/adore/notes", at: r.publish_at }));
    const surprise = data.find((r) => r.content_type === "surprise");
    if (surprise)
      notes.push({
        id: "adore-surprise",
        title: "Ada sesuatu kecil yang menunggumu.",
        detail: "psst… ♡",
        href: "/adore/surprise",
        at: surprise.publish_at,
      });
    return notes;
  } catch {
    return [];
  }
}
