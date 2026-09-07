import "server-only";
import { createClient } from "@/lib/supabase/server";
import { signPaths } from "@/lib/media";

/**
 * Signed URL for a rating's voice note, or null if there is none.
 * RLS applies via the caller's session, so it only resolves for ratings the
 * viewer may see.
 */
export async function getRatingVoiceUrl(ratingId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("media")
    .select("storage_path")
    .eq("rating_id", ratingId)
    .eq("type", "audio")
    .limit(1)
    .maybeSingle();

  if (!data?.storage_path) return null;
  const urls = await signPaths([data.storage_path]);
  return urls[data.storage_path] ?? null;
}
