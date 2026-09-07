import "server-only";
import { createClient } from "@/lib/supabase/server";
import { signPaths } from "@/lib/media";

export type AlbumSummary = {
  id: string;
  title: string;
  count: number;
  coverUrl: string | null;
};

export type AlbumItem = {
  id: string;
  type: "image" | "video" | "audio";
  url: string | null;
  ownerId: string;
  mime: string;
};

export type AlbumDetail = {
  id: string;
  title: string;
  items: AlbumItem[];
};

/** All albums in the space, newest first, each with a cover + item count. */
export async function getAlbums(spaceId: string): Promise<AlbumSummary[]> {
  const supabase = await createClient();

  const { data: albums } = await supabase
    .from("albums")
    .select("id, title, created_at")
    .eq("space_id", spaceId)
    .order("created_at", { ascending: false });

  if (!albums || albums.length === 0) return [];

  const ids = albums.map((a) => a.id);
  const { data: media } = await supabase
    .from("media")
    .select("album_id, type, storage_path, created_at")
    .in("album_id", ids)
    .order("created_at", { ascending: false });

  // Per album: count + a cover. Media comes newest-first, so the first item is
  // the cover; upgrade to the newest image if the current cover isn't one yet.
  const counts = new Map<string, number>();
  const covers = new Map<string, string>();
  const coverIsImage = new Map<string, boolean>();
  for (const m of media ?? []) {
    if (!m.album_id) continue;
    counts.set(m.album_id, (counts.get(m.album_id) ?? 0) + 1);
    const haveImage = coverIsImage.get(m.album_id) ?? false;
    if (!covers.has(m.album_id) || (!haveImage && m.type === "image")) {
      covers.set(m.album_id, m.storage_path);
      coverIsImage.set(m.album_id, m.type === "image");
    }
  }

  const signed = await signPaths(Array.from(covers.values()));

  return albums.map((a) => ({
    id: a.id,
    title: a.title,
    count: counts.get(a.id) ?? 0,
    coverUrl: (covers.get(a.id) && signed[covers.get(a.id)!]) || null,
  }));
}

/** One album with its media (oldest first), or null if not found/visible. */
export async function getAlbum(spaceId: string, albumId: string): Promise<AlbumDetail | null> {
  const supabase = await createClient();

  const { data: album } = await supabase
    .from("albums")
    .select("id, title")
    .eq("id", albumId)
    .eq("space_id", spaceId)
    .maybeSingle();

  if (!album) return null;

  const { data: media } = await supabase
    .from("media")
    .select("id, type, storage_path, owner_id, mime, created_at")
    .eq("album_id", albumId)
    .order("created_at", { ascending: true });

  const urls = await signPaths((media ?? []).map((m) => m.storage_path));

  const items: AlbumItem[] = (media ?? []).map((m) => ({
    id: m.id,
    type: m.type,
    url: urls[m.storage_path] ?? null,
    ownerId: m.owner_id,
    mime: m.mime,
  }));

  return { id: album.id, title: album.title, items };
}
