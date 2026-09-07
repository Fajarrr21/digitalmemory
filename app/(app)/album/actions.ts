"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSpaceContext } from "@/lib/auth";
import { IMAGE_MIME, VIDEO_MIME, MAX_FILES_PER_ACTIVITY } from "@/lib/media-config";

const TitleSchema = z.string().trim().min(1, "Kasih nama albumnya ya.").max(80);

const MediaMetaSchema = z
  .object({
    storage_path: z.string().min(1),
    type: z.enum(["image", "video"]),
    mime: z.string().min(1).max(120),
    size_bytes: z.number().int().nonnegative(),
    width: z.number().int().positive().nullable().optional(),
    height: z.number().int().positive().nullable().optional(),
    duration: z.number().nonnegative().nullable().optional(),
  })
  .refine(
    (m) => (m.type === "image" ? IMAGE_MIME.includes(m.mime) : VIDEO_MIME.includes(m.mime)),
    "mime tidak valid",
  );

export type AlbumResult = { ok?: boolean; error?: string; id?: string };

export async function createAlbum(title: string): Promise<AlbumResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const parsed = TitleSchema.safeParse(title);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Cek lagi ya." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("albums")
    .insert({ space_id: ctx.spaceId, title: parsed.data, created_by: ctx.userId })
    .select("id")
    .single();

  if (error || !data) return { error: "Gagal bikin album. Coba lagi ya. ♡" };
  revalidatePath("/album");
  return { ok: true, id: data.id };
}

export async function renameAlbum(albumId: string, title: string): Promise<AlbumResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const parsed = TitleSchema.safeParse(title);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Cek lagi ya." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("albums")
    .update({ title: parsed.data })
    .eq("id", albumId)
    .eq("space_id", ctx.spaceId);

  if (error) return { error: "Gagal ganti nama. Coba lagi ya." };
  revalidatePath("/album");
  revalidatePath(`/album/${albumId}`);
  return { ok: true };
}

const AddMediaSchema = z.array(MediaMetaSchema).min(1).max(MAX_FILES_PER_ACTIVITY);

export async function addAlbumMedia(
  albumId: string,
  media: z.input<typeof AddMediaSchema>,
): Promise<AlbumResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const parsed = AddMediaSchema.safeParse(media);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Cek lagi isinya." };

  const supabase = await createClient();

  // Album must exist in this space.
  const { data: album } = await supabase
    .from("albums")
    .select("id")
    .eq("id", albumId)
    .eq("space_id", ctx.spaceId)
    .maybeSingle();
  if (!album) return { error: "Album tidak ditemukan." };

  // Defence-in-depth: every object must live under this user's folder.
  const prefix = `${ctx.spaceId}/${ctx.userId}/`;
  if (parsed.data.some((m) => !m.storage_path.startsWith(prefix))) {
    return { error: "Ada berkas yang tidak sah." };
  }

  const { error } = await supabase.from("media").insert(
    parsed.data.map((m) => ({
      space_id: ctx.spaceId,
      owner_id: ctx.userId,
      album_id: albumId,
      type: m.type,
      storage_path: m.storage_path,
      mime: m.mime,
      size_bytes: m.size_bytes,
      width: m.width ?? null,
      height: m.height ?? null,
      duration: m.duration ?? null,
    })),
  );
  if (error) return { error: "Ada media yang gagal disimpan. Coba lagi ya." };

  revalidatePath("/album");
  revalidatePath(`/album/${albumId}`);
  return { ok: true };
}

/** Both members may delete any album item. Storage removal uses the admin
 *  client so a member can remove the partner's file too. */
export async function deleteAlbumMedia(mediaId: string): Promise<{ ok: boolean }> {
  const ctx = await getSpaceContext();
  if (!ctx) return { ok: false };

  const admin = createAdminClient();
  const { data: item } = await admin
    .from("media")
    .select("id, storage_path, space_id, album_id")
    .eq("id", mediaId)
    .maybeSingle();

  // Only album media, and only within the caller's own space.
  if (!item || !item.album_id || item.space_id !== ctx.spaceId) return { ok: false };

  await admin.storage.from("media").remove([item.storage_path]);
  const { error } = await admin.from("media").delete().eq("id", mediaId);
  if (error) return { ok: false };

  revalidatePath("/album");
  if (item.album_id) revalidatePath(`/album/${item.album_id}`);
  return { ok: true };
}

/** Delete an album and every file in it (both members may). */
export async function deleteAlbum(albumId: string): Promise<{ ok: boolean }> {
  const ctx = await getSpaceContext();
  if (!ctx) return { ok: false };

  const admin = createAdminClient();
  const { data: album } = await admin
    .from("albums")
    .select("id, space_id")
    .eq("id", albumId)
    .maybeSingle();
  if (!album || album.space_id !== ctx.spaceId) return { ok: false };

  const { data: media } = await admin
    .from("media")
    .select("storage_path")
    .eq("album_id", albumId);
  const paths = (media ?? []).map((m) => m.storage_path);
  if (paths.length > 0) await admin.storage.from("media").remove(paths);

  // Deleting the album cascades its media rows (FK on delete cascade).
  const { error } = await admin.from("albums").delete().eq("id", albumId);
  if (error) return { ok: false };

  revalidatePath("/album");
  return { ok: true };
}
