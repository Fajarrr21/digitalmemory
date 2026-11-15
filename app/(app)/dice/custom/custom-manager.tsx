"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { cn } from "@/lib/utils";
import { CATEGORIES, MODES, categoryOf, type DiceMode } from "@/lib/dice/config";
import { deleteCustom, saveCustom, suggestIdeas, type CustomInput } from "./actions";

type Custom = { id: string; author_id: string; category: string; modes: string[]; kind: "a" | "x"; text: string; secret: boolean };

const blank = (): CustomInput => ({ category: "sweet", modes: MODES.map((m) => m.key), kind: "a", text: "", secret: false });
const chip = (on: boolean) =>
  cn("rounded-full border px-3 py-1 text-sm transition", on ? "border-accent-ink bg-blush/40 text-ink" : "border-rule text-ink-soft");

export function CustomManager({ mine, theirs, partnerName }: { mine: Custom[]; theirs: Custom[]; partnerName: string }) {
  const [form, setForm] = useState<CustomInput>(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<{ text: string; kind: "a" | "x" }[]>([]);
  const [hint, setHint] = useState("");
  const [pending, start] = useTransition();
  const [thinking, setThinking] = useState(false);

  const set = (patch: Partial<CustomInput>) => setForm((f) => ({ ...f, ...patch }));
  const toggleMode = (k: DiceMode) =>
    set({ modes: form.modes.includes(k) ? form.modes.filter((m) => m !== k) : [...form.modes, k] });

  async function suggest() {
    setThinking(true);
    setMsg(null);
    const r = await suggestIdeas(form.category, form.modes[0] ?? "soft", hint);
    setThinking(false);
    if (r.ideas) setIdeas(r.ideas);
    else setMsg(r.error ?? "Belum ada ide. Coba lagi ya.");
  }

  return (
    <div className="space-y-5">
      <PaperCard>
        <Eyebrow>{editing ? "ubah tantangan" : "tantangan baru"}</Eyebrow>
        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-2 text-xs text-ink-faint">Sisi dadu</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button key={c.key} type="button" className={chip(form.category === c.key)} onClick={() => set({ category: c.key })}>
                  {c.icon} {c.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs text-ink-faint">Muncul di mode</p>
            <div className="flex flex-wrap gap-2">
              {MODES.map((m) => (
                <button key={m.key} type="button" aria-pressed={form.modes.includes(m.key)} className={chip(form.modes.includes(m.key))} onClick={() => toggleMode(m.key)}>
                  {m.emoji} {m.label}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="mb-2 block text-xs text-ink-faint">Tantangannya</span>
            <textarea
              value={form.text}
              onChange={(e) => set({ text: e.target.value })}
              maxLength={300}
              rows={3}
              placeholder={`Misalnya: Ceritakan satu hal yang ingin kamu lakukan denganku kalau kita bertemu nanti.`}
              className="w-full rounded-2xl border border-rule bg-paper px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint focus:border-accent-ink/50 focus:outline-none"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(form.kind === "a")} onClick={() => set({ kind: "a" })}>
              💬 dijawab
            </button>
            <button type="button" className={chip(form.kind === "x")} onClick={() => set({ kind: "x" })}>
              ⚡ dilakukan
            </button>
            <button type="button" aria-pressed={form.secret} className={chip(form.secret)} onClick={() => set({ secret: !form.secret })}>
              🤫 rahasia
            </button>
          </div>
          {msg && <p className="text-sm text-accent-ink">{msg}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={pending || form.text.trim().length < 3 || !form.modes.length}
              onClick={() =>
                start(async () => {
                  const r = await saveCustom(editing, form);
                  if (r.error) return setMsg(r.error);
                  setMsg(editing ? "Tersimpan ♡" : `Masuk ke dadu. Tunggu ${partnerName} kebagian ♡`);
                  setForm((f) => ({ ...blank(), category: f.category, modes: f.modes }));
                  setEditing(null);
                })
              }
            >
              {editing ? "Simpan perubahan" : "Simpan tantangan"}
            </Button>
            {editing && (
              <Button variant="ghost" onClick={() => (setEditing(null), setForm(blank()))}>
                Batal
              </Button>
            )}
          </div>
        </div>
      </PaperCard>

      <PaperCard>
        <Eyebrow>✨ butuh ide?</Eyebrow>
        <p className="mt-2 text-sm text-ink-soft">
          AI memberi beberapa ide untuk sisi & mode yang kamu pilih di atas. Pilih satu, ubah sesukamu, lalu simpan
          sendiri — tidak ada yang tersimpan otomatis.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            maxLength={200}
            placeholder="arah (opsional) — misal: tentang kopi, atau kangen"
            className="h-11 flex-1 rounded-full border border-rule bg-paper px-4 text-sm text-ink placeholder:text-ink-faint focus:border-accent-ink/50 focus:outline-none"
          />
          <Button variant="soft" disabled={thinking} onClick={suggest}>
            {thinking ? "Sedang memikirkan…" : "✨ Beri ide"}
          </Button>
        </div>
        {ideas.length > 0 && (
          <ul className="mt-4 space-y-2">
            {ideas.map((i) => (
              <li key={i.text}>
                <button
                  type="button"
                  onClick={() => (set({ text: i.text, kind: i.kind }), window.scrollTo({ top: 0, behavior: "smooth" }))}
                  className="w-full rounded-2xl border border-rule px-4 py-3 text-left text-sm text-ink transition hover:border-accent-ink/40"
                >
                  {i.kind === "x" ? "⚡" : "💬"} {i.text}
                  <span className="mt-1 block text-xs text-accent-ink">pakai ini →</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PaperCard>

      <List
        title={`milikmu · ${mine.length}`}
        items={mine}
        empty="Belum ada. Tulis yang pertama di atas ♡"
        onEdit={(c) => {
          setEditing(c.id);
          setForm({ category: c.category, modes: c.modes, kind: c.kind, text: c.text, secret: c.secret });
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
      {theirs.length > 0 && (
        <List
          title={`dari ${partnerName} · ${theirs.length}`}
          items={theirs}
          note={`Yang rahasia tidak terlihat di sini — tunggu dadunya ♡`}
        />
      )}
    </div>
  );
}

function List({
  title,
  items,
  empty,
  note,
  onEdit,
}: {
  title: string;
  items: Custom[];
  empty?: string;
  note?: string;
  onEdit?: (c: Custom) => void;
}) {
  const [pending, start] = useTransition();
  const [sure, setSure] = useState<string | null>(null);
  return (
    <PaperCard>
      <Eyebrow>{title}</Eyebrow>
      {note && <p className="mt-2 text-xs text-ink-faint">{note}</p>}
      {!items.length && empty && <p className="mt-3 text-sm text-ink-soft">{empty}</p>}
      <ul className="mt-3 divide-y divide-rule">
        {items.map((c) => {
          const cat = categoryOf(c.category);
          return (
            <li key={c.id} className="py-3">
              <p className="font-mono text-[11px] uppercase" style={{ color: cat.ink }}>
                {cat.icon} {cat.name} {c.secret && "· 🤫 rahasia"} · {c.kind === "x" ? "dilakukan" : "dijawab"}
              </p>
              <p className="mt-1 text-[15px] text-ink">{c.text}</p>
              <p className="mt-1 text-xs text-ink-faint">{c.modes.map((m) => MODES.find((x) => x.key === m)?.label).join(" · ")}</p>
              {onEdit && (
                <div className="mt-2 flex gap-3 text-xs">
                  <button type="button" className="text-ink-soft hover:text-accent-ink" onClick={() => onEdit(c)}>
                    ubah
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className="text-ink-faint hover:text-accent-ink"
                    onClick={() => (sure === c.id ? start(async () => void (await deleteCustom(c.id))) : setSure(c.id))}
                  >
                    {sure === c.id ? "yakin hapus? tap lagi" : "hapus"}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </PaperCard>
  );
}
