"use client";

import { useActionState, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ColoringSvg, type Fills } from "@/components/coloring/coloring-svg";
import { formatDateLabel } from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  COLORING_PALETTE,
  COLORING_TEMPLATES,
  getTemplate,
  randomTemplate,
  type ColoringTemplate,
} from "./coloring-config";
import { saveColoring, type ColoringState } from "./actions";

type Existing = { templateId: string; fills: Fills } | null;

/**
 * "How Today Felt" — the optional coloring step after a rating is saved.
 * Colour a random line-art scene, preview it as a little memory card, then save
 * it to the diary (attached to today's rating). No WhatsApp here by design.
 */
export function HowTodayFelt({
  ratingId,
  score,
  dateISO,
  existing = null,
  onClose,
}: {
  ratingId: string;
  score: number;
  dateISO: string;
  existing?: Existing;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const [template, setTemplate] = useState<ColoringTemplate>(
    () => (existing ? getTemplate(existing.templateId) : null) ?? randomTemplate(),
  );

  const [fills, setFills] = useState<Fills>(existing?.fills ?? {});
  const [past, setPast] = useState<Fills[]>([]);
  const [future, setFuture] = useState<Fills[]>([]);
  const [color, setColor] = useState<string>(COLORING_PALETTE[0].value);
  const [eraser, setEraser] = useState(false);
  const [phase, setPhase] = useState<"coloring" | "card">("coloring");
  const [state, save, saving] = useActionState<ColoringState, FormData>(saveColoring, {});

  function commit(next: Fills) {
    setPast((p) => [...p, fills]);
    setFuture([]);
    setFills(next);
  }

  function paint(regionId: string) {
    const next = { ...fills };
    if (eraser) {
      if (!(regionId in next)) return;
      delete next[regionId];
    } else {
      if (next[regionId] === color) return;
      next[regionId] = color;
    }
    commit(next);
  }

  function undo() {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setFuture((f) => [fills, ...f]);
    setPast((p) => p.slice(0, -1));
    setFills(prev);
  }

  function redo() {
    if (future.length === 0) return;
    const next = future[0];
    setPast((p) => [...p, fills]);
    setFuture((f) => f.slice(1));
    setFills(next);
  }

  function reset() {
    if (Object.keys(fills).length === 0) return;
    commit({});
  }

  function shuffle() {
    let next = randomTemplate();
    if (COLORING_TEMPLATES.length > 1) {
      while (next.id === template.id) next = randomTemplate();
    }
    setTemplate(next);
    setFills({});
    setPast([]);
    setFuture([]);
  }

  function handleSave() {
    const fd = new FormData();
    fd.set("rating_id", ratingId);
    fd.set("template_id", template.id);
    fd.set("fills", JSON.stringify(fills));
    save(fd);
  }

  const saved = state.ok;

  return (
    <motion.div
      className="flex flex-col gap-6"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {phase === "coloring" ? (
        <>
          <div>
            <Eyebrow>how today felt</Eyebrow>
            <h2 className="mt-2 font-display text-2xl font-medium text-ink text-balance">
              How did today feel?
            </h2>
            <p className="mt-1 text-ink-soft">Maybe you can show it without words.</p>
          </div>

          <div className="mx-auto w-full max-w-sm rounded-2xl border border-rule bg-ground p-3">
            <ColoringSvg
              template={template}
              fills={fills}
              interactive
              onPick={paint}
              className="h-auto w-full"
            />
          </div>

          {/* palette */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {COLORING_PALETTE.map((c) => {
              const active = !eraser && color === c.value;
              return (
                <button
                  key={c.id}
                  type="button"
                  title={c.name}
                  aria-label={c.name}
                  aria-pressed={active}
                  onClick={() => {
                    setColor(c.value);
                    setEraser(false);
                  }}
                  className={cn(
                    "h-8 w-8 rounded-full border transition",
                    active
                      ? "border-accent-ink ring-2 ring-accent-ink/40 ring-offset-2 ring-offset-paper"
                      : "border-rule hover:scale-110",
                  )}
                  style={{ backgroundColor: c.value }}
                />
              );
            })}
            <button
              type="button"
              title="Hapus warna"
              aria-label="Hapus warna"
              aria-pressed={eraser}
              onClick={() => setEraser(true)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border text-sm transition",
                eraser
                  ? "border-accent-ink bg-blush/40 ring-2 ring-accent-ink/40 ring-offset-2 ring-offset-paper"
                  : "border-rule text-ink-soft hover:border-accent-ink/40",
              )}
            >
              ⌫
            </button>
          </div>

          {/* tools */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="soft" size="sm" onClick={undo} disabled={past.length === 0}>
                ↶ Undo
              </Button>
              <Button type="button" variant="soft" size="sm" onClick={redo} disabled={future.length === 0}>
                ↷ Redo
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={reset}
                disabled={Object.keys(fills).length === 0}
              >
                Reset
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={shuffle}>
                🎲 Ganti gambar
              </Button>
            </div>
            <Button type="button" size="md" onClick={() => setPhase("card")}>
              Selesai
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* memory card preview */}
          <div className="mx-auto w-full max-w-sm rounded-2xl border border-accent/40 bg-gradient-to-br from-blush/30 to-paper p-5 shadow-[var(--shadow-lift)]">
            <p className="text-center font-hand text-xl text-accent-ink">A Little Piece of Today</p>
            <p className="mt-1 text-center font-display text-lg font-medium text-ink">
              <span className="text-accent-ink">{score}</span>/10
            </p>
            <div className="mx-auto mt-3 w-full max-w-[16rem] rounded-xl border border-rule bg-ground p-3">
              <ColoringSvg template={template} fills={fills} className="h-auto w-full" />
            </div>
            <p className="mt-3 text-center font-mono text-xs text-ink-faint">
              {formatDateLabel(dateISO)}
            </p>
          </div>

          {state.error ? (
            <p role="alert" className="text-center text-sm text-danger">
              {state.error}
            </p>
          ) : null}

          {saved ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-accent-ink">Tersimpan di diary ✓</p>
              <Button type="button" size="md" onClick={onClose}>
                Selesai
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => setPhase("coloring")}
                disabled={saving}
              >
                ← Warnai lagi
              </Button>
              <Button type="button" size="md" onClick={handleSave} disabled={saving}>
                {saving ? "Menyimpan…" : "Simpan ke Diary"}
              </Button>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
