import "server-only";
import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { WordsAiKind, WordsLanguage, WorkType } from "@/lib/supabase/database.types";
import { WORDS_LIMITS } from "./options";
import {
  SYSTEM_PROMPT,
  buildExplainBrief,
  buildMuseBrief,
  buildRefineSelectionBrief,
  buildRepairBrief,
  buildRewriteBrief,
  type MuseInput,
  type RefineSelectionInput,
  type RewriteInput,
} from "./prompts";
import { checkAlternatives, checkPiece, needsRepair, type Issue } from "./quality";

/**
 * little words. — the literary companion, server-side only (Google Gemini).
 *
 * - The API key never leaves the server (`serverEnv`, `server-only`).
 * - Only the text the writer typed into the current box is sent. Nothing
 *   else from the app — no diary, no letters, no chats — ever is.
 * - Every result passes the deterministic checks in quality.ts; anything
 *   that fails gets ONE targeted repair request before it's shown.
 * - A soft cap (literary_ai_usage, no text stored) keeps a bug or a stuck
 *   button from burning the free-tier quota in one evening.
 * - Model: GEMINI_MODEL, default the stable Flash model (has a free tier).
 */

const DEFAULT_MODEL = "gemini-3.8-flash";
/** Tried in order when the one before is busy or its free quota is used up. */
const FALLBACK_MODELS = ["gemini-3.6-flash", "gemini-2.5-flash"];

function modelChain(): string[] {
  const first = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  return [first, ...FALLBACK_MODELS.filter((m) => m !== first)];
}

export type WordsAiErrorCode =
  | "no_key"
  | "cap"
  | "refusal"
  | "too_long"
  | "rate_limited"
  | "overloaded"
  | "network"
  | "aborted"
  | "invalid"
  | "unknown";

export class WordsAiError extends Error {
  constructor(public code: WordsAiErrorCode) {
    super(code);
  }
}

export const AI_ERROR_MESSAGES: Record<WordsAiErrorCode, string> = {
  no_key: "Sang Muse belum dinyalakan — GEMINI_API_KEY belum diatur di server.",
  cap: "Hari ini sudah banyak sekali kata yang dicari. Istirahat sebentar, besok lanjut lagi ya. ♡",
  refusal: "Untuk tulisan ini aku tidak bisa membantu. Coba ubah sedikit gagasannya ya.",
  too_long: "Tulisannya terlalu panjang untuk diolah sekaligus. Coba persingkat atau pilih bagiannya.",
  rate_limited: "Kuota gratis Sang Muse sedang habis. Coba lagi sebentar lagi — atau besok. ♡",
  overloaded: "Sang Muse sedang sibuk sekali. Coba lagi sebentar lagi.",
  network: "Koneksinya terputus. Coba lagi ya.",
  aborted: "Dibatalkan.",
  invalid: "Ada yang belum lengkap. Periksa lagi isiannya.",
  unknown: "Ada yang salah saat mencari kata. Coba lagi ya.",
};

let cached: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  const apiKey = serverEnv.geminiApiKey;
  if (!apiKey) throw new WordsAiError("no_key");
  cached ??= new GoogleGenAI({ apiKey });
  return cached;
}

export function aiConfigured(): boolean {
  return !!serverEnv.geminiApiKey;
}

/* --------------------------------------------------------------- schemas -- */

const Review = z.object({
  relevance: z.boolean(),
  genre: z.boolean(),
  coherence: z.boolean(),
  natural: z.boolean(),
  original: z.boolean(),
  note: z.string(),
});
export type AiReview = z.infer<typeof Review>;

const MuseOut = z.object({
  works: z.array(
    z.object({
      title: z.string(),
      content: z.string(),
      approach: z.string(),
      character: z.string(),
      explanation: z.string(),
      review: Review,
    }),
  ),
});

const RewriteOut = z.object({
  title: z.string(),
  revised: z.string(),
  changes: z.array(z.object({ aspect: z.string(), before: z.string(), after: z.string(), why: z.string() })),
  meaning_kept: z.string(),
  explanation: z.string(),
  review: Review,
});

const RefineOut = z.object({ replacement: z.string(), why: z.string() });

const RepairOut = z.object({ title: z.string(), content: z.string() });

const ExplainOut = z.object({
  overall: z.string(),
  techniques: z.array(z.object({ technique: z.string(), quote: z.string(), meaning: z.string() })),
  diction: z.array(z.object({ word: z.string(), why: z.string() })),
  symbols: z.array(z.object({ symbol: z.string(), meaning: z.string() })),
  subtext: z.string(),
  structure: z.string(),
  strongest: z.array(z.object({ quote: z.string(), why: z.string() })),
});
export type Explanation = z.infer<typeof ExplainOut>;

/* ------------------------------------------------------------ the call -- */

