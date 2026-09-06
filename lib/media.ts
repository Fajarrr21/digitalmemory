import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Mint short-lived signed URLs for private-bucket objects, keyed by path.
 * Media is never public — every view goes through a signed URL.
 */
export async function signPaths(
  paths: string[],
  expiresIn = 3600,
): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths)).filter(Boolean);
  if (unique.length === 0) return {};

  const supabase = await createClient();
  const { data } = await supabase.storage.from("media").createSignedUrls(unique, expiresIn);

  const map: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
  }
  return map;
}
