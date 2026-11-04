"use client";

import type { Issue } from "@/lib/words/quality";

/**
 * Browser side of the literary companion: one POST to /api/words/ai, with
 * cancellation. Types mirror lib/words/ai.ts (which is server-only).
 */

export type AiReview = {
  relevance: boolean;
  genre: boolean;
  coherence: boolean;
  natural: boolean;
  original: boolean;
  note: string;
};

export type MuseWork = {
  title: string;
  content: string;
  approach: string;
  character: string;
  explanation: string;
  review: AiReview;
  issues: Issue[];
  repaired: boolean;
};

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

export type Explanation = {
  overall: string;
  techniques: { technique: string; quote: string; meaning: string }[];
  diction: { word: string; why: string }[];
  symbols: { symbol: string; meaning: string }[];
  subtext: string;
  structure: string;
  strongest: { quote: string; why: string }[];
};

export class AiCallError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

export async function callWordsAi<T>(body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api/words/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw new AiCallError("Dibatalkan.", "aborted");
    throw new AiCallError("Koneksinya terputus. Coba lagi ya.", "network");
  }
  let json: Record<string, unknown> = {};
  try {
    json = await res.json();
  } catch {
    // A platform timeout returns HTML, not JSON.
    throw new AiCallError(
      res.status === 504 ? "Sang Muse terlalu lama berpikir. Coba lagi, atau pilih tulisan yang lebih pendek." : "Ada yang salah. Coba lagi ya.",
      "unknown",
    );
  }
  if (!res.ok) throw new AiCallError(String(json.error ?? "Ada yang salah. Coba lagi ya."), String(json.code ?? "unknown"));
  return json as T;
}
