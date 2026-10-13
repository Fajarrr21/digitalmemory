"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { LIMITS, stayErrorMessage } from "@/lib/stay/logic";
import { notifyStayGift } from "@/lib/notify/stay";

/**
 * stay, my love. — server actions. Thin and validated; RLS + the stay_*
 * functions in migration 0020 are where the real rules live (who may send,
 * open, put away, edit, take back).
 */

export type StayResult = { ok?: boolean; error?: string; id?: string };

const SESSION_GONE = "Sesi kamu habis. Masuk lagi ya.";

function refresh() {
  revalidatePath("/stay");
  revalidatePath("/stay/leave");
  revalidatePath("/");
}

const GiftSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("note"), body: z.string().trim().min(1).max(LIMITS.note) }),
  z.object({ kind: z.literal("comfort"), body: z.string().trim().min(1).max(LIMITS.comfort) }),
  z.object({
    kind: z.literal("object"),
    objectKind: z.enum(["flower", "heart", "star", "crane", "moon"]),
    body: z.string().trim().max(LIMITS.line),
  }),
  z.object({
    kind: z.literal("voice"),
    body: z.string().trim().max(LIMITS.line),
    audioPath: z.string().min(1).max(300),
    audioMime: z.string().max(80),
    seconds: z.number().int().min(1).max(300),
  }),
]);

export async function leaveGift(input: z.input<typeof GiftSchema>): Promise<StayResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  const parsed = GiftSchema.safeParse(input);
  if (!parsed.success) return { error: stayErrorMessage("stay_invalid") };
  const d = parsed.data;

  const partner = await getPartner(ctx.spaceId, ctx.userId);
  if (!partner) return { error: "Belum ada pasangan di ruang ini." };

  if (d.kind === "voice" && !d.audioPath.startsWith(`${ctx.spaceId}/${ctx.userId}/stay/`)) {
    return { error: stayErrorMessage("stay_invalid") };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stay_gifts")
    .insert({
      space_id: ctx.spaceId,
      sender_id: ctx.userId,
      recipient_id: partner.id,
      kind: d.kind,
      object_kind: d.kind === "object" ? d.objectKind : null,
      body: d.body.trim() || null,
      audio_path: d.kind === "voice" ? d.audioPath : null,
      audio_mime: d.kind === "voice" ? d.audioMime : null,
      audio_seconds: d.kind === "voice" ? d.seconds : null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: stayErrorMessage(error?.message) };

  // A slow gateway never holds up the gift.
  after(() => notifyStayGift(data.id, partner.id));

  refresh();
  return { ok: true, id: data.id };
}

const Id = z.string().uuid();

export async function openGift(id: string): Promise<StayResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  if (!Id.safeParse(id).success) return { error: stayErrorMessage(null) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("stay_open", { p_gift: id });
  if (error) return { error: stayErrorMessage(error.message) };
  revalidatePath("/stay/leave");
  revalidatePath("/");
  return { ok: true };
}

export async function putAwayGift(id: string, away: boolean): Promise<StayResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  if (!Id.safeParse(id).success) return { error: stayErrorMessage(null) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("stay_put_away", { p_gift: id, p_away: away });
  if (error) return { error: stayErrorMessage(error.message) };
  refresh();
  return { ok: true };
}

const EditSchema = z.object({ id: Id, body: z.string().trim().max(LIMITS.note) });

export async function editGift(input: z.input<typeof EditSchema>): Promise<StayResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  const parsed = EditSchema.safeParse(input);
  if (!parsed.success) return { error: stayErrorMessage("stay_invalid") };
  const supabase = await createClient();
  const { error } = await supabase.rpc("stay_edit", { p_gift: parsed.data.id, p_body: parsed.data.body || null });
  if (error) return { error: stayErrorMessage(error.message) };
  refresh();
  return { ok: true };
}

/** Take a gift back — it disappears for both of you, voice file included. Sender only. */
export async function takeBackGift(id: string): Promise<StayResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  if (!Id.safeParse(id).success) return { error: stayErrorMessage(null) };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stay_gifts")
    .delete()
    .eq("id", id)
    .eq("sender_id", ctx.userId)
    .select("audio_path");
  if (error) return { error: stayErrorMessage(error.message) };
  if (!data?.length) return { error: "Hanya yang meninggalkannya yang bisa mengambilnya kembali." };
  const audio = data[0].audio_path;
  if (audio) await supabase.storage.from("media").remove([audio]);
  refresh();
  return { ok: true };
}

/** Undo a voice upload whose gift never got saved, so no orphan stays in Storage. */
export async function discardUpload(path: string): Promise<StayResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  if (!path.startsWith(`${ctx.spaceId}/${ctx.userId}/stay/`)) return { error: stayErrorMessage(null) };
  const supabase = await createClient();
  await supabase.storage.from("media").remove([path]);
  return { ok: true };
}

const PrefsSchema = z.object({
  scene: z.enum(["rain", "night", "morning"]).optional(),
  lamp: z.enum(["warm", "dim", "window"]).optional(),
  show_character: z.boolean().optional(),
  calm_motion: z.boolean().optional(),
  intro_seen: z.boolean().optional(),
});

/** Room preferences — only the ones worth remembering across visits. */
export async function saveStayPrefs(input: z.input<typeof PrefsSchema>): Promise<StayResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  const parsed = PrefsSchema.safeParse(input);
  if (!parsed.success) return { error: stayErrorMessage(null) };
  const { intro_seen, ...rest } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("stay_rooms").upsert(
    {
      user_id: ctx.userId,
      space_id: ctx.spaceId,
      ...rest,
      ...(intro_seen ? { intro_seen_at: new Date().toISOString() } : {}),
    },
    { onConflict: "user_id" },
  );
  if (error) return { error: stayErrorMessage(error.message) };
  return { ok: true };
}

/** Per-person switch for the WhatsApp heads-up (profiles.notif_prefs.stay_whatsapp). */
export async function setStayWhatsApp(enabled: boolean): Promise<StayResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  const supabase = await createClient();
  const prefs = { ...(ctx.profile.notif_prefs ?? {}), stay_whatsapp: !!enabled };
  const { error } = await supabase.from("profiles").update({ notif_prefs: prefs }).eq("id", ctx.userId);
  if (error) return { error: "Gagal menyimpan. Coba lagi ya." };
  revalidatePath("/stay");
  return { ok: true };
}
