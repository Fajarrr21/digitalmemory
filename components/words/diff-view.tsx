"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { diffWords, keptRatio } from "@/lib/words/logic";

/**
 * Compare Versions — Original Writing beside Refined Writing, with the words
 * that changed softly marked: struck through on the left, highlighted on the
 * right. Side by side on a wide screen, stacked on a phone.
 */
export function DiffView({
  original,
  revised,
  leftLabel = "Original Writing",
  rightLabel = "Refined Writing",
  highlight = true,
}: {
  original: string;
  revised: string;
  leftLabel?: string;
  rightLabel?: string;
  highlight?: boolean;
}) {
  const parts = useMemo(() => diffWords(original, revised), [original, revised]);
  const kept = useMemo(() => Math.round(keptRatio(original, revised) * 100), [original, revised]);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-3 md:grid-cols-2">
        <Pane label={leftLabel}>
          {parts
            .filter((p) => p.type !== "add")
            .map((p, i) =>
              p.type === "del" && highlight ? (
                <span key={i} className="rounded-sm bg-ink-faint/15 text-ink-faint line-through decoration-ink-faint/50">
                  {p.text}
                </span>
              ) : (
                <span key={i}>{p.text}</span>
              ),
            )}
        </Pane>
        <Pane label={rightLabel} accent>
          {parts
            .filter((p) => p.type !== "del")
            .map((p, i) =>
              p.type === "add" && highlight ? (
                <mark key={i} className="rounded-sm bg-blush/70 text-ink">
                  {p.text}
                </mark>
              ) : (
                <span key={i}>{p.text}</span>
              ),
            )}
        </Pane>
      </div>
      <p className="font-mono text-[11px] text-ink-faint">{kept}% kata aslimu tetap tinggal</p>
    </div>
  );
}

function Pane({ label, accent, children }: { label: string; accent?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-2xl border p-4", accent ? "border-accent/50 bg-paper" : "border-rule bg-paper-2/40")}>
      <p className={cn("mb-2 font-mono text-[10px] uppercase tracking-[0.18em]", accent ? "text-accent-ink" : "text-ink-faint")}>{label}</p>
      <div className="whitespace-pre-wrap font-display text-[15.5px] leading-[1.8] text-ink">{children}</div>
    </div>
  );
}
