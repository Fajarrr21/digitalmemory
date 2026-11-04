"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { Chips, Field, inputClass } from "@/components/words/chips";
import { WorkText } from "@/components/words/work-text";
import { QualityPanel } from "@/components/words/quality-panel";
import { ExplainPanel } from "@/components/words/explain-panel";
import { AiOffNotice, BackLink, stash } from "@/components/words/back-link";
import { AiCallError, callWordsAi, type MuseWork } from "@/components/words/ai-client";
import {
  DEPTHS,
  EXPLICITNESS,
  GENRES,
  LANGUAGES,
  LENGTHS,
  MOODS,
  POVS,
  THEMES,
  WORDS_LIMITS,
  WORK_TYPES,
  workTypeOf,
} from "@/lib/words/options";
import type { WordsLanguage, WorkType } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { createWork } from "../actions";

type Form = {
  idea: string;
  workType: WorkType;
  style: string | null;
  theme: string | null;
  customTheme: string;
  genre: string | null;
  mood: string | null;
  depth: number;
  length: "short" | "medium" | "long";
  language: WordsLanguage;
  pov: "first" | "second" | "third" | "free";
  explicitness: "explicit" | "balanced" | "implicit";
  alternatives: number;
  explain: boolean;
  reference: string;
};

const DEFAULT_FORM: Form = {
  idea: "",
  workType: "poetry",
  style: "free",
  theme: null,
  customTheme: "",
  genre: null,
  mood: null,
  depth: 3,
  length: "medium",
  language: "id",
  pov: "free",
  explicitness: "balanced",
  alternatives: 3,
  explain: false,
  reference: "",
};

const FORM_KEY = "words:muse:form";
const RESULT_KEY = "words:muse:results";

type Saved = { works: MuseWork[]; form: Form; savedIds: Record<number, string>; at: number };

const WAITING_LINES = [
  "Sang Muse sedang mendengarkan gagasanmu…",
  "Mencari kata yang paling jujur…",
  "Menimbang setiap baris…",
  "Membuang yang klise, menyimpan yang benar…",
  "Membaca ulang pelan-pelan…",
];

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota / private mode — nothing to do; the results are still on screen.
  }
}

