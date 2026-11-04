"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { zonedDateTimeToUTC } from "@/lib/date";
import { GENRES, MOODS, WORDS_LIMITS } from "@/lib/words/options";
import { fallbackTitle } from "@/lib/words/logic";

/**
 * little words. — writes. Thin and validated; RLS in 0022 is where the real
 * rules live (works are owner-only, a delivery is a snapshot given only AS
 * yourself TO your partner, only the recipient opens/marks it, a sender can
 * withdraw only while it's unopened).
 */

export type WordsResult = { ok?: boolean; error?: string; id?: string };

const SESSION_GONE = "Sesi kamu habis. Masuk lagi ya.";
const NOT_READY = "Little Words belum siap — jalankan migrasi 0022_little_words.sql dulu.";

function message(err: { message?: string; code?: string } | null | undefined): string {
  const m = err?.message ?? "";
  if (/words_locked/.test(m)) return "Belum waktunya dibuka. ♡";
  if (/words_forbidden|row-level security|violates/.test(m)) return "Ini bukan milikmu untuk diubah.";
  if (/relation .* does not exist|schema cache/.test(m)) return NOT_READY;
  if (/check constraint/.test(m)) return "Ada isian yang terlalu panjang atau belum sesuai.";
  return "Gagal menyimpan. Coba lagi ya.";
}

function refresh(id?: string) {
  revalidatePath("/words");
  revalidatePath("/words/library");
  if (id) revalidatePath(`/words/w/${id}`);
}

const Id = z.string().uuid();
const WorkTypeZ = z.enum(["poetry", "prose", "letter", "quote"]);
const GenreZ = z.enum(GENRES.map((g) => g.key) as [string, ...string[]]).nullable().optional();
const MoodZ = z.enum(MOODS.map((m) => m.key) as [string, ...string[]]).nullable().optional();

const Meta = {
  title: z.string().max(WORDS_LIMITS.title).optional(),
  content: z.string().max(WORDS_LIMITS.content).optional(),
  work_type: WorkTypeZ.optional(),
  style: z.string().max(40).nullable().optional(),
  theme: z.string().max(160).nullable().optional(),
  genre: GenreZ,
  mood: MoodZ,
  language: z.enum(["id", "en"]).optional(),
  literary_depth: z.number().int().min(1).max(5).nullable().optional(),
  status: z.enum(["draft", "finished"]).optional(),
};

/* --------------------------------------------------------------- works -- */

const CreateSchema = z.object({
  ...Meta,
  content: z.string().max(WORDS_LIMITS.content),
  origin: z.enum(["manual", "muse", "rewrite"]).default("manual"),
  transformation: z.string().max(80).nullable().optional(),
});

/** A new work + its first revision. Empty is fine — a blank page is a draft too. */
export async function createWork(input: z.input<typeof CreateSchema>): Promise<WordsResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) return { error: "Ada isian yang belum sesuai." };
  const { transformation, origin, ...d } = parsed.data;

  const supabase = await createClient();
  const content = d.content.replace(/\r\n?/g, "\n");
  const title = (d.title ?? "").trim();
  const { data, error } = await supabase
    .from("literary_works")
    .insert({
      space_id: ctx.spaceId,
      author_id: ctx.userId,
      ...d,
      title,
      content,
      origin,
      status: d.status ?? "draft",
    })
    .select("id")
    .single();
  if (error || !data) return { error: message(error) };

  if (content.trim()) {
    await supabase.from("literary_revisions").insert({
      work_id: data.id,
      author_id: ctx.userId,
      title,
      content,
      kind: origin === "rewrite" ? "rewrite" : "created",
      transformation: transformation ?? (origin === "muse" ? "The Muse" : null),
    });
  }
  refresh();
  return { ok: true, id: data.id };
}

const UpdateSchema = z.object({ id: Id, ...Meta });

/** Autosave: updates the work in place. Versions are explicit (saveVersion). */
export async function updateWork(input: z.input<typeof UpdateSchema>): Promise<WordsResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) return { error: "Ada isian yang belum sesuai." };
  const { id, ...patch } = parsed.data;
  if (patch.content !== undefined) patch.content = patch.content.replace(/\r\n?/g, "\n");
  const supabase = await createClient();
  const { error, data } = await supabase.from("literary_works").update(patch).eq("id", id).eq("author_id", ctx.userId).select("id");
  if (error) return { error: message(error) };
  if (!data?.length) return { error: "Karya ini tidak ditemukan." };
  // Only the list pages — the editor itself is already showing the truth.
  revalidatePath("/words");
  revalidatePath("/words/library");
  return { ok: true, id };
}

