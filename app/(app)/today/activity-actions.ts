"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSpaceContext } from "@/lib/auth";
import { localDateISO } from "@/lib/date";
import { IMAGE_MIME, VIDEO_MIME, MAX_FILES_PER_ACTIVITY } from "@/lib/media-config";

const MediaMetaSchema = z.object({
  storage_path: z.string().min(1),
  type: z.enum(["image", "video"]),
  mime: z.string().refine((m) => [...IMAGE_MIME, ...VIDEO_MIME].includes(m), "mime tidak valid"),
  size_bytes: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  duration: z.number().nonnegative().nullable().optional(),
});

const CreateActivitySchema = z.object({
  title: z.string().trim().min(1, "Kasih judul dulu ya.").max(120),
  description: z.string().trim().max(4000).optional(),
  activity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  location: z.string().trim().max(160).optional(),
  media: z.array(MediaMetaSchema).max(MAX_FILES_PER_ACTIVITY).default([]),
});

export type CreateActivityInput = z.input<typeof CreateActivitySchema>;
export type ActivityResult = { ok?: boolean; error?: string; id?: string };

export async function createActivity(input: CreateActivityInput): Promise<ActivityResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const parsed = CreateActivitySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Coba cek lagi isinya." };
  const data = parsed.data;

  // Defence-in-depth: every uploaded object must live under this user's folder.
  const prefix = `${ctx.spaceId}/${ctx.userId}/`;
  if (data.media.some((m) => !m.storage_path.startsWith(prefix))) {
    return { error: "Ada berkas yang tidak sah." };
  }

  const supabase = await createClient();
  const { data: activity, error } = await supabase
    .from("daily_activities")
    .insert({
      space_id: ctx.spaceId,
      user_id: ctx.userId,
      activity_date: data.activity_date ?? localDateISO(ctx.profile.timezone),
      title: data.title,
      description: data.description || null,
      location: data.location || null,
    })
    .select("id")
    .single();

  if (error || !activity) return { error: "Gagal menyimpan momen. Coba lagi ya. ♡" };

  if (data.media.length > 0) {
    const { error: mErr } = await supabase.from("media").insert(
      data.media.map((m) => ({
        space_id: ctx.spaceId,
        owner_id: ctx.userId,
        activity_id: activity.id,
        type: m.type,
        storage_path: m.storage_path,
        mime: m.mime,
        size_bytes: m.size_bytes,
        width: m.width ?? null,
        height: m.height ?? null,
        duration: m.duration ?? null,
      })),
    );
    if (mErr) return { error: "Momennya tersimpan, tapi ada media yang gagal. Coba tambah lagi ya." };
  }

  revalidatePath("/today");
  revalidatePath("/");
  return { ok: true, id: activity.id };
}

export async function deleteActivity(activityId: string): Promise<{ ok: boolean }> {
  const ctx = await getSpaceContext();
  if (!ctx) return { ok: false };

  const supabase = await createClient();

  // Storage isn't cascade-deleted with the DB, so remove objects first.
  const { data: media } = await supabase
    .from("media")
    .select("storage_path")
    .eq("activity_id", activityId);
  const paths = (media ?? []).map((m) => m.storage_path);
  if (paths.length > 0) {
    await supabase.storage.from("media").remove(paths);
  }

  // Deleting the activity cascades its media rows (FK on delete cascade).
  const { error } = await supabase.from("daily_activities").delete().eq("id", activityId);
  if (error) return { ok: false };

  revalidatePath("/today");
  revalidatePath("/");
  return { ok: true };
}
