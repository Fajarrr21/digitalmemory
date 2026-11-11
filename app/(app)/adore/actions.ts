"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSpaceContext } from "@/lib/auth";
import { zonedDateTimeToUTC } from "@/lib/date";
import { parseSpotifyTrackId } from "@/lib/spotify";
import { signPaths } from "@/lib/media";
import { pickSurprise } from "@/lib/adore/logic";
import type { AdoreType, WishState } from "@/lib/supabase/database.types";
import { ALL_KINDS, CATEGORIES, MOMENT_TIME, REACTIONS } from "./adore-config";

const ContentSchema = z
  .object({
    id: z.string().uuid().optional(),
    content_type: z.enum(ALL_KINDS as [string, ...string[]]),
    title: z.string().trim().min(1, "Kasih judul dulu ya.").max(160),
    subtitle: z.string().trim().max(200),
    body: z.string().trim().max(20000),
    category: z.string().trim().max(40),
    status: z.enum(["draft", "published", "archived"]),
    publish_date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
    publish_time: z.string().regex(/^(\d{2}:\d{2})?$/),
    song: z.string().trim().max(300),
    in_pool: z.boolean(),
    repeat_allowed: z.boolean(),
    wish_state: z.enum(["", "someday", "planned", "in_progress", "fulfilled"]),
    target_date: z.string().regex(/^(d{4}-d{2}-d{2})?$/),
  })
  .refine((v) => v.body || v.content_type === "thousand", { message: "Isinya masih kosong.", path: ["body"] })
  .refine((v) => !v.song || parseSpotifyTrackId(v.song), { message: "Link Spotify-nya bukan link lagu.", path: ["song"] })
  .refine(
    (v) => !v.category || CATEGORIES[v.content_type as keyof typeof CATEGORIES].some((c) => c.key === v.category),
    { message: "Kategorinya nggak dikenal.", path: ["category"] },
  );

export type SaveState = { ok?: boolean; error?: string; id?: string };