const VersionSchema = z.object({
  id: Id,
  title: z.string().max(WORDS_LIMITS.title).optional(),
  content: z.string().max(WORDS_LIMITS.content),
  kind: z.enum(["manual", "rewrite", "refine", "restore"]),
  transformation: z.string().max(80).nullable().optional(),
});

/**
 * Write the content AND record it as a revision — used when a rewrite or a
 * refined sentence is applied, a revision restored, or "save as version".
 */
export async function saveVersion(input: z.input<typeof VersionSchema>): Promise<WordsResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  const parsed = VersionSchema.safeParse(input);
  if (!parsed.success) return { error: "Ada isian yang belum sesuai." };
  const d = parsed.data;
  const content = d.content.replace(/\r\n?/g, "\n");
  const supabase = await createClient();
  const { data: work, error } = await supabase
    .from("literary_works")
    .update({ content, ...(d.title !== undefined ? { title: d.title.trim() } : {}) })
    .eq("id", d.id)
    .eq("author_id", ctx.userId)
    .select("title")
    .maybeSingle();
  if (error) return { error: message(error) };
  if (!work) return { error: "Karya ini tidak ditemukan." };
  const { error: revErr } = await supabase.from("literary_revisions").insert({
    work_id: d.id,
    author_id: ctx.userId,
    title: work.title,
    content,
    kind: d.kind,
    transformation: d.transformation ?? null,
  });
  if (revErr) return { error: message(revErr) };
  refresh(d.id);
  return { ok: true, id: d.id };
}

export async function restoreRevision(workId: string, revisionId: string): Promise<WordsResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  if (!Id.safeParse(workId).success || !Id.safeParse(revisionId).success) return { error: "Tidak ditemukan." };
  const supabase = await createClient();
  const { data: rev } = await supabase
    .from("literary_revisions")
    .select("title, content, created_at")
    .eq("id", revisionId)
    .eq("work_id", workId)
    .maybeSingle();
  if (!rev) return { error: "Versi itu tidak ditemukan." };
  return saveVersion({ id: workId, title: rev.title, content: rev.content, kind: "restore", transformation: null });
}

export async function setWorkFavorite(id: string, favorite: boolean): Promise<WordsResult> {
  return updateWorkFlag(id, { is_favorite: !!favorite });
}

async function updateWorkFlag(id: string, patch: { is_favorite?: boolean }): Promise<WordsResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  if (!Id.safeParse(id).success) return { error: "Tidak ditemukan." };
  const supabase = await createClient();
  const { error } = await supabase.from("literary_works").update(patch).eq("id", id).eq("author_id", ctx.userId);
  if (error) return { error: message(error) };
  refresh(id);
  return { ok: true };
}

/**
 * Delete a work. Its revisions go with it; anything already given keeps its
 * own snapshot, and kept lines keep their text (both just lose the link).
 */
export async function deleteWork(id: string): Promise<WordsResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  if (!Id.safeParse(id).success) return { error: "Tidak ditemukan." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("literary_works").delete().eq("id", id).eq("author_id", ctx.userId).select("id");
  if (error) return { error: message(error) };
  if (!data?.length) return { error: "Karya ini tidak ditemukan." };
  refresh();
  revalidatePath("/words/lines");
  return { ok: true };
}

/* --------------------------------------------------------------- lines -- */

const LineSchema = z.object({
  text: z.string().trim().min(1).max(WORDS_LIMITS.line),
  workId: Id.nullable().optional(),
  deliveryId: Id.nullable().optional(),
  sourceTitle: z.string().max(WORDS_LIMITS.title).nullable().optional(),
});

export async function saveLine(input: z.input<typeof LineSchema>): Promise<WordsResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  const parsed = LineSchema.safeParse(input);
  if (!parsed.success) return { error: "Pilih satu kalimat dulu (maks. 600 karakter)." };
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("literary_lines")
    .insert({
      space_id: ctx.spaceId,
      user_id: ctx.userId,
      text: d.text.replace(/\s*\n\s*/g, "\n"),
      work_id: d.workId ?? null,
      delivery_id: d.deliveryId ?? null,
      source_title: d.sourceTitle?.trim() || null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: message(error) };
  revalidatePath("/words/lines");
  revalidatePath("/words");
  if (d.workId) revalidatePath(`/words/w/${d.workId}`);
  if (d.deliveryId) revalidatePath(`/words/to-you/${d.deliveryId}`);
  return { ok: true, id: data.id };
}

export async function deleteLine(id: string): Promise<WordsResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  if (!Id.safeParse(id).success) return { error: "Tidak ditemukan." };
  const supabase = await createClient();
  const { error } = await supabase.from("literary_lines").delete().eq("id", id).eq("user_id", ctx.userId);
  if (error) return { error: message(error) };
  revalidatePath("/words/lines");
  revalidatePath("/words");
  return { ok: true };
}

