"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSpaceContext } from "@/lib/auth";
import { actionFit, holdErrorMessage, shouldNotifyRecipient, shouldNotifySender } from "@/lib/hold/logic";
import { notifyHoldArrived, notifyHoldInvite } from "@/lib/notify/hold";

/**
 * If I Could Hold Your Feelings — server actions. Each is a thin, validated
 * wrapper over one hold_* database function (migration 0018), which is where
 * the real rules live: who may do what, in which state, exactly once. Every
 * write carries a client_key so a retry or double tap lands on the same row.
 *
 * Nothing sensitive is ever logged here.
 */

export type HoldResult = { ok?: boolean; error?: string; id?: string; existingId?: string };

const SESSION_GONE = "Sesi kamu habis. Masuk lagi ya.";

const FEELING = z.enum(["overwhelmed", "alone", "tired", "racing", "miss_you", "comfort"]);
const NEED = z.enum(["stay", "loved", "space", "vent"]);
const ACTION = z.enum(["stay", "warmth", "listening", "space"]);

function refresh(id?: string) {
  revalidatePath("/hold");
  revalidatePath("/");
  if (id) revalidatePath(`/hold/${id}`);
}

const CreateSchema = z.object({
  feeling: FEELING,
  intensity: z.number().int().min(1).max(4).nullable(),
  shareIntensity: z.boolean(),
  need: NEED,
  context: z.string().trim().max(600).nullable(),
  shareContext: z.boolean(),
  timing: z.enum(["whenever", "soon"]),
  clientKey: z.string().uuid(),
});

export async function createHold(input: z.input<typeof CreateSchema>): Promise<HoldResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) return { error: "Ada pilihan yang belum lengkap. ♡" };
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("hold_create", {
    p_space: ctx.spaceId,
    p_feeling: d.feeling,
    p_intensity: d.intensity,
    p_share_intensity: d.shareIntensity,
    p_need: d.need,
    p_context: d.context || null,
    p_share_context: d.shareContext,
    p_timing: d.timing,
    p_client_key: d.clientKey,
  });
  if (error || !data) {
    const existingId = error?.message.includes("hold_active_exists") ? error.details : undefined;
    return { error: holdErrorMessage(error?.message), existingId: existingId || undefined };
  }

  const result = data as { id: string; created: boolean };
  if (result.created) {
    const { data: row } = await supabase
      .from("hold_sessions")
      .select("recipient_id, timing, notified_at")
      .eq("id", result.id)
      .maybeSingle();
    if (
      row &&
      shouldNotifyRecipient({
        timing: row.timing,
        alreadyNotified: !!row.notified_at,
        recipientOptedOut: false, // checked again inside, with the real prefs
      })
    ) {
      // Deferred past the response: a slow gateway never holds up the send.
      after(() => notifyHoldInvite(result.id, row.recipient_id));
    }
  }

  refresh(result.id);
  return { ok: true, id: result.id };
}

const RespondSchema = z.object({
  id: z.string().uuid(),
  action: ACTION,
  gesture: z.enum(["wrap", "glow", "hand"]).nullable(),
  message: z.string().trim().max(500).nullable(),
  clientKey: z.string().uuid(),
});

export async function respondHold(input: z.input<typeof RespondSchema>): Promise<HoldResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  const parsed = RespondSchema.safeParse(input);
  if (!parsed.success) return { error: "Pilih dulu caramu hadir ya. ♡" };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("hold_sessions")
    .select("sender_id, need")
    .eq("id", d.id)
    .maybeSingle();
  if (!session) return { error: holdErrorMessage("hold_forbidden") };
  if (actionFit(session.need, d.action) === "avoid") {
    return { error: holdErrorMessage("hold_action_unfit") };
  }

  const { data, error } = await supabase.rpc("hold_respond", {
    p_session: d.id,
    p_action: d.action,
    p_gesture: d.action === "warmth" ? d.gesture : null,
    p_message: d.message || null,
    p_client_key: d.clientKey,
  });
  if (error || !data) return { error: holdErrorMessage(error?.message) };

  const result = data as { id: string; duplicate: boolean };
  if (!result.duplicate && shouldNotifySender(d.action, false)) {
    after(() => notifyHoldArrived(session.sender_id));
  }

  refresh(d.id);
  return { ok: true, id: d.id };
}

const AfterSchema = z.object({
  id: z.string().uuid(),
  choice: z.enum(["less_alone", "longer", "quiet"]),
  newNeed: NEED.nullable(),
  followup: z.string().trim().max(500).nullable(),
  keep: z.boolean(),
  clientKey: z.string().uuid(),
});

/** "What do you need now?" — nothing here ever notifies the partner. */
export async function afterHold(input: z.input<typeof AfterSchema>): Promise<HoldResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  const parsed = AfterSchema.safeParse(input);
  if (!parsed.success) return { error: "Coba pilih lagi ya. ♡" };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("hold_after", {
    p_session: d.id,
    p_choice: d.choice,
    p_new_need: d.newNeed,
    p_followup: d.followup || null,
    p_keep: d.keep,
    p_client_key: d.clientKey,
  });
  if (error) return { error: holdErrorMessage(error.message) };

  refresh(d.id);
  return { ok: true, id: d.id };
}

const IdKeep = z.object({ id: z.string().uuid(), keep: z.boolean() });

/** End a session (or withdraw one nobody has opened yet). */
export async function closeHold(input: z.input<typeof IdKeep>): Promise<HoldResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  const parsed = IdKeep.safeParse(input);
  if (!parsed.success) return { error: holdErrorMessage(null) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("hold_close", {
    p_session: parsed.data.id,
    p_keep: parsed.data.keep,
  });
  if (error) return { error: holdErrorMessage(error.message) };

  refresh(parsed.data.id);
  revalidatePath("/hold/past");
  return { ok: true, id: parsed.data.id };
}

/** Past Holds: keep an ended session, or let its words go. */
export async function setHoldKept(input: z.input<typeof IdKeep>): Promise<HoldResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  const parsed = IdKeep.safeParse(input);
  if (!parsed.success) return { error: holdErrorMessage(null) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("hold_set_kept", {
    p_session: parsed.data.id,
    p_keep: parsed.data.keep,
  });
  if (error) return { error: holdErrorMessage(error.message) };

  refresh(parsed.data.id);
  revalidatePath("/hold/past");
  return { ok: true, id: parsed.data.id };
}

/** Delete a session entirely — for both of you. Sender only (RLS). */
export async function deleteHold(id: string): Promise<HoldResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  if (!z.string().uuid().safeParse(id).success) return { error: holdErrorMessage(null) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hold_sessions")
    .delete()
    .eq("id", id)
    .eq("sender_id", ctx.userId)
    .select("id");
  if (error) return { error: holdErrorMessage(error.message) };
  if (!data?.length) return { error: "Hanya yang membuka ruang ini yang bisa menghapusnya." };

  refresh();
  revalidatePath("/hold/past");
  return { ok: true };
}

/** Per-person switch for Hold WhatsApp messages (profiles.notif_prefs.hold_whatsapp). */
export async function setHoldWhatsApp(enabled: boolean): Promise<HoldResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };

  const supabase = await createClient();
  const prefs = { ...(ctx.profile.notif_prefs ?? {}), hold_whatsapp: !!enabled };
  const { error } = await supabase
    .from("profiles")
    .update({ notif_prefs: prefs })
    .eq("id", ctx.userId);
  if (error) return { error: "Gagal menyimpan. Coba lagi ya." };

  revalidatePath("/hold");
  return { ok: true };
}
