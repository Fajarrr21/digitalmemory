"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { localDateISO } from "@/lib/date";
import { PERIOD_PROBLEM_TEXT, periodProblem, type Period } from "@/lib/moon/cycle";
import { isEmptyCheckin } from "@/lib/moon/insights";

/**
 * her little moon. — server actions. Owner-only RLS is the real gate; these
 * validate, use HER local date (profile timezone), and never log a single
 * value of what she records. No action here sends anything to anyone, ever:
 * a care request is a row he can read in the app, nothing more.
 */

export type MoonResult = { ok?: boolean; error?: string; id?: string };

const SESSION_GONE = "Sesi kamu habis. Masuk lagi ya.";
const GENERIC = "Ada yang tersendat. Coba lagi sebentar ya. ♡";
const ISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function refresh() {
  for (const p of ["/moon", "/moon/calendar", "/moon/checkin", "/moon/insights", "/moon/settings", "/", "/notifications"]) {
    revalidatePath(p);
  }
}

async function ownPeriods(userId: string): Promise<Period[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("moon_periods").select("id, start_date, end_date").eq("user_id", userId);
  return (data ?? []).map((p) => ({ id: p.id, start: p.start_date, end: p.end_date }));
}

// ---- Periods ------------------------------------------------------------------

const PeriodSchema = z.object({ id: z.string().uuid().optional(), start: ISO, end: ISO.nullable() });

export async function savePeriod(input: z.input<typeof PeriodSchema>): Promise<MoonResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  const parsed = PeriodSchema.safeParse(input);
  if (!parsed.success) return { error: "Tanggalnya belum lengkap." };
  const d = parsed.data;
  const today = localDateISO(ctx.profile.timezone);

  const problem = periodProblem(d, await ownPeriods(ctx.userId), today);
  if (problem) return { error: PERIOD_PROBLEM_TEXT[problem] };

  const supabase = await createClient();
  const { data, error } = d.id
    ? await supabase
        .from("moon_periods")
        .update({ start_date: d.start, end_date: d.end })
        .eq("id", d.id)
        .eq("user_id", ctx.userId)
        .select("id")
        .single()
    : await supabase
        .from("moon_periods")
        .insert({ user_id: ctx.userId, space_id: ctx.spaceId, start_date: d.start, end_date: d.end })
        .select("id")
        .single();
  if (error || !data) {
    return { error: error?.message.includes("moon_overlap") ? PERIOD_PROBLEM_TEXT.overlap : GENERIC };
  }
  refresh();
  return { ok: true, id: data.id };
}

/** "It ended today" / on a chosen day — for the period that's still going. */
export async function endOngoing(day?: string): Promise<MoonResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  const periods = await ownPeriods(ctx.userId);
  const ongoing = periods.find((p) => !p.end);
  if (!ongoing) return { error: "Nggak ada menstruasi yang sedang berlangsung." };
  return savePeriod({ id: ongoing.id, start: ongoing.start, end: day ?? localDateISO(ctx.profile.timezone) });
}

export async function deletePeriod(id: string): Promise<MoonResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  if (!z.string().uuid().safeParse(id).success) return { error: GENERIC };
  const supabase = await createClient();
  const { error } = await supabase.from("moon_periods").delete().eq("id", id).eq("user_id", ctx.userId);
  if (error) return { error: GENERIC };
  refresh();
  return { ok: true };
}

// ---- Daily check-in ---------------------------------------------------------------

const CheckinSchema = z.object({
  day: ISO,
  cramps: z.number().int().min(1).max(3).nullable(),
  headache: z.boolean(),
  nausea: z.boolean(),
  vomiting: z.boolean(),
  fatigue: z.boolean(),
  mood: z.enum(["calm", "happy", "sensitive", "sad", "irritable", "anxious"]).nullable(),
  energy: z.number().int().min(1).max(3).nullable(),
  flow: z.enum(["spotting", "light", "medium", "heavy"]).nullable(),
  note: z.string().trim().max(1000).nullable(),
});

export async function saveCheckin(input: z.input<typeof CheckinSchema>): Promise<MoonResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  const parsed = CheckinSchema.safeParse(input);
  if (!parsed.success) return { error: "Ada yang belum pas. Coba cek lagi ya." };
  const d = { ...parsed.data, note: parsed.data.note?.trim() || null };
  if (d.day > localDateISO(ctx.profile.timezone)) return { error: "Hari itu belum datang. ♡" };
  if (isEmptyCheckin(d)) return { error: "Pilih satu hal saja, atau tulis catatan kecil." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("moon_checkins")
    .upsert({ user_id: ctx.userId, space_id: ctx.spaceId, ...d }, { onConflict: "user_id,day" });
  if (error) return { error: GENERIC };
  refresh();
  return { ok: true };
}

export async function deleteCheckin(day: string): Promise<MoonResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  if (!ISO.safeParse(day).success) return { error: GENERIC };
  const supabase = await createClient();
  const { error } = await supabase.from("moon_checkins").delete().eq("user_id", ctx.userId).eq("day", day);
  if (error) return { error: GENERIC };
  refresh();
  return { ok: true };
}

