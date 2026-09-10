"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSpaceContext, getPartner } from "@/lib/auth";
import { notifyDirectLetter } from "@/lib/notify/letter";
import { parseSpotifyTrackId } from "@/lib/spotify";
import { LETTER_CATEGORIES } from "./categories";

/** Mark today's letter as opened. RLS ensures only the recipient can. */
export async function openLetter(letterId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("daily_letters")
    .update({ status: "opened", opened_at: new Date().toISOString() })
    .eq("id", letterId)
    .eq("status", "sealed");

  if (error) return { ok: false };
  revalidatePath("/letter");
  revalidatePath("/");
  return { ok: true };
}

const PoolLetterSchema = z.object({
  category: z.enum(LETTER_CATEGORIES),
  title: z.string().trim().max(120).optional(),
  body: z
    .string()
    .trim()
    .min(20, "Suratnya kependekan — tulis sedikit lebih panjang ya.")
    .max(2000, "Wah, kepanjangan. Persingkat sedikit ya."),
});

export type AddLetterState = { ok?: boolean; error?: string };

/** Author-only: add a letter to the pool. RLS enforces the author role too. */
export async function addPoolLetter(
  _prev: AddLetterState,
  formData: FormData,
): Promise<AddLetterState> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Coba masuk lagi ya." };
  if (ctx.role !== "author") return { error: "Cuma penulis surat yang bisa nambah." };

  const parsed = PoolLetterSchema.safeParse({
    category: formData.get("category"),
    title: (formData.get("title") as string) || undefined,
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Coba cek lagi isinya." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("letter_pool").insert({
    space_id: ctx.spaceId,
    author_id: ctx.userId,
    category: parsed.data.category,
    title: parsed.data.title ?? null,
    body: parsed.data.body,
  });

  if (error) return { error: "Suratnya nyangkut di jalan. Coba lagi sebentar ya. ♡" };
  revalidatePath("/letter");
  return { ok: true };
}

/** Mark a received direct letter as opened. RLS ensures only the recipient can. */
export async function openDirectLetter(letterId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("direct_letters")
    .update({ status: "opened", opened_at: new Date().toISOString() })
    .eq("id", letterId)
    .eq("status", "sealed");

  if (error) return { ok: false };
  revalidatePath("/letter");
  revalidatePath("/");
  return { ok: true };
}

const MAX_SEQUENCE = 10;

const SequenceItemSchema = z.object({
  title: z.string().trim().max(120).optional().default(""),
  body: z
    .string()
    .trim()
    .min(10, "Ada surat yang kependekan — tulis sedikit lebih panjang ya.")
    .max(2000, "Ada surat yang kepanjangan. Persingkat sedikit ya."),
  song: z.string().trim().max(500).optional().default(""),
});

const SequenceSchema = z
  .array(SequenceItemSchema)
  .min(1, "Tulis minimal satu surat dulu ya.")
  .max(MAX_SEQUENCE, `Maksimal ${MAX_SEQUENCE} surat dalam satu rangkaian.`);

/** Resolve a pasted Spotify link into { id, title, image }. oEmbed (no API key)
 *  gives a title + cover for the pre-open chip; best-effort, so the player still
 *  works from the id alone if the lookup fails. */
async function resolveSpotifySong(
  raw: string,
): Promise<{ id: string; title: string | null; image: string | null } | null> {
  const id = parseSpotifyTrackId(raw);
  if (!id) return null;
  const song = { id, title: null as string | null, image: null as string | null };
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
      song.title = j?.title ?? null;
      song.image = j?.thumbnail_url ?? null;
    }
  } catch {
    // best-effort — keep the track id even if the metadata lookup fails
  }
  return song;
}

export type SendLetterState = { ok?: boolean; error?: string };

/**
 * Send one or more letters to your partner as an ordered sequence. Either member
 * may do this (so the keeper can write to the author too). A sequence of two or
 * more shares a `batch_id` and is read in order — the recipient's UI keeps each
 * letter locked until the previous one is opened. A single letter has no
 * batch_id and no gating. Each letter may carry one Spotify song.
 *
 * The drafts arrive as a JSON array in the `letters` field. RLS still enforces
 * `sender_id = auth.uid()` and that the recipient is the other member.
 */
export async function sendLetterSequence(
  _prev: SendLetterState,
  formData: FormData,
): Promise<SendLetterState> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: "Sesi kamu habis. Coba masuk lagi ya." };

  const partner = await getPartner(ctx.spaceId, ctx.userId);
  if (!partner) return { error: "Belum ada yang bisa dikirimi surat di space ini." };

  let raw: unknown;
  try {
    raw = JSON.parse((formData.get("letters") as string) || "[]");
  } catch {
    return { error: "Ada yang salah dengan isinya. Muat ulang halaman lalu coba lagi ya." };
  }

  const parsed = SequenceSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Coba cek lagi isinya." };
  }

  const drafts = parsed.data;
  const isSequence = drafts.length > 1;
  const batchId = isSequence ? crypto.randomUUID() : null;

  // Resolve each letter's optional song (sequentially keeps the oEmbed calls
  // gentle and lets us point at the offending letter on failure).
  const rows = [];
  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i];
    let song = null as Awaited<ReturnType<typeof resolveSpotifySong>>;
    if (d.song) {
      song = await resolveSpotifySong(d.song);
      if (!song) {
        const where = isSequence ? `Surat ke-${i + 1}: ` : "";
        return { error: `${where}link lagunya belum pas — tempel link lagu Spotify ya. ♡` };
      }
    }
    rows.push({
      space_id: ctx.spaceId,
      sender_id: ctx.userId,
      recipient_id: partner.id,
      batch_id: batchId,
      sort_index: i,
      title: d.title ? d.title : null,
      body: d.body,
      song_track_id: song?.id ?? null,
      song_title: song?.title ?? null,
      song_image: song?.image ?? null,
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("direct_letters").insert(rows);
  if (error) return { error: "Suratnya nyangkut di jalan. Coba lagi sebentar ya. ♡" };

  // Best-effort heads-up; never blocks the send. For a sequence, announce the
  // first letter (the one she'll open first).
  void notifyDirectLetter({
    recipientId: partner.id,
    title: rows[0].title,
    songTitle: rows[0].song_title,
    count: rows.length,
  });

  revalidatePath("/letter");
  revalidatePath("/");
  return { ok: true };
}