export function Muse({ aiReady, replyTo }: { aiReady: boolean; replyTo: { id: string; title: string } | null }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [form, setForm] = useState<Form>(DEFAULT_FORM);
  const [result, setResult] = useState<Saved | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitLine, setWaitLine] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  // Restore the draft + any unsaved results (a refresh never loses a poem).
  useEffect(() => {
    const f = load<Form>(FORM_KEY);
    const r = load<Saved>(RESULT_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from localStorage after mount
    if (f) setForm({ ...DEFAULT_FORM, ...f });
    if (r?.works?.length) setResult(r);
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) save(FORM_KEY, form);
  }, [form, hydrated]);
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setWaitLine((i) => (i + 1) % WAITING_LINES.length), 3200);
    return () => clearInterval(t);
  }, [busy]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const form0 = workTypeOf(form.workType);
  const depth = DEPTHS.find((d) => d.level === form.depth) ?? DEPTHS[2];

  async function generate() {
    if (form.idea.trim().length < 3) {
      setError("Tulis dulu gagasan atau perasaannya — satu kalimat pun cukup.");
      return;
    }
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setBusy(true);
    setError(null);
    setWaitLine(0);
    try {
      const res = await callWordsAi<{ works: MuseWork[] }>(
        {
          mode: "generate",
          ...form,
          customTheme: form.customTheme.trim() || null,
          reference: form.reference.trim() || null,
        },
        ctl.signal,
      );
      const saved: Saved = { works: res.works, form, savedIds: {}, at: Date.now() };
      setResult(saved);
      save(RESULT_KEY, saved);
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
    } catch (err) {
      if (err instanceof AiCallError && err.code === "aborted") return;
      setError(err instanceof Error ? err.message : "Ada yang salah.");
    } finally {
      setBusy(false);
    }
  }

  async function keep(i: number, then?: "open" | "rewrite" | "canvas") {
    if (!result) return null;
    const existing = result.savedIds[i];
    let id = existing;
    if (!id) {
      const w = result.works[i];
      const f = result.form;
      const res = await createWork({
        title: w.title,
        content: w.content,
        work_type: f.workType,
        style: f.style,
        theme: f.customTheme.trim() || THEMES.find((t) => t.key === f.theme)?.label || null,
        genre: f.genre,
        mood: f.mood,
        language: f.language,
        literary_depth: f.depth,
        origin: "muse",
        status: "draft",
      });
      if (res.error || !res.id) {
        // The poem is still on screen and in localStorage — nothing is lost.
        setError(`${res.error ?? "Gagal menyimpan."} Tulisannya tetap aman di sini — coba simpan lagi.`);
        return null;
      }
      id = res.id;
      const next = { ...result, savedIds: { ...result.savedIds, [i]: id } };
      setResult(next);
      save(RESULT_KEY, next);
    }
    const reply = replyTo ? `?reply=${replyTo.id}` : "";
    if (then === "open") router.push(`/words/w/${id}${reply}`);
    if (then === "rewrite") router.push(`/words/rewrite?work=${id}`);
    if (then === "canvas") router.push(`/words/canvas?work=${id}`);
    return id;
  }

  function clearResults() {
    setResult(null);
    try {
      localStorage.removeItem(RESULT_KEY);
    } catch {}
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <BackLink />
        <Eyebrow className="mt-4">The Muse</Eyebrow>
        <h1 className="mt-2 font-display text-3xl font-medium text-ink text-balance">Create from a feeling.</h1>
        <p className="mt-2 text-ink-soft">
          Tidak perlu draft. Tuliskan saja gagasannya — Sang Muse akan menemukan beberapa cara berbeda untuk mengatakannya.
        </p>
      </div>

      {!aiReady ? <AiOffNotice /> : null}
      {replyTo ? (
        <p className="rounded-2xl border border-rule bg-paper-2/50 p-4 text-sm text-ink-soft">
          ✍️ Membalas <span className="font-display italic text-ink">“{replyTo.title}”</span>. Simpan karya yang kamu suka, lalu kirim sebagai
          balasan dari halamannya.
        </p>
      ) : null}

      <PaperCard className="flex flex-col gap-7 p-5 md:p-7">
        <Field label="Gagasan / perasaan" hint={`${form.idea.length}/${WORDS_LIMITS.idea}`}>
          <textarea
            value={form.idea}
            onChange={(e) => set("idea", e.target.value.slice(0, WORDS_LIMITS.idea))}
            rows={5}
            placeholder="Aku ingin menulis tentang seseorang yang belum pernah kutemui secara langsung, tetapi sudah menjadi bagian penting dalam hidupku."
            className={cn(inputClass, "min-h-36 resize-y font-display text-[17px] leading-relaxed")}
          />
          <p className="text-xs text-ink-faint">Hanya tulisan di kotak-kotak ini yang dikirim ke AI — bukan diary, surat, atau apa pun yang lain.</p>
        </Field>

        <Field label="Bentuk tulisan">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {WORK_TYPES.map((w) => (
              <button
                key={w.key}
                type="button"
                aria-pressed={form.workType === w.key}
                onClick={() => setForm((f) => ({ ...f, workType: w.key, style: w.styles[0].key }))}
                className={cn(
                  "rounded-2xl border px-3 py-3 text-left transition",
                  form.workType === w.key ? "border-accent-ink/50 bg-blush/50" : "border-rule bg-ground/40 hover:border-accent-ink/30",
                )}
              >
                <span className="text-lg" aria-hidden>
                  {w.emoji}
                </span>
                <span className="mt-1 block font-display text-ink">{w.label}</span>
                <span className="block text-xs text-ink-faint">{w.hint}</span>
              </button>
            ))}
          </div>
          <Chips size="sm" options={form0.styles} value={form.style} onChange={(v) => set("style", v as string)} label="Gaya" />
        </Field>

        <Field label="Tema" hint="pilih atau tulis sendiri">
          <Chips size="sm" allowNone options={THEMES} value={form.theme} onChange={(v) => set("theme", v as string | null)} label="Tema" />
          <input
            value={form.customTheme}
            onChange={(e) => set("customTheme", e.target.value.slice(0, WORDS_LIMITS.customTheme))}
            placeholder="Tema sendiri… (mis. kereta malam, pesan yang belum terkirim)"
            className={cn(inputClass, "py-2.5 text-sm")}
          />
        </Field>

        <Field label="Genre sastra" hint="membentuk cara gagasan dibangun">
          <Chips size="sm" allowNone showHints options={GENRES} value={form.genre} onChange={(v) => set("genre", v as string | null)} label="Genre" />
        </Field>

        <Field label="Suasana">
          <Chips size="sm" allowNone options={MOODS} value={form.mood} onChange={(v) => set("mood", v as string | null)} label="Suasana" />
        </Field>

        <Field label="Kedalaman bahasa">
          <div className="flex flex-col gap-3">
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={form.depth}
              onChange={(e) => set("depth", Number(e.target.value))}
              className="w-full accent-[var(--accent-ink)]"
              aria-valuetext={`${depth.level} — ${depth.label}`}
            />
            <div className="flex justify-between font-mono text-[10px] text-ink-faint">
              {DEPTHS.map((d) => (
                <span key={d.level} className={cn(d.level === form.depth && "text-accent-ink")}>
                  {d.level}
                </span>
              ))}
            </div>
            <p className="text-sm">
              <span className="font-display text-ink">
                Level {depth.level} — {depth.label}
              </span>
              <span className="text-ink-soft"> · {depth.hint}</span>
            </p>
          </div>
        </Field>

        <div>
          <button type="button" onClick={() => setMoreOpen((v) => !v)} className="text-sm text-ink-soft hover:text-accent-ink" aria-expanded={moreOpen}>
            {moreOpen ? "▾" : "▸"} Pengaturan lain{" "}
            <span className="text-ink-faint">
              · {LENGTHS.find((l) => l.key === form.length)?.label} · {form.language === "id" ? "Indonesia" : "English"} ·{" "}
              {form.alternatives} alternatif
            </span>
          </button>
          {moreOpen ? (
            <div className="mt-5 flex flex-col gap-6">
              <Field label="Panjang">
                <Chips size="sm" options={LENGTHS} value={form.length} onChange={(v) => set("length", v as Form["length"])} />
              </Field>
              <Field label="Bahasa">
                <Chips size="sm" options={LANGUAGES} value={form.language} onChange={(v) => set("language", v as WordsLanguage)} />
              </Field>
              <Field label="Sudut pandang">
                <Chips size="sm" showHints options={POVS} value={form.pov} onChange={(v) => set("pov", v as Form["pov"])} />
              </Field>
              <Field label="Makna">
                <Chips
                  size="sm"
                  showHints
                  options={EXPLICITNESS}
                  value={form.explicitness}
                  onChange={(v) => set("explicitness", v as Form["explicitness"])}
                />
              </Field>
              <Field label="Jumlah alternatif">
                <Chips
                  size="sm"
                  options={[
                    { key: "1", label: "1" },
                    { key: "2", label: "2" },
                    { key: "3", label: "3" },
                  ]}
                  value={String(form.alternatives)}
                  onChange={(v) => set("alternatives", Number(v))}
                />
              </Field>
              <label className="flex items-center gap-3 text-sm text-ink-soft">
                <input type="checkbox" checked={form.explain} onChange={(e) => set("explain", e.target.checked)} className="accent-[var(--accent-ink)]" />
                Sertakan penjelasan singkat tentang teknik yang dipakai
              </label>
              <Field label="Contoh tulisan yang kamu suka (opsional)" hint="hanya untuk karakter umum, tidak disalin">
                <textarea
                  value={form.reference}
                  onChange={(e) => set("reference", e.target.value.slice(0, WORDS_LIMITS.idea))}
                  rows={3}
                  className={cn(inputClass, "text-sm")}
                />
              </Field>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-start gap-3 border-t border-rule-soft pt-5 sm:flex-row sm:items-center">
          <Button type="button" size="lg" onClick={generate} disabled={busy || !aiReady}>
            {busy ? "Sedang menulis…" : result ? "✒️ Tulis lagi" : "✒️ Create Something Beautiful"}
          </Button>
          {busy ? (
            <div className="flex items-center gap-3">
              <AnimatePresence mode="wait">
                <motion.p
                  key={waitLine}
                  initial={reduce ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -4 }}
                  className="font-display text-sm italic text-ink-soft"
                >
                  {WAITING_LINES[waitLine]}
                </motion.p>
              </AnimatePresence>
              <button type="button" onClick={() => abort.current?.abort()} className="text-xs text-ink-faint underline">
                batal
              </button>
            </div>
          ) : null}
        </div>
        {error ? <p className="-mt-3 text-sm text-danger">{error}</p> : null}
      </PaperCard>

      {result ? (
        <div ref={resultsRef} className="flex scroll-mt-6 flex-col gap-5">
          <div className="flex items-baseline justify-between gap-3">
            <Eyebrow>
              {result.works.length > 1 ? `${result.works.length} cara untuk mengatakannya` : "Untuk gagasanmu"}
            </Eyebrow>
            <button type="button" onClick={clearResults} className="text-xs text-ink-faint hover:text-ink-soft">
              bersihkan
            </button>
          </div>
          {result.works.map((w, i) => (
            <ResultCard
              key={`${result.at}-${i}`}
              index={i}
              total={result.works.length}
              work={w}
              type={result.form.workType}
              language={result.form.language}
              savedId={result.savedIds[i]}
              onKeep={(then) => keep(i, then)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ResultCard({
  index,
  total,
  work,
  type,
  language,
  savedId,
  onKeep,
}: {
  index: number;
  total: number;
  work: MuseWork;
  type: WorkType;
  language: WordsLanguage;
  savedId?: string;
  onKeep: (then?: "open" | "rewrite" | "canvas") => Promise<string | null>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const run = async (what: string, then?: "open" | "rewrite" | "canvas") => {
    setBusy(what);
    try {
      await onKeep(then);
    } finally {
      setBusy(null);
    }
  };
  return (
    <PaperCard lift className="flex flex-col gap-5 p-6 md:p-8">
      <div>
        {total > 1 ? <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">Alternatif {index + 1}</p> : null}
        <h2 className="mt-1 font-display text-2xl font-medium text-ink text-balance">{work.title}</h2>
        {work.approach ? <p className="mt-1 text-sm italic text-ink-soft">{work.approach}</p> : null}
      </div>
      <WorkText text={work.content} type={type} />
      <div className="flex flex-col gap-2 border-t border-rule-soft pt-4">
        {work.character ? (
          <p className="text-xs text-ink-faint">
            Karakter bahasa: <span className="text-ink-soft">{work.character}</span>
          </p>
        ) : null}
        {work.explanation ? <p className="text-sm text-ink-soft">{work.explanation}</p> : null}
        <QualityPanel issues={work.issues} review={work.review} repaired={work.repaired} />
      </div>
      <div className="flex flex-wrap gap-2">
        {savedId ? (
          <Link
            href={`/words/w/${savedId}`}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-accent px-4 text-sm font-medium text-[#4a2b30] shadow-[var(--shadow-lift)]"
          >
            ✓ Tersimpan · buka →
          </Link>
        ) : (
          <Button type="button" size="sm" onClick={() => run("keep", "open")} disabled={!!busy}>
            {busy === "keep" ? "Menyimpan…" : "♡ Simpan & sunting"}
          </Button>
        )}
        <Button type="button" size="sm" variant="soft" onClick={() => run("rewrite", "rewrite")} disabled={!!busy}>
          🪶 Sempurnakan
        </Button>
        <Button type="button" size="sm" variant="soft" onClick={() => run("canvas", "canvas")} disabled={!!busy}>
          🎨 Jadikan kartu
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(`${work.title}\n\n${work.content}`);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              stash("words:clipboard", work.content);
            }
          }}
        >
          {copied ? "Tersalin ✓" : "Salin"}
        </Button>
      </div>
      <ExplainPanel text={work.content} language={language} compact />
    </PaperCard>
  );
}
