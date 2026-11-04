"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WordsLanguage } from "@/lib/supabase/database.types";
import { AiCallError, callWordsAi, type Explanation } from "./ai-client";

/**
 * Explain the Words — the companion reads the piece back to its writer:
 * overall meaning, the techniques actually present, diction, symbols,
 * subtext, how it moves, and the lines with the most force. On demand only.
 */
export function ExplainPanel({
  text,
  language,
  initial,
  className,
  compact = false,
}: {
  text: string;
  language: WordsLanguage;
  initial?: Explanation | null;
  className?: string;
  compact?: boolean;
}) {
  const [data, setData] = useState<Explanation | null>(initial ?? null);
  const [explainedText, setExplainedText] = useState<string | null>(initial ? text : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  async function run() {
    if (!text.trim()) return;
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setBusy(true);
    setError(null);
    try {
      const res = await callWordsAi<{ explanation: Explanation }>({ mode: "explain", text, language }, ctl.signal);
      setData(res.explanation);
      setExplainedText(text);
    } catch (err) {
      if (err instanceof AiCallError && err.code === "aborted") return;
      setError(err instanceof Error ? err.message : "Ada yang salah.");
    } finally {
      setBusy(false);
    }
  }

  const stale = data && explainedText !== text;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {!data || stale ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="soft" size="sm" onClick={run} disabled={busy || !text.trim()}>
            {busy ? "Membaca pelan-pelan…" : stale ? "📖 Jelaskan lagi" : "📖 Explain the Words"}
          </Button>
          {busy ? (
            <button type="button" className="text-xs text-ink-faint underline" onClick={() => abort.current?.abort()}>
              batal
            </button>
          ) : null}
          {!busy && !data && !compact ? (
            <p className="text-xs text-ink-faint">Makna, metafora, diksi, simbol, dan pesan tersiratnya.</p>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {data ? <ExplanationView data={data} dim={!!stale} /> : null}
    </div>
  );
}

export function ExplanationView({ data, dim }: { data: Explanation; dim?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-5 rounded-2xl border border-rule bg-paper-2/50 p-5 text-[15px]", dim && "opacity-60")}>
      <Section title="Makna keseluruhan">
        <p className="text-ink">{data.overall}</p>
      </Section>
      {data.techniques.length ? (
        <Section title="Teknik & metafora">
          <ul className="flex flex-col gap-3">
            {data.techniques.map((t, i) => (
              <li key={i}>
                <p className="font-mono text-[11px] uppercase tracking-wider text-accent-ink">{t.technique}</p>
                <p className="mt-0.5 font-display italic text-ink">“{t.quote}”</p>
                <p className="mt-0.5 text-ink-soft">{t.meaning}</p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {data.diction.length ? (
        <Section title="Pilihan kata">
          <ul className="flex flex-col gap-2">
            {data.diction.map((d, i) => (
              <li key={i} className="text-ink-soft">
                <span className="font-display text-ink">“{d.word}”</span> — {d.why}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {data.symbols.length ? (
        <Section title="Simbol">
          <ul className="flex flex-col gap-2">
            {data.symbols.map((s, i) => (
              <li key={i} className="text-ink-soft">
                <span className="font-display text-ink">{s.symbol}</span> — {s.meaning}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {data.subtext ? (
        <Section title="Yang tersirat">
          <p className="text-ink-soft">{data.subtext}</p>
        </Section>
      ) : null}
      {data.structure ? (
        <Section title="Alur & hubungan antarbagian">
          <p className="text-ink-soft">{data.structure}</p>
        </Section>
      ) : null}
      {data.strongest.length ? (
        <Section title="Baris paling kuat">
          <ul className="flex flex-col gap-3">
            {data.strongest.map((s, i) => (
              <li key={i} className="border-l-2 border-accent/60 pl-3">
                <p className="font-display italic text-ink">“{s.quote}”</p>
                <p className="mt-0.5 text-ink-soft">{s.why}</p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">{title}</p>
      {children}
    </section>
  );
}
