"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { PaperCard } from "@/components/ui/paper-card";
import { cn } from "@/lib/utils";
import { categoryOf } from "@/lib/dice/config";
import type { Database } from "@/lib/supabase/database.types";
import { deleteMemory, updateMemory } from "./actions";

type Memory = Database["public"]["Tables"]["dice_memories"]["Row"];

/** A little journal, not a log: grouped by month, each moment a tinted page. */
export function MemoryBook({ memories, names }: { memories: Memory[]; names: Record<string, string> }) {
  const [items, setItems] = useState(memories);
  const [onlyFav, setOnlyFav] = useState(false);
  const shown = onlyFav ? items.filter((m) => m.favorite) : items;

  const months: { key: string; label: string; list: Memory[] }[] = [];
  for (const m of shown) {
    const d = new Date(m.played_at);
    const key = format(d, "yyyy-MM");
    let g = months.find((x) => x.key === key);
    if (!g) months.push((g = { key, label: format(d, "MMMM yyyy", { locale: localeId }), list: [] }));
    g.list.push(m);
  }

  if (!items.length) {
    return (
      <PaperCard className="text-center">
        <p className="font-display text-xl text-ink">Jurnalnya masih kosong.</p>
        <p className="mt-2 text-sm text-ink-soft">Tap ♡ Save Moment di kartu tantangan, dan momennya akan tinggal di sini.</p>
      </PaperCard>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2" role="tablist">
        {[
          [false, `Semua · ${items.length}`],
          [true, `♥ Favorit · ${items.filter((m) => m.favorite).length}`],
        ].map(([v, label]) => (
          <button
            key={String(v)}
            type="button"
            role="tab"
            aria-selected={onlyFav === v}
            onClick={() => setOnlyFav(v as boolean)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm transition",
              onlyFav === v ? "border-accent-ink bg-blush/40 text-ink" : "border-rule text-ink-soft",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {months.map((g) => (
        <section key={g.key}>
          <h2 className="mb-3 font-hand text-2xl text-ink-soft">{g.label}</h2>
          <div className="space-y-4">
            {g.list.map((m, i) => (
              <Page
                key={m.id}
                m={m}
                tilt={i % 2 ? 0.6 : -0.6}
                names={names}
                onChange={(next) => setItems((xs) => (next ? xs.map((x) => (x.id === m.id ? next : x)) : xs.filter((x) => x.id !== m.id)))}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Page({
  m,
  tilt,
  names,
  onChange,
}: {
  m: Memory;
  tilt: number;
  names: Record<string, string>;
  onChange: (next: Memory | null) => void;
}) {
  const c = categoryOf(m.category);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(m.note ?? "");
  const [sure, setSure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const who = m.player_id ? (names[m.player_id] ?? "Dia") : "";

  const run = (fn: () => Promise<{ error?: string }>, next: Memory | null) =>
    start(async () => {
      const r = await fn();
      setError(r.error ?? null);
      if (!r.error) onChange(next);
    });

  return (
    <article
      className="relative rounded-[22px] border px-5 py-5 shadow-[var(--shadow-soft,0_1px_2px_rgba(0,0,0,0.04))] transition"
      style={{
        transform: `rotate(${tilt}deg)`,
        background: `linear-gradient(170deg, color-mix(in srgb, ${c.tint} 70%, var(--paper)), var(--paper) 70%)`,
        borderColor: `color-mix(in srgb, ${c.ink} 22%, transparent)`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[11px] tracking-wide uppercase" style={{ color: c.ink }}>
          {c.icon} {c.name}
        </p>
        <button
          type="button"
          aria-pressed={m.favorite}
          aria-label={m.favorite ? "Hapus dari favorit" : "Tandai favorit"}
          disabled={pending}
          onClick={() => run(() => updateMemory(m.id, { favorite: !m.favorite }), { ...m, favorite: !m.favorite })}
          className={cn("text-xl transition hover:scale-110", m.favorite ? "text-accent-ink" : "text-ink-faint")}
        >
          {m.favorite ? "♥" : "♡"}
        </button>
      </div>
      <p className="mt-2 font-display text-xl leading-snug whitespace-pre-line text-ink">{m.challenge}</p>
      {m.answer && (
        <p className="mt-3 font-hand text-xl leading-snug text-ink-soft">
          <span className="text-ink-faint">{who}:</span> “{m.answer}”
        </p>
      )}
      {m.partner_answer && (
        <p className="mt-1 font-hand text-xl leading-snug text-ink-soft">
          <span className="text-ink-faint">🔁 juga:</span> “{m.partner_answer}”
        </p>
      )}
      {m.note && !open && <p className="mt-3 border-l-2 border-accent/60 pl-3 font-hand text-lg text-ink">{m.note}</p>}
      <div className="mt-4 flex items-center justify-between gap-2">
        <p className="font-mono text-[11px] text-ink-faint">
          {who && `${who} · `}
          {format(new Date(m.played_at), "d MMM yyyy · HH:mm", { locale: localeId })}
        </p>
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs text-ink-soft hover:text-accent-ink">
          {open ? "tutup" : m.note ? "ubah catatan" : "+ catatan"}
        </button>
      </div>
      {open && (
        <div className="mt-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Catatan kecil tentang momen ini…"
            className="w-full rounded-2xl border border-rule bg-paper/80 px-4 py-3 font-hand text-lg text-ink placeholder:text-ink-faint focus:border-accent-ink/50 focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const r = await updateMemory(m.id, { note });
                  if (!r.error) setOpen(false);
                  return r;
                }, { ...m, note: note.trim() || null })
              }
            >
              Simpan catatan
            </Button>
            <button
              type="button"
              disabled={pending}
              className="ml-auto text-xs text-ink-faint hover:text-accent-ink"
              onClick={() => (sure ? run(() => deleteMemory(m.id), null) : setSure(true))}
            >
              {sure ? "Yakin hapus? Tap lagi." : "Hapus kenangan ini"}
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-accent-ink">{error}</p>}
    </article>
  );
}
