"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSpaceContext } from "@/lib/auth";
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

const CreateMemorySchema = z.object({
  title: z.string().trim().min(1, "Kasih judul dulu ya.").max(160),
  description: z.string().trim().max(4000).optional(),
  memory_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  is_featured: z.boolean().optional(),
  media: z.array(MediaMetaSchema).max(MAX_FILES_PER_ACTIVITY).default([]),
});

export type CreateMemoryInput = z.input<typeof CreateMemorySchema>;
export type MemoryResult = { ok?: boolean; error?: string; id?: string };

export async function createMemory(input: CreateMemoryInput): Promise<MemoryResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };
  if (ctx.role !== "author") return { error: "Cuma kamu yang bisa menambah kenangan kita." };

  const parsed = CreateMemorySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Coba cek lagi isinya." };
  const data = parsed.data;

  const prefix = `${ctx.spaceId}/${ctx.userId}/`;
  if (data.media.some((m) => !m.storage_path.startsWith(prefix))) {
    return { error: "Ada berkas yang tidak sah." };
  }

  const supabase = await createClient();
  const { data: memory, error } = await supabase
    .from("our_memories")
    .insert({
      space_id: ctx.spaceId,
      created_by: ctx.userId,
      title: data.title,
      description: data.description || null,
      memory_date: data.memory_date ? data.memory_date : null,
      is_featured: data.is_featured ?? false,
    })
    .select("id")
    .single();

  if (error || !memory) return { error: "Gagal menyimpan kenangan. Coba lagi ya. ♡" };

  if (data.media.length > 0) {
    const { error: mErr } = await supabase.from("media").insert(
      data.media.map((m) => ({
        space_id: ctx.spaceId,
        owner_id: ctx.userId,
        memory_id: memory.id,
        type: m.type,
        storage_path: m.storage_path,
        mime: m.mime,
        size_bytes: m.size_bytes,
        width: m.width ?? null,
        height: m.height ?? null,
        duration: m.duration ?? null,
      })),
    );
    if (mErr) return { error: "Kenangannya tersimpan, tapi ada media yang gagal." };
  }

  revalidatePath("/us");
  return { ok: true, id: memory.id };
}

export async function deleteMemory(memoryId: string): Promise<{ ok: boolean }> {
  const ctx = await getSpaceContext();
  if (!ctx || ctx.role !== "author") return { ok: false };

  const supabase = await createClient();
  const { data: media } = await supabase
    .from("media")
    .select("storage_path")
    .eq("memory_id", memoryId);
  const paths = (media ?? []).map((m) => m.storage_path);
  if (paths.length > 0) await supabase.storage.from("media").remove(paths);

  const { error } = await supabase.from("our_memories").delete().eq("id", memoryId);
  if (error) return { ok: false };

  revalidatePath("/us");
  return { ok: true };
}
