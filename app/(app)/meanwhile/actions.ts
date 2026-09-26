"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSpaceContext } from "@/lib/auth";
import { localDateISO } from "@/lib/date";
import { parseSpotifyTrackId } from "@/lib/spotify";
import type { AwayKind, MeanwhileCategory } from "@/lib/supabase/database.types";
import { PALETTE_VALUES, fillableIds, getTemplate } from "../today/coloring-config";

const AWAY_KINDS = ["working", "playing", "outside", "sleeping", "busy"] as const;

export type AwayState = { ok?: boolean; error?: string };

/**
 * Set / clear the manual "I'm away" flag. kind = "off" turns it off (the row
 * keeps the last kind so "he's back" can be shown for a little while).
 * Deliberately manual-only: no live tracking, no notifications.
 */
export async function setAwayStatus(
  _prev: AwayState,
  formData: FormData,
): Promise<AwayState> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const raw = (formData.get("kind") as string) || "";
  const turningOff = raw === "off";
  if (!turningOff && !AWAY_KINDS.includes(raw as AwayKind)) {
    return { error: "Pilih statusnya dulu ya." };
  }

  const supabase = await createClient();

  if (turningOff) {
    const { error } = await supabase
      .from("away_status")
      .update({ active: false })
      .eq("space_id", ctx.spaceId)
      .eq("user_id", ctx.userId);
    if (error) return { error: "Gagal menyimpan status. Coba lagi ya." };
  } else {
    const { error } = await supabase.from("away_status").upsert(
      {
        space_id: ctx.spaceId,
        user_id: ctx.userId,
        kind: raw as AwayKind,
        active: true,
      },
      { onConflict: "space_id,user_id" },
    );
    if (error) return { error: "Gagal menyimpan status. Coba lagi ya." };
  }

  revalidatePath("/meanwhile");
  revalidatePath("/");
  return { ok: true };
}

// ---- Moments ----------------------------------------------------------------

const MomentSchema = z.object({
  category: z.enum(["question", "pick", "photo", "song", "creation", "silly"]),
  prompt: z.string().trim().min(1).max(300),
  answer: z.string().trim().max(1000).optional(),
  choice: z.string().trim().max(120).optional(),
  emoji: z.string().trim().max(16).optional(),
  rating: z.coerce.number().int().min(1).max(10).optional(),
  link: z.string().trim().max(400).optional(),
  path: z.string().trim().max(400).optional(),
  mime: z.string().trim().max(120).optional(),
  template_id: z.string().trim().max(60).optional(),
  fills: z.string().max(8000).optional(),
});

export type MomentState = { ok?: boolean; error?: string; id?: string };

/** Best-effort Spotify title/cover via oEmbed (no API key), same as letters. */
async function resolveSpotifySong(raw: string) {
  const id = parseSpotifyTrackId(raw);
  if (!id) return null;
  const song = { trackId: id, title: null as string | null, image: null as string | null };
  try {
    const res = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${id}`)}`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (res.ok) {
      const j = (await res.json().catch(() => null)) as {
        title?: string;
        thumbnail_url?: string;
      } | null;
      if (j) {
        song.title = j.title ?? null;
        song.image = j.thumbnail_url ?? null;
      }
    }
  } catch {
    // The embed player still works from the id alone.
  }
  return song;
}

/**
 * Keep a Moment in the archive. Private by default — sharing with the partner
 * is a separate, manual step (shareMoment). Never notifies anyone.
 */
