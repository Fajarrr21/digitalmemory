"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSpaceContext } from "@/lib/auth";
import { careErrorMessage, shouldNotifySender } from "@/lib/care/logic";
import { notifyCareArrived, notifyCareInvite } from "@/lib/notify/care";

/**
 * Little Care — server actions. Each is a thin, validated wrapper over one
 * care_* database function (migration 0019), where the real rules live.
 * Every write carries a client_key so a retry or double tap lands once.
 *
 * Nothing about anyone's health is ever logged or sent from here.
 */

export type CareResult = { ok?: boolean; error?: string; id?: string; existingId?: string };

const SESSION_GONE = "Sesi kamu habis. Masuk lagi ya.";

const SYMPTOM = z.enum(["stomach", "nausea", "cramps", "dizzy", "weak", "other"]);
const SEVERITY = z.enum(["mild", "moderate", "severe"]);
const RED_FLAG = z.enum([
  "severe_pain",
  "repeated_vomiting",
  "no_fluids",
  "fainted",
  "heavy_bleeding",
  "pregnant_pain",
  "dehydrated",
]);
const WANT = z.enum(["warm", "drink", "stay", "quiet", "surprise"]);

function refresh(id?: string) {
  revalidatePath("/care");
  revalidatePath("/");
  if (id) revalidatePath(`/care/${id}`);
}

const CreateSchema = z.object({
  symptoms: z.array(SYMPTOM).min(1).max(6),
  severity: SEVERITY,
  note: z.string().trim().max(400).nullable(),
  shareDetails: z.boolean(),
  shareNote: z.boolean(),
  redFlags: z.array(RED_FLAG).max(7),
  needsCheck: z.boolean(),
  wants: z.array(WANT).min(1).max(5),
  clientKey: z.string().uuid(),
});

export async function createCare(input: z.input<typeof CreateSchema>): Promise<CareResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) return { error: careErrorMessage("care_invalid") };
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("care_create", {
    p_space: ctx.spaceId,
    p_symptoms: d.symptoms,
    p_severity: d.severity,
    p_note: d.note || null,
    p_share_details: d.shareDetails,
    p_share_note: d.shareNote,
    p_red_flags: d.redFlags,
    p_needs_check: d.needsCheck,
    p_wants: d.wants,
    p_client_key: d.clientKey,
  });
  if (error || !data) {
    const existingId = error?.message.includes("care_active_exists") ? error.details : undefined;
    return { error: careErrorMessage(error?.message), existingId: existingId || undefined };
  }

  const result = data as { id: string; created: boolean };
  if (result.created) {
    const { data: row } = await supabase
      .from("care_sessions")
      .select("recipient_id")
      .eq("id", result.id)
      .maybeSingle();
    // The carer always hears — once, generically. A slow gateway never holds up the send.
    if (row) after(() => notifyCareInvite(result.id, row.recipient_id));
  }

  refresh(result.id);
  return { ok: true, id: result.id };
}

const ActSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("gesture"), variant: z.enum(["hug", "glow", "star"]) }),
  z.object({ kind: z.literal("message"), message: z.string().trim().min(1).max(280) }),
  z.object({ kind: z.literal("accompany"), variant: z.enum(["chat", "call"]) }),
  z.object({ kind: z.literal("rest") }),
  z.object({ kind: z.literal("help"), variant: z.enum(["drink", "family", "medical", "close"]) }),
]);

const ActInput = z.object({
  id: z.string().uuid(),
  clientKey: z.string().uuid(),
  care: ActSchema,
});

export async function careFor(input: z.input<typeof ActInput>): Promise<CareResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  const parsed = ActInput.safeParse(input);
  if (!parsed.success) return { error: "Pilih dulu caramu merawatnya ya. ♡" };
  const { id, clientKey, care } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("care_act", {
    p_session: id,
    p_kind: care.kind,
    p_variant: "variant" in care ? care.variant : null,
    p_message: care.kind === "message" ? care.message : null,
    p_client_key: clientKey,
  });
  if (error || !data) return { error: careErrorMessage(error?.message) };

  const result = data as { id: string; duplicate: boolean; first: boolean };
  if (!result.duplicate) {
    const { data: s } = await supabase
      .from("care_sessions")
      .select("sender_id, status, wants, sender_notified_at")
      .eq("id", id)
      .maybeSingle();
    if (
      s &&
      shouldNotifySender({
        first: result.first,
        kind: care.kind,
        status: s.status,
        wants: s.wants,
        alreadyNotified: !!s.sender_notified_at,
      })
    ) {
      after(() => notifyCareArrived(id, s.sender_id));
    }
  }

  refresh(id);
  return { ok: true, id };
}

