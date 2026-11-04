import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
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
 * little words. — the literary companion, server-side only.
 *
 * - The API key never leaves the server (`serverEnv`, `server-only`).
 * - Only the text the writer typed into the current box is sent. Nothing
 *   else from the app — no diary, no letters, no chats — ever is.
 * - Every result passes the deterministic checks in quality.ts; anything
 *   that fails gets ONE targeted repair request before it's shown.
 * - A soft cap (literary_ai_usage, no text stored) keeps a bug or a stuck
 *   button from running up a bill.
 */

const MODEL = "claude-opus-5-5";

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
  no_key: "Sang Muse belum dinyalakan — ANTHROPIC_API_KEY belum diatur di server.",
  cap: "Hari ini sudah banyak sekali kata yang dicari. Istirahat sebentar, besok lanjut lagi ya. ♡",
  refusal: "Untuk tulisan ini aku tidak bisa membantu. Coba ubah sedikit gagasannya ya.",
  too_long: "Tulisannya terlalu panjang untuk diolah sekaligus. Coba persingkat atau pilih bagiannya.",
  rate_limited: "Terlalu banyak permintaan sekaligus. Tunggu sebentar lalu coba lagi.",
  overloaded: "Sang Muse sedang sibuk sekali. Coba lagi sebentar lagi.",
  network: "Koneksinya terputus. Coba lagi ya.",
  aborted: "Dibatalkan.",
  invalid: "Ada yang belum lengkap. Periksa lagi isiannya.",
  unknown: "Ada yang salah saat mencari kata. Coba lagi ya.",
};

let cached: Anthropic | null = null;
function client(): Anthropic {
  const apiKey = serverEnv.anthropicApiKey;
  if (!apiKey) throw new WordsAiError("no_key");
  cached ??= new Anthropic({ apiKey, timeout: 240_000, maxRetries: 1 });
  return cached;
}

export function aiConfigured(): boolean {
  return !!serverEnv.anthropicApiKey;
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

async function callStructured<S extends z.ZodType>(
  schema: S,
  brief: string,
  opts: { effort: Effort; maxTokens?: number; signal?: AbortSignal },
): Promise<z.infer<S>> {
  try {
    const res = await client().beta.messages.parse(
      {
        model: MODEL,
        max_tokens: opts.maxTokens ?? 16000,
        // Server-side fallback: if a safety classifier declines, the API
        // retries on a fallback model in the same call.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: brief }],
        output_config: { effort: opts.effort, format: betaZodOutputFormat(schema) },
      },
      { signal: opts.signal },
    );
    if (res.stop_reason === "refusal") throw new WordsAiError("refusal");
    if (res.stop_reason === "max_tokens") throw new WordsAiError("too_long");
    if (!res.parsed_output) throw new WordsAiError("unknown");
    return res.parsed_output as z.infer<S>;
  } catch (err) {
    throw toAiError(err);
  }
}

function toAiError(err: unknown): WordsAiError {
  if (err instanceof WordsAiError) return err;
  if (err instanceof Anthropic.APIUserAbortError) return new WordsAiError("aborted");
  if (err instanceof Anthropic.RateLimitError) return new WordsAiError("rate_limited");
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    console.error("[words] Anthropic auth failed — check ANTHROPIC_API_KEY");
    return new WordsAiError("no_key");
  }
  if (err instanceof Anthropic.BadRequestError) {
    console.error("[words] bad request:", err.message);
    return new WordsAiError("unknown");
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError || err instanceof Anthropic.APIConnectionError) {
    return new WordsAiError("network");
  }
  if (err instanceof Anthropic.InternalServerError) return new WordsAiError("overloaded");
  if (err instanceof Anthropic.APIError) {
    if (err.status === 529) return new WordsAiError("overloaded");
    console.error("[words] API error", err.status, err.message);
    return new WordsAiError("unknown");
  }
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

function clean(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
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