export async function saveMoment(
  _prev: MomentState,
  formData: FormData,
): Promise<MomentState> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };

  const parsed = MomentSchema.safeParse({
    category: formData.get("category"),
    prompt: formData.get("prompt"),
    answer: (formData.get("answer") as string) || undefined,
    choice: (formData.get("choice") as string) || undefined,
    emoji: (formData.get("emoji") as string) || undefined,
    rating: (formData.get("rating") as string) || undefined,
    link: (formData.get("link") as string) || undefined,
    path: (formData.get("path") as string) || undefined,
    mime: (formData.get("mime") as string) || undefined,
    template_id: (formData.get("template_id") as string) || undefined,
    fills: (formData.get("fills") as string) || undefined,
  });
  if (!parsed.success) return { error: "Coba lagi sebentar ya. ♡" };
  const d = parsed.data;

  let payload: Record<string, unknown> = {};

  switch (d.category as MeanwhileCategory) {
    case "question": {
      if (!d.answer) return { error: "Tulis jawabannya dulu ya. ♡" };
      payload = { answer: d.answer };
      break;
    }
    case "pick":
    case "silly": {
      if (!d.choice && d.rating == null) return { error: "Pilih dulu ya." };
      payload = {
        ...(d.choice ? { choice: d.choice } : {}),
        ...(d.emoji ? { emoji: d.emoji } : {}),
        ...(d.rating != null ? { rating: d.rating } : {}),
      };
      break;
    }
    case "photo": {
      const prefix = `${ctx.spaceId}/${ctx.userId}/meanwhile/`;
      if (!d.path || !d.path.startsWith(prefix)) {
        return { error: "Fotonya gagal dibaca. Coba lagi ya." };
      }
      payload = { path: d.path, mime: d.mime || "image/jpeg" };
      break;
    }
    case "song": {
      const song = d.link ? await resolveSpotifySong(d.link) : null;
      if (!song) return { error: "Link Spotify-nya nggak kebaca. Coba salin lagi ya." };
      payload = song;
      break;
    }
    case "creation": {
      const template = d.template_id ? getTemplate(d.template_id) : undefined;
      if (!template) return { error: "Gambarnya nggak dikenali. Coba lagi ya." };
      let fillsRaw: unknown = {};
      try {
        fillsRaw = JSON.parse(d.fills || "{}");
      } catch {
        return { error: "Gambarnya gagal dibaca. Coba lagi ya. ♡" };
      }
      if (typeof fillsRaw !== "object" || fillsRaw === null) fillsRaw = {};
      const allowed = fillableIds(template);
      const fills: Record<string, string> = {};
      for (const [k, v] of Object.entries(fillsRaw as Record<string, unknown>)) {
        if (allowed.has(k) && typeof v === "string" && PALETTE_VALUES.has(v)) fills[k] = v;
      }
      payload = { templateId: template.id, fills };
      break;
    }
  }

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("meanwhile_moments")
    .insert({
      space_id: ctx.spaceId,
      user_id: ctx.userId,
      category: d.category,
      prompt: d.prompt,
      payload,
      moment_date: localDateISO(ctx.profile.timezone),
    })
    .select("id")
    .single();
  if (error || !row) return { error: "Gagal menyimpan momennya. Coba lagi ya. ♡" };

  revalidatePath("/meanwhile");
  revalidatePath("/meanwhile/archive");
  return { ok: true, id: row.id };
}

/** Manually share a kept Moment with the partner. No notification is sent. */
export async function shareMoment(id: string): Promise<MomentState> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };
  if (!z.string().uuid().safeParse(id).success) return { error: "Momennya nggak ketemu." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("meanwhile_moments")
    .update({ shared: true })
    .eq("id", id)
    .eq("user_id", ctx.userId);
  if (error) return { error: "Gagal membagikan. Coba lagi ya." };

  revalidatePath("/meanwhile/archive");
  return { ok: true, id };
}

/** Delete one of your own Moments (and its photo file, if any). */
export async function deleteMoment(id: string): Promise<MomentState> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };
  if (!z.string().uuid().safeParse(id).success) return { error: "Momennya nggak ketemu." };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("meanwhile_moments")
    .select("payload, category")
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (!row) return { error: "Momennya nggak ketemu." };

  const { error } = await supabase
    .from("meanwhile_moments")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.userId);
  if (error) return { error: "Gagal menghapus. Coba lagi ya." };

  if (row.category === "photo") {
    const path = (row.payload as Record<string, unknown>)?.path;
    if (typeof path === "string" && path.startsWith(`${ctx.spaceId}/${ctx.userId}/`)) {
      await supabase.storage.from("media").remove([path]);
    }
  }

  revalidatePath("/meanwhile/archive");
  return { ok: true };
}