const AnswerSchema = z.object({
  sessionId: z.string().uuid(),
  actionId: z.string().uuid(),
  answer: z.enum(["yes", "not_now"]),
});

/** The sender's yes / not now to an offer. Never notifies. */
export async function answerCare(input: z.input<typeof AnswerSchema>): Promise<CareResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  const parsed = AnswerSchema.safeParse(input);
  if (!parsed.success) return { error: careErrorMessage(null) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("care_answer", {
    p_action: parsed.data.actionId,
    p_answer: parsed.data.answer,
  });
  if (error) return { error: careErrorMessage(error.message) };

  refresh(parsed.data.sessionId);
  return { ok: true };
}

const AfterSchema = z.object({
  id: z.string().uuid(),
  choice: z.enum(["better", "longer", "rest"]),
  keep: z.boolean(),
});

/** "A little better?" — nothing here ever notifies anyone. */
export async function afterCare(input: z.input<typeof AfterSchema>): Promise<CareResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  const parsed = AfterSchema.safeParse(input);
  if (!parsed.success) return { error: careErrorMessage(null) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("care_after", {
    p_session: parsed.data.id,
    p_choice: parsed.data.choice,
    p_keep: parsed.data.keep,
  });
  if (error) return { error: careErrorMessage(error.message) };

  refresh(parsed.data.id);
  return { ok: true, id: parsed.data.id };
}

const RestSchema = z.object({ id: z.string().uuid(), on: z.boolean() });

export async function setCareRest(input: z.input<typeof RestSchema>): Promise<CareResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  const parsed = RestSchema.safeParse(input);
  if (!parsed.success) return { error: careErrorMessage(null) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("care_set_rest", {
    p_session: parsed.data.id,
    p_on: parsed.data.on,
  });
  if (error) return { error: careErrorMessage(error.message) };

  refresh(parsed.data.id);
  return { ok: true, id: parsed.data.id };
}

const IdKeep = z.object({ id: z.string().uuid(), keep: z.boolean() });

export async function closeCare(input: z.input<typeof IdKeep>): Promise<CareResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  const parsed = IdKeep.safeParse(input);
  if (!parsed.success) return { error: careErrorMessage(null) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("care_close", {
    p_session: parsed.data.id,
    p_keep: parsed.data.keep,
  });
  if (error) return { error: careErrorMessage(error.message) };

  refresh(parsed.data.id);
  return { ok: true, id: parsed.data.id };
}

export async function setCareKept(input: z.input<typeof IdKeep>): Promise<CareResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  const parsed = IdKeep.safeParse(input);
  if (!parsed.success) return { error: careErrorMessage(null) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("care_set_kept", {
    p_session: parsed.data.id,
    p_keep: parsed.data.keep,
  });
  if (error) return { error: careErrorMessage(error.message) };

  refresh(parsed.data.id);
  return { ok: true, id: parsed.data.id };
}

/** Delete a session entirely — for both of you. Sender only (RLS). */
export async function deleteCare(id: string): Promise<CareResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  if (!z.string().uuid().safeParse(id).success) return { error: careErrorMessage(null) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("care_sessions")
    .delete()
    .eq("id", id)
    .eq("sender_id", ctx.userId)
    .select("id");
  if (error) return { error: careErrorMessage(error.message) };
  if (!data?.length) return { error: "Hanya yang membuka Little Care ini yang bisa menghapusnya." };

  refresh();
  return { ok: true };
}

/** Per-person switch for Little Care WhatsApp messages (profiles.notif_prefs.care_whatsapp). */
export async function setCareWhatsApp(enabled: boolean): Promise<CareResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };

  const supabase = await createClient();
  const prefs = { ...(ctx.profile.notif_prefs ?? {}), care_whatsapp: !!enabled };
  const { error } = await supabase.from("profiles").update({ notif_prefs: prefs }).eq("id", ctx.userId);
  if (error) return { error: "Gagal menyimpan. Coba lagi ya." };

  revalidatePath("/care");
  return { ok: true };
}