export async function saveAdore(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Masuk lagi ya." };
  if (ctx.role !== "author") return { error: "Studio ini cuma buat penulisnya." };

  const parsed = ContentSchema.safeParse({
    id: formData.get("id") || undefined,
    content_type: formData.get("content_type"),
    title: formData.get("title") ?? "",
    subtitle: formData.get("subtitle") ?? "",
    body: formData.get("body") ?? "",
    category: formData.get("category") ?? "",
    status: formData.get("status"),
    publish_date: formData.get("publish_date") ?? "",
    publish_time: formData.get("publish_time") ?? "",
    song: formData.get("song") ?? "",
    in_pool: formData.get("in_pool") === "on",
    repeat_allowed: formData.get("repeat_allowed") === "on",
    wish_state: formData.get("wish_state") ?? "",
    target_date: formData.get("target_date") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Coba cek lagi ya." };
  const v = parsed.data;

  // Empty date = available as soon as it's published. Date/time are the author's wall clock.
  const publish_at = v.publish_date
    ? zonedDateTimeToUTC(v.publish_date, v.publish_time || MOMENT_TIME[v.category] || "00:00", ctx.profile.timezone)
    : new Date().toISOString();

  const row = {
    content_type: v.content_type as AdoreType,
    title: v.title,
    subtitle: v.subtitle || null,
    body: v.body,
    category: v.category || null,
    status: v.status,
    publish_at,
    song_track_id: v.song ? parseSpotifyTrackId(v.song) : null,
    in_pool: v.in_pool,
    repeat_allowed: v.repeat_allowed,
    // Only A Future With You carries these in the form; other kinds keep what adore_wish set.
    ...(v.content_type === "future_wish"
      ? { wish_state: (v.wish_state || "someday") as WishState, target_date: v.target_date || null }
      : {}),
  };

  // Media: "keep" | "remove" | a fresh path the client just uploaded into OUR adore folder.
  const folder = `${ctx.spaceId}/${ctx.userId}/adore/`;
  const media = (key: string): string | null | undefined => {
    const raw = String(formData.get(key) ?? "keep");
    if (raw === "keep") return undefined;
    if (raw === "remove") return null;
    return raw.startsWith(folder) && !raw.includes("..") ? raw : undefined;
  };
  const photo = media("photo");
  const audio = media("audio");
  const seconds = Number(formData.get("audio_seconds"));
  const mediaRow = {
    ...(photo !== undefined ? { photo_path: photo } : {}),
    ...(audio !== undefined
      ? { audio_path: audio, audio_seconds: audio && seconds >= 1 ? Math.min(300, Math.round(seconds)) : null }
      : {}),
  };

  const supabase = await createClient();
  const { data: old } = v.id
    ? await supabase.from("adore_contents").select("photo_path, audio_path").eq("id", v.id).maybeSingle()
    : { data: null };
  const { data, error } = v.id
    ? await supabase.from("adore_contents").update({ ...row, ...mediaRow }).eq("id", v.id).select("id").single()
    : await supabase
        .from("adore_contents")
        .insert({ ...row, ...mediaRow, space_id: ctx.spaceId, author_id: ctx.userId })
        .select("id")
        .single();
  if (error || !data) return { error: "Gagal menyimpan. Coba lagi ya. ♡" };

  // Replaced / removed files go only after the row no longer points at them.
  const stale = [
    photo !== undefined && old?.photo_path !== photo ? old?.photo_path : null,
    audio !== undefined && old?.audio_path !== audio ? old?.audio_path : null,
  ].filter((x): x is string => !!x);
  if (stale.length) await supabase.storage.from("media").remove(stale);

  revalidatePath("/adore", "layout");
  return { ok: true, id: data.id };
}

/** Undo an upload whose save failed — only inside the author's own adore folder. */
export async function discardAdoreUpload(path: string): Promise<void> {
  const ctx = await getSpaceContext();
  if (!ctx || ctx.role !== "author") return;
  if (!path.startsWith(`${ctx.spaceId}/${ctx.userId}/adore/`) || path.includes("..")) return;
  const supabase = await createClient();
  await supabase.storage.from("media").remove([path]);
}

/** Her reply to one item ('' clears it). */
export async function replyAdore(id: string, text: string): Promise<{ ok: boolean }> {
  if (text.length > 2000) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.rpc("adore_reply", { p_id: id, p_text: text });
  revalidatePath("/adore", "layout");
  return { ok: !error };
}

export async function deleteAdore(id: string): Promise<{ ok: boolean }> {
  const ctx = await getSpaceContext();
  if (!ctx || ctx.role !== "author") return { ok: false };
  const supabase = await createClient();
  const { data: gone } = await supabase.from("adore_contents").delete().eq("id", id).select("photo_path, audio_path");
  const files = (gone ?? []).flatMap((g) => [g.photo_path, g.audio_path]).filter((x): x is string => !!x);
  if (files.length) await supabase.storage.from("media").remove(files);
  const error = gone === null;
  revalidatePath("/adore", "layout");
  return { ok: !error };
}

/** Keeper: open (always), plus optionally favourite / react ('' clears). */
export async function markAdore(
  id: string,
  change: { favorite?: boolean; reaction?: string } = {},
): Promise<{ ok: boolean }> {
  if (change.reaction && !REACTIONS.some((r) => r.key === change.reaction)) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.rpc("adore_mark", {
    p_id: id,
    p_favorite: change.favorite ?? null,
    p_reaction: change.reaction ?? null,
  });
  revalidatePath("/adore", "layout");
  return { ok: !error };
}

export type DrawnSurprise = {
  id: string;
  kind: AdoreType;
  title: string;
  subtitle: string | null;
  body: string;
  song_track_id: string | null;
  photoUrl: string | null;
  audioUrl: string | null;
  audioSeconds: number | null;
};

/**
 * "I need a little love": one item from the pool. The query runs as her, so
 * RLS already removed drafts and anything not yet due. Her draw counts as
 * opening it; the author can try the button without marking anything.
 * null = pool empty → the page shows the warm default.
 */
export async function drawSurprise(lastId: string | null): Promise<DrawnSurprise | null> {
  const ctx = await getSpaceContext();
  if (!ctx) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("adore_contents")
    .select("id, content_type, title, subtitle, body, song_track_id, opened_at, repeat_allowed, photo_path, audio_path, audio_seconds")
    .eq("space_id", ctx.spaceId)
    .eq("in_pool", true)
    .eq("status", "published")
    .lte("publish_at", new Date().toISOString());
  const pick = pickSurprise(data ?? [], lastId);
  if (!pick) return null;
  if (ctx.role === "keeper") await supabase.rpc("adore_mark", { p_id: pick.id, p_favorite: null, p_reaction: null });
  const signed = await signPaths([pick.photo_path ?? "", pick.audio_path ?? ""]);
  revalidatePath("/adore", "layout");
  return {
    photoUrl: pick.photo_path ? (signed[pick.photo_path] ?? null) : null,
    audioUrl: pick.audio_path ? (signed[pick.audio_path] ?? null) : null,
    audioSeconds: pick.audio_seconds,
    id: pick.id,
    kind: pick.content_type,
    title: pick.title,
    subtitle: pick.subtitle,
    body: pick.body,
    song_track_id: pick.song_track_id,
  };
}

/** Either of us moves a wish along / marks a universe fulfilled (+ the story). */
export async function setWish(id: string, state: WishState, note: string): Promise<{ ok: boolean }> {
  if (!["someday", "planned", "in_progress", "fulfilled"].includes(state) || note.length > 2000) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.rpc("adore_wish", { p_id: id, p_state: state, p_note: note.trim() || null });
  revalidatePath("/adore", "layout");
  return { ok: !error };
}

/** Her WhatsApp frequency for My Favorite Notification (0 = off). Only her own profile. */
export async function setAdoreWhatsApp(perDay: number): Promise<{ ok: boolean }> {
  const ctx = await getSpaceContext();
  if (!ctx || ![0, 1, 2, 3].includes(perDay)) return { ok: false };
  const supabase = await createClient();
  const prefs = { ...(ctx.profile.notif_prefs ?? {}), adore_whatsapp_per_day: perDay };
  const { error } = await supabase.from("profiles").update({ notif_prefs: prefs }).eq("id", ctx.userId);
  revalidatePath("/adore", "layout");
  return { ok: !error };
}
