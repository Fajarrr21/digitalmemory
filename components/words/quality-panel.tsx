"use client";

import { useState } from "react";
import { QUALITY_ROWS, type Issue } from "@/lib/words/quality";
import type { AiReview } from "./ai-client";

/**
 * The quality check, made visible: the nine criteria of the brief, each ✓ or
 * ·, from two sources — the deterministic checks (cliché, repetition, POV,
 * shape, language, sameness) and the companion's own honest review
 * (relevance, genre, coherence, naturalness, originality).
 */
export function QualityPanel({ issues, review, repaired }: { issues: Issue[]; review?: AiReview | null; repaired?: boolean }) {
  const [open, setOpen] = useState(false);
  const fromReview: Record<string, boolean | undefined> = {
    relevance: review?.relevance,
    genre: review?.genre,
    coherence: review?.coherence,
    natural: review?.natural,
    original: review?.original,
  };
  const rows = QUALITY_ROWS.map((r) => {
    const hit = issues.filter((i) => r.codes.includes(i.code));
    const reviewOk = fromReview[r.key];
    const ok = hit.length === 0 && reviewOk !== false;
    return { ...r, ok, hit };
  });
  const passed = rows.filter((r) => r.ok).length;
  const notes = issues.filter((i) => i.severity === "note");

  return (
    <div className="text-xs text-ink-faint">
      <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1.5 hover:text-ink-soft">
        <span className={passed === rows.length ? "text-accent-ink" : ""}>✓ {passed}/{rows.length} pemeriksaan kualitas</span>
        {repaired ? <span>· sudah diperhalus sekali</span> : null}
        <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>
      {open ? (
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {rows.map((r) => (
            <li key={r.key} className="flex gap-1.5">
              <span className={r.ok ? "text-accent-ink" : "text-ink-soft"}>{r.ok ? "✓" : "·"}</span>
              <span>
                {r.label}
                {r.hit.length ? <span className="text-ink-soft"> — {r.hit[0].message}</span> : null}
              </span>
            </li>
          ))}
          {notes.length && !rows.some((r) => r.hit.length) ? (
            <li className="sm:col-span-2 text-ink-soft">Catatan: {notes.map((n) => n.message).join(" ")}</li>
          ) : null}
          {review?.note ? <li className="sm:col-span-2 italic">“{review.note}”</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