type Effort = "low" | "medium" | "high";
const THINKING: Record<Effort, ThinkingLevel> = {
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

/** The zod schema as plain JSON Schema (minus the "$schema" header Gemini doesn't need). */
function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _drop, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  void _drop;
  return rest;
}

/**
 * One structured request: the zod schema becomes the JSON schema the model
 * must answer in, and the answer is validated against it again here.
 */
export async function callStructured<S extends z.ZodType>(
  schema: S,
  brief: string,
  opts: { effort: Effort; maxTokens?: number; signal?: AbortSignal; system?: string },
): Promise<z.infer<S>> {
  let text: string | undefined;
  const models = modelChain();
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const res = await client().models.generateContent({
        model,
        contents: brief,
        config: {
          systemInstruction: opts.system ?? SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema(schema),
          maxOutputTokens: opts.maxTokens ?? 16000,
          // Gemini 2.5 takes a token budget (-1 = dynamic); 3.x takes a level.
          thinkingConfig: model.startsWith("gemini-2.") ? { thinkingBudget: -1 } : { thinkingLevel: THINKING[opts.effort] },
          abortSignal: opts.signal,
          httpOptions: { timeout: 240_000 },
        },
      });
      if (res.promptFeedback?.blockReason) throw new WordsAiError("refusal");
      const finish = res.candidates?.[0]?.finishReason;
      if (finish === "MAX_TOKENS") throw new WordsAiError("too_long");
      if (finish && finish !== "STOP") {
        // SAFETY / RECITATION / PROHIBITED_CONTENT / BLOCKLIST / SPII / OTHER…
        console.error("[words] Gemini stopped:", finish);
        throw new WordsAiError("refusal");
      }
      text = res.text;
      break;
    } catch (err) {
      const e = toAiError(err, opts.signal);
      // Busy (503/5xx) or out of free quota (429, counted per model): the
      // next model in the chain usually still has room.
      if ((e.code === "overloaded" || e.code === "rate_limited") && i < models.length - 1) {
        console.warn(`[words] ${model} ${e.code} — falling back to ${models[i + 1]}`);
        continue;
      }
      throw e;
    }
  }
  if (!text) throw new WordsAiError("unknown");
  try {
    return schema.parse(JSON.parse(text)) as z.infer<S>;
  } catch {
    console.error("[words] Gemini answer did not match the schema");
    throw new WordsAiError("unknown");
  }
}

function toAiError(err: unknown, signal?: AbortSignal): WordsAiError {
  if (err instanceof WordsAiError) return err;
  if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) return new WordsAiError("aborted");
  if (err instanceof ApiError) {
    if (err.status === 429) return new WordsAiError("rate_limited");
    if (err.status === 401 || err.status === 403) {
      console.error("[words] Gemini auth failed — check GEMINI_API_KEY");
      return new WordsAiError("no_key");
    }
    if (err.status === 400) {
      console.error("[words] Gemini bad request:", err.message);
      return new WordsAiError("unknown");
    }
    if (err.status >= 500) return new WordsAiError("overloaded");
    console.error("[words] Gemini API error", err.status, err.message);
    return new WordsAiError("unknown");
  }
  if (err instanceof TypeError) return new WordsAiError("network");
  console.error("[words] unexpected", err);
  return new WordsAiError("unknown");
}

/* -------------------------------------------------------------- the cap -- */

/**
 * Count + record one request. Fails open if the usage table isn't there yet
 * (migration not run): the cap is a guard rail, not a gate.
 */
export async function takeAiTicket(userId: string, kind: WordsAiKind): Promise<void> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count, error } = await supabase
    .from("literary_ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if (!error && (count ?? 0) >= WORDS_LIMITS.aiPerDay) throw new WordsAiError("cap");
  if (!error) await supabase.from("literary_ai_usage").insert({ user_id: userId, kind });
}

/* -------------------------------------------------------------- helpers -- */

const NL = String.fromCharCode(10);
/** CRLF / CR / U+2028 line separator / U+0085 NEL. */
const LINE_BREAKS = new RegExp(`${String.fromCharCode(13)}${String.fromCharCode(10)}?|[${String.fromCharCode(0x2028)}${String.fromCharCode(0x85)}]`, "g");
const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), "g");

function clean(text: string): string {
  return text
    // Every kind of line break becomes "\n": CRLF/CR, the Unicode line and
    // paragraph separators and NEL (invisible on screen, so a poem's lines
    // would otherwise run together), and a literal "\n" the model escaped twice.
    .replace(LINE_BREAKS, NL)
    .replace(PARAGRAPH_SEPARATOR, NL + NL)
    .replace(/\\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, WORDS_LIMITS.content);
}