// ---- Sharing (hers to decide, revocable any time) ---------------------------------

const ShareSchema = z.object({ share_phase: z.boolean(), share_symptoms: z.boolean(), partner_heads_up: z.boolean() });

export async function saveShare(input: z.input<typeof ShareSchema>): Promise<MoonResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  const parsed = ShareSchema.safeParse(input);
  if (!parsed.success) return { error: GENERIC };
  const supabase = await createClient();
  const { error } = await supabase
    .from("moon_share")
    .upsert({ user_id: ctx.userId, space_id: ctx.spaceId, ...parsed.data }, { onConflict: "user_id" });
  if (error) return { error: GENERIC };
  refresh();
  return { ok: true };
}

// ---- Asking for a little care --------------------------------------------------------

const CareSchema = z.object({
  need: z.enum(["extra_care", "company", "cheer", "space", "help", "share"]),
  message: z.string().trim().max(500).nullable(),
});

export async function askForCare(input: z.input<typeof CareSchema>): Promise<MoonResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  const parsed = CareSchema.safeParse(input);
  if (!parsed.success) return { error: "Pilih dulu apa yang kamu butuhkan ya." };
  const partner = await getPartner(ctx.spaceId, ctx.userId);
  if (!partner) return { error: "Belum ada pasangan di ruang ini." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("moon_care_requests")
    .insert({
      space_id: ctx.spaceId,
      user_id: ctx.userId,
      recipient_id: partner.id,
      need: parsed.data.need,
      message: parsed.data.message || null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: GENERIC };
  refresh();
  return { ok: true, id: data.id };
}

/** "It's okay now" — keeps the request in her history, marked done. */
export async function closeCare(id: string): Promise<MoonResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  if (!z.string().uuid().safeParse(id).success) return { error: GENERIC };
  const supabase = await createClient();
  const { error } = await supabase.rpc("moon_care_close", { p_request: id });
  if (error) return { error: GENERIC };
  refresh();
  return { ok: true };
}

/** Withdraw entirely — it disappears from his side too. */
export async function withdrawCare(id: string): Promise<MoonResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  if (!z.string().uuid().safeParse(id).success) return { error: GENERIC };
  const supabase = await createClient();
  const { error } = await supabase.from("moon_care_requests").delete().eq("id", id).eq("user_id", ctx.userId);
  if (error) return { error: GENERIC };
  refresh();
  return { ok: true };
}

/** His side: "I'm on it ♡". */
export async function ackCare(id: string): Promise<MoonResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  if (!z.string().uuid().safeParse(id).success) return { error: GENERIC };
  const supabase = await createClient();
  const { error } = await supabase.rpc("moon_care_ack", { p_request: id });
  if (error) return { error: GENERIC };
  refresh();
  return { ok: true };
}

// ---- Her reminders ---------------------------------------------------------------------

const ReminderSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(["checkin", "period", "insights", "custom"]),
  label: z.string().trim().max(80).nullable(),
  at_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  enabled: z.boolean(),
  whatsapp: z.boolean(),
});

export async function saveReminder(input: z.input<typeof ReminderSchema>): Promise<MoonResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  const parsed = ReminderSchema.safeParse(input);
  if (!parsed.success) return { error: "Waktunya belum pas (format JJ:MM)." };
  const d = parsed.data;
  if (d.kind === "custom" && !d.label) return { error: "Tulis dulu pengingatnya mau bilang apa." };
  const row = { kind: d.kind, label: d.kind === "custom" ? d.label : null, at_time: d.at_time, enabled: d.enabled, whatsapp: d.whatsapp };
  const supabase = await createClient();
  const { error } = d.id
    ? await supabase.from("moon_reminders").update(row).eq("id", d.id).eq("user_id", ctx.userId)
    : await supabase.from("moon_reminders").insert({ ...row, user_id: ctx.userId, space_id: ctx.spaceId });
  if (error) return { error: GENERIC };
  refresh();
  return { ok: true };
}

export async function deleteReminder(id: string): Promise<MoonResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  if (!z.string().uuid().safeParse(id).success) return { error: GENERIC };
  const supabase = await createClient();
  const { error } = await supabase.from("moon_reminders").delete().eq("id", id).eq("user_id", ctx.userId);
  if (error) return { error: GENERIC };
  refresh();
  return { ok: true };
}

/** "oke ♡" in the 🔔 center — quiet for the rest of her day. */
export async function dismissMoonReminder(id: string): Promise<MoonResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  if (!z.string().uuid().safeParse(id).success) return { error: GENERIC };
  const supabase = await createClient();
  const { error } = await supabase
    .from("moon_reminders")
    .update({ dismissed_on: localDateISO(ctx.profile.timezone) })
    .eq("id", id)
    .eq("user_id", ctx.userId);
  if (error) return { error: GENERIC };
  refresh();
  return { ok: true };
}