/* ------------------------------------------------------------- to you -- */

const SendSchema = z.object({
  workId: Id,
  intro: z.string().trim().max(WORDS_LIMITS.intro).optional(),
  openWhen: z.enum(["miss_me", "tired", "reminder", "birthday", "courage", "right_time", "custom"]).nullable().optional(),
  openWhenLabel: z.string().trim().max(80).nullable().optional(),
  /** YYYY-MM-DD in the sender's own day; unlocks at `unlockTime` there. */
  unlockDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  unlockTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  replyTo: Id.nullable().optional(),
});

/**
 * Give a work to my partner: a SNAPSHOT of its current words. Editing the
 * work afterwards never changes what was given.
 */
export async function sendWork(input: z.input<typeof SendSchema>): Promise<WordsResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  const parsed = SendSchema.safeParse(input);
  if (!parsed.success) return { error: "Ada isian yang belum sesuai." };
  const d = parsed.data;
  if (d.openWhen === "custom" && !d.openWhenLabel) return { error: "Tulis dulu kapan ini boleh dibuka." };

  const partner = await getPartner(ctx.spaceId, ctx.userId);
  if (!partner) return { error: "Belum ada pasangan di ruang ini." };

  const supabase = await createClient();
  const { data: work } = await supabase
    .from("literary_works")
    .select("id, title, content, work_type, genre, mood, language")
    .eq("id", d.workId)
    .eq("author_id", ctx.userId)
    .maybeSingle();
  if (!work) return { error: "Karya ini tidak ditemukan." };
  if (!work.content.trim()) return { error: "Tulis sesuatu dulu sebelum dikirim. ♡" };

  let unlockAt: string | null = null;
  if (d.unlockDate) {
    unlockAt = zonedDateTimeToUTC(d.unlockDate, d.unlockTime ?? "07:00", ctx.profile.timezone);
    if (new Date(unlockAt).getTime() <= Date.now() + 60_000) return { error: "Waktu bukanya harus di masa depan." };
  }

  const { data, error } = await supabase
    .from("literary_deliveries")
    .insert({
      space_id: ctx.spaceId,
      work_id: work.id,
      sender_id: ctx.userId,
      recipient_id: partner.id,
      title: work.title.trim() || fallbackTitle(work.content),
      content: work.content,
      work_type: work.work_type,
      genre: work.genre,
      mood: work.mood,
      language: work.language,
      intro: d.intro || null,
      open_when: d.openWhen ?? null,
      open_when_label: d.openWhen === "custom" ? d.openWhenLabel : null,
      unlock_at: unlockAt,
      reply_to: d.replyTo ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: message(error) };

  // Something given isn't a draft any more.
  await supabase.from("literary_works").update({ status: "finished" }).eq("id", work.id).eq("author_id", ctx.userId);

  refresh(work.id);
  revalidatePath("/words/to-you");
  if (d.replyTo) revalidatePath(`/words/to-you/${d.replyTo}`);
  revalidatePath("/");
  return { ok: true, id: data.id };
}

/** Withdraw something I gave — only while it hasn't been opened. */
export async function withdrawDelivery(id: string): Promise<WordsResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  if (!Id.safeParse(id).success) return { error: "Tidak ditemukan." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("literary_deliveries")
    .delete()
    .eq("id", id)
    .eq("sender_id", ctx.userId)
    .is("opened_at", null)
    .select("id");
  if (error) return { error: message(error) };
  if (!data?.length) return { error: "Sudah dibuka — yang sudah dibaca tidak bisa ditarik lagi." };
  revalidatePath("/words/to-you");
  revalidatePath("/words");
  revalidatePath("/");
  return { ok: true };
}

export async function openDelivery(id: string): Promise<WordsResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  if (!Id.safeParse(id).success) return { error: "Tidak ditemukan." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("words_open", { p_delivery: id });
  if (error) return { error: message(error) };
  revalidatePath("/words/to-you");
  revalidatePath("/words");
  revalidatePath("/words/library");
  revalidatePath("/");
  return { ok: true };
}

export async function markDelivery(id: string, flags: { favorite?: boolean; archived?: boolean }): Promise<WordsResult> {
  const ctx = await getSpaceContext();
  if (!ctx) return { error: SESSION_GONE };
  if (!Id.safeParse(id).success) return { error: "Tidak ditemukan." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("words_mark", {
    p_delivery: id,
    p_favorite: flags.favorite ?? null,
    p_archived: flags.archived ?? null,
  });
  if (error) return { error: message(error) };
  revalidatePath(`/words/to-you/${id}`);
  revalidatePath("/words/to-you");
  revalidatePath("/words/library");
  return { ok: true };
}
