import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSpaceContext } from "@/lib/auth";
import {
  AI_ERROR_MESSAGES,
  WordsAiError,
  explainWords,
  generateWorks,
  refineSelection,
  rewriteWork,
  takeAiTicket,
} from "@/lib/words/ai";
import { REFINEMENTS, TRANSFORMATIONS, WORDS_LIMITS } from "@/lib/words/options";

/**
 * little words. — the one door to the literary companion.
 * POST { mode: "generate" | "rewrite" | "refine" | "explain", … }
 *
 * A route handler (not a server action) so the client can cancel with an
 * AbortController and so it gets its own generous time limit: a thoughtful
 * set of three poems plus a repair pass can take a minute or more.
 */
export const maxDuration = 300;

const Lang = z.enum(["id", "en"]);
const WorkTypeZ = z.enum(["poetry", "prose", "letter", "quote"]);
const Refinements = z.array(z.enum(REFINEMENTS.map((r) => r.key) as [string, ...string[]])).max(10);
const Transformation = z.enum(TRANSFORMATIONS.map((t) => t.key) as [string, ...string[]]).nullable().optional();

const Body = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("generate"),
    idea: z.string().trim().min(3).max(WORDS_LIMITS.idea),
    workType: WorkTypeZ,
    style: z.string().max(40).nullable().optional(),
    theme: z.string().max(40).nullable().optional(),
    customTheme: z.string().trim().max(WORDS_LIMITS.customTheme).nullable().optional(),
    genre: z.string().max(40).nullable().optional(),
    mood: z.string().max(40).nullable().optional(),
    depth: z.number().int().min(1).max(5),
    length: z.enum(["short", "medium", "long"]),
    language: Lang,
    pov: z.enum(["first", "second", "third", "free"]),
    explicitness: z.enum(["explicit", "balanced", "implicit"]),
    alternatives: z.number().int().min(1).max(3),
    explain: z.boolean(),
    reference: z.string().trim().max(WORDS_LIMITS.idea).nullable().optional(),
  }),
  z.object({
    mode: z.literal("rewrite"),
    text: z.string().trim().min(3).max(WORDS_LIMITS.aiInput),
    workType: WorkTypeZ,
    transformation: Transformation,
    refinements: Refinements,
    depth: z.number().int().min(1).max(5).nullable().optional(),
    language: Lang,
    keepStructure: z.boolean(),
    instruction: z.string().trim().max(WORDS_LIMITS.instruction).nullable().optional(),
    explain: z.boolean(),
  }),
  z.object({
    mode: z.literal("refine"),
    text: z.string().max(WORDS_LIMITS.aiInput),
    selection: z.string().trim().min(1).max(2000),
    transformation: Transformation,
    refinements: Refinements,
    language: Lang,
    instruction: z.string().trim().max(WORDS_LIMITS.instruction).nullable().optional(),
  }),
  z.object({
    mode: z.literal("explain"),
    text: z.string().trim().min(3).max(WORDS_LIMITS.aiInput),
    language: Lang,
  }),
]);

function fail(code: keyof typeof AI_ERROR_MESSAGES, status: number) {
  return NextResponse.json({ error: AI_ERROR_MESSAGES[code], code }, { status });
}

export async function POST(request: NextRequest) {
  const ctx = await getSpaceContext();
  if (!ctx) return NextResponse.json({ error: "Sesi kamu habis. Masuk lagi ya." }, { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail("invalid", 400);
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    const tooLong = parsed.error.issues.some((i) => i.code === "too_big");
    return fail(tooLong ? "too_long" : "invalid", 400);
  }
  const body = parsed.data;
  const signal = request.signal;

  try {
    await takeAiTicket(ctx.userId, body.mode);
    switch (body.mode) {
      case "generate": {
        const works = await generateWorks(body, signal);
        return NextResponse.json({ works });
      }
      case "rewrite": {
        const result = await rewriteWork(body, signal);
        return NextResponse.json({ result });
      }
      case "refine": {
        if (!body.text.includes(body.selection)) return fail("invalid", 400);
        const result = await refineSelection(body, signal);
        return NextResponse.json({ result });
      }
      case "explain": {
        const explanation = await explainWords(body.text, body.language, signal);
        return NextResponse.json({ explanation });
      }
    }
  } catch (err) {
    const code = err instanceof WordsAiError ? err.code : "unknown";
    const status =
      code === "no_key" ? 503 : code === "cap" || code === "rate_limited" ? 429 : code === "refusal" ? 422 : code === "aborted" ? 499 : 502;
    return fail(code, status);
  }
}
