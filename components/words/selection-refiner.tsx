"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { expandToWords, spliceSelection } from "@/lib/words/logic";
import { TRANSFORMATIONS, WORDS_LIMITS } from "@/lib/words/options";
import type { WordsLanguage } from "@/lib/supabase/database.types";
import { AiCallError, callWordsAi } from "./ai-client";
import { DiffView } from "./diff-view";

/**
 * Rewrite Selected Sentence. Wraps a textarea: select a sentence or a
 * paragraph, refine only that, see before/after, then accept (spliced back
 * exactly where it was) or discard. The rest of the writing is untouched.
 */
export function useTextareaSelection() {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [sel, setSel] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const onSelect = () => {
    const el = ref.current;
    if (el) setSel({ start: el.selectionStart, end: el.selectionEnd });
  };
  return { ref, sel, onSelect, setSel };
}

type Proposal = { start: number; end: number; before: string; replacement: string; why: string };

export function SelectionRefiner({
  text,
  sel,
  onApply,
  language,
  disabled,
  defaultTransformation,
  refinements = [],
}: {
  text: string;
  sel: { start: number; end: number };
  onApply: (next: string, info: { before: string; after: string }) => void;
  language: WordsLanguage;
  disabled?: boolean;
  defaultTransformation?: string | null;
  refinements?: string[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [how, setHow] = useState<string>(defaultTransformation ?? "");
  const [instruction, setInstruction] = useState("");
  const abort = useRef<AbortController | null>(null);

  const range = expandToWords(text, sel.start, sel.end);
  const selected = text.slice(range.start, range.end);
  const hasSel = selected.trim().length > 0;

  async function refine() {
    if (!hasSel) return;
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setBusy(true);
    setError(null);
    try {
      const res = await callWordsAi<{ result: { replacement: string; why: string } }>(
        {
          mode: "refine",
          text: text.slice(0, WORDS_LIMITS.aiInput),
          selection: selected,
          transformation: how || null,
          refinements,
          language,
          instruction: instruction.trim() || null,
        },
        ctl.signal,
      );
      setProposal({ start: range.start, end: range.end, before: selected, ...res.result });
    } catch (err) {
      if (err instanceof AiCallError && err.code === "aborted") return;
      setError(err instanceof Error ? err.message : "Ada yang salah.");
    } finally {
      setBusy(false);
    }
  }

  if (proposal) {
    const stillThere = text.slice(proposal.start, proposal.end) === proposal.before;
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-accent/50 bg-blush/20 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent-ink">Bagian terpilih</p>
        <DiffView original={proposal.before} revised={proposal.replacement} leftLabel="Sebelum" rightLabel="Sesudah" />
        {proposal.why ? <p className="text-sm text-ink-soft">{proposal.why}</p> : null}
        {!stillThere ? <p className="text-sm text-danger">Teksnya sudah berubah sejak bagian ini dipilih — pilih ulang ya.</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={!stillThere}
            onClick={() => {
              onApply(spliceSelection(text, proposal.start, proposal.end, proposal.replacement), {
                before: proposal.before,
                after: proposal.replacement,
              });
              setProposal(null);
            }}
          >
            ✓ Pakai ini
          </Button>
          <Button type="button" size="sm" variant="soft" onClick={refine} disabled={busy || !stillThere}>
            {busy ? "Mencari lagi…" : "Coba lagi"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setProposal(null)}>
            Buang
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-rule p-3">
      {hasSel ? (
        <>
          <p className="text-xs text-ink-faint">
            Terpilih: <span className="font-display italic text-ink-soft">“{selected.length > 120 ? `${selected.slice(0, 120)}…` : selected}”</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={how}
              onChange={(e) => setHow(e.target.value)}
              className="h-9 rounded-full border border-rule bg-paper px-3 text-sm text-ink-soft"
              aria-label="Cara menyempurnakan"
            >
              <option value="">Sempurnakan saja</option>
              {TRANSFORMATIONS.filter((t) => t.key !== "expand").map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value.slice(0, WORDS_LIMITS.instruction))}
              placeholder="catatan (opsional)"
              className="h-9 min-w-0 flex-1 rounded-full border border-rule bg-paper px-3 text-sm"
            />
            <Button type="button" size="sm" onClick={refine} disabled={busy || disabled}>
              {busy ? "Menimbang…" : "🪶 Sempurnakan bagian ini"}
            </Button>
            {busy ? (
              <button type="button" onClick={() => abort.current?.abort()} className="text-xs text-ink-faint underline">
                batal
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <p className="text-xs text-ink-faint">Pilih (blok) satu kalimat atau paragraf di atas untuk menyempurnakan bagian itu saja.</p>
      )}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