function cleanTitle(title: string): string {
  return title.replace(/^["“'‘]+|["”'’]+$/g, "").replace(/\s+/g, " ").trim().slice(0, WORDS_LIMITS.title);
}

/* ------------------------------------------------------------- generate -- */

export type MuseWork = {
  title: string;
  content: string;
  approach: string;
  character: string;
  explanation: string;
  review: AiReview;
  /** What the deterministic checks still see after any repair. */
  issues: Issue[];
  repaired: boolean;
};

export async function generateWorks(input: MuseInput, signal?: AbortSignal): Promise<MuseWork[]> {
  const brief = buildMuseBrief(input);
  const out = await callStructured(MuseOut, brief, { effort: "high", signal });
  const n = Math.min(3, Math.max(1, input.alternatives));
  const works: MuseWork[] = out.works.slice(0, n).map((w) => ({
    title: cleanTitle(w.title),
    content: clean(w.content),
    approach: w.approach.trim(),
    character: w.character.trim(),
    explanation: w.explanation.trim(),
    review: w.review,
    issues: [],
    repaired: false,
  }));
  if (!works.length) throw new WordsAiError("unknown");

  const ctx = { workType: input.workType, language: input.language, pov: input.pov, length: input.length };
  const firstPass = checkAlternatives(
    works.map((w) => w.content),
    ctx,
  );

  // One targeted repair per piece that needs it, in parallel. A repair is
  // kept only if it actually checks out better than what it replaces.
  await Promise.all(
    works.map(async (w, i) => {
      w.issues = firstPass[i];
      if (!needsRepair(firstPass[i])) return;
      try {
        const fixed = await callStructured(
          RepairOut,
          buildRepairBrief({ piece: w, issues: firstPass[i], context: brief }),
          { effort: "medium", signal },
        );
        const content = clean(fixed.content);
        const others = works.filter((_, j) => j !== i).map((o) => o.content);
        const after = checkAlternatives([...others, content], ctx).at(-1) ?? [];
        const score = (iss: Issue[]) => iss.filter((x) => x.severity === "repair").length;
        if (content && score(after) < score(firstPass[i])) {
          w.content = content;
          w.title = cleanTitle(fixed.title) || w.title;
          w.issues = after;
          w.repaired = true;
        }
      } catch (err) {
        // A failed repair never loses the original result.
        if (err instanceof WordsAiError && err.code === "aborted") throw err;
      }
    }),
  );

  return works;
}

/* -------------------------------------------------------------- rewrite -- */

export type RewriteResult = {
  title: string;
  revised: string;
  changes: { aspect: string; before: string; after: string; why: string }[];
  meaningKept: string;
  explanation: string;
  review: AiReview;
  issues: Issue[];
  repaired: boolean;
};

export async function rewriteWork(
  input: RewriteInput & { workType: WorkType },
  signal?: AbortSignal,
): Promise<RewriteResult> {
  const brief = buildRewriteBrief(input);
  const out = await callStructured(RewriteOut, brief, { effort: "high", signal });
  const result: RewriteResult = {
    title: cleanTitle(out.title),
    revised: clean(out.revised),
    changes: out.changes.slice(0, 8),
    meaningKept: out.meaning_kept.trim(),
    explanation: out.explanation.trim(),
    review: out.review,
    issues: [],
    repaired: false,
  };
  // "Expand into Prose" legitimately changes the form.
  const workType: WorkType = input.transformation === "expand" ? "prose" : input.workType;
  const ctx = { workType, language: input.language, original: input.text };
  const issues = checkPiece(result.revised, ctx);
  result.issues = issues;
  if (needsRepair(issues)) {
    try {
      const fixed = await callStructured(
        RepairOut,
        buildRepairBrief({ piece: { title: result.title, content: result.revised }, issues, original: input.text, context: brief }),
        { effort: "medium", signal },
      );
      const content = clean(fixed.content);
      const after = checkPiece(content, ctx);
      const score = (iss: Issue[]) => iss.filter((x) => x.severity === "repair").length;
      if (content && score(after) < score(issues)) {
        result.revised = content;
        result.issues = after;
        result.repaired = true;
      }
    } catch (err) {
      if (err instanceof WordsAiError && err.code === "aborted") throw err;
    }
  }
  return result;
}

export async function refineSelection(input: RefineSelectionInput, signal?: AbortSignal) {
  const out = await callStructured(RefineOut, buildRefineSelectionBrief(input), { effort: "medium", maxTokens: 8000, signal });
  // Keep the selection's own leading/trailing whitespace shape.
  const replacement = out.replacement.replace(/\r\n?/g, "\n").trim();
  if (!replacement) throw new WordsAiError("unknown");
  return { replacement, why: out.why.trim() };
}

/* -------------------------------------------------------------- explain -- */

export async function explainWords(text: string, language: WordsLanguage, signal?: AbortSignal): Promise<Explanation> {
  return callStructured(ExplainOut, buildExplainBrief(text, language), { effort: "medium", maxTokens: 10000, signal });
}
