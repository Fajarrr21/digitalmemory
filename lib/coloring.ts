import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Fills } from "@/components/coloring/coloring-svg";

export type ColoringData = { templateId: string; fills: Fills };

/**
 * The saved coloring for a rating, or null. RLS applies via the caller's
 * session, so it resolves only for ratings the viewer may see (self + partner).
 */
export async function getColoringForRating(ratingId: string): Promise<ColoringData | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_coloring")
    .select("template_id, fills")
    .eq("rating_id", ratingId)
    .maybeSingle();

  if (!data) return null;
  return { templateId: data.template_id, fills: (data.fills ?? {}) as Fills };
}
