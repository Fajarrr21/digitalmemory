"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { Chips, Field, inputClass } from "@/components/words/chips";
import { DiffView } from "@/components/words/diff-view";
import { QualityPanel } from "@/components/words/quality-panel";
import { ExplainPanel } from "@/components/words/explain-panel";
import { AiOffNotice, BackLink } from "@/components/words/back-link";
import { SelectionRefiner, useTextareaSelection } from "@/components/words/selection-refiner";
import { AiCallError, callWordsAi, type RewriteResult } from "@/components/words/ai-client";
import { DEPTHS, LANGUAGES, REFINEMENTS, TRANSFORMATIONS, WORDS_LIMITS, WORK_TYPES } from "@/lib/words/options";
import type { WordsLanguage, WorkType } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { createWork, saveVersion } from "../actions";

type Source = {
  id: string;
  title: string;
  content: string;
  workType: WorkType;
  language: WordsLanguage;
  depth: number | null;
  genre: string | null;
  mood: string | null;
  style: string | null;
  theme: string | null;
} | null;

type Settings = {
  workType: WorkType;
  language: WordsLanguage;
  transformation: string | null;
  refinements: string[];
  depth: number | null;
  keepStructure: boolean;
  instruction: string;
  explain: boolean;
};

type Attempt = { result: RewriteResult; original: string; label: string; at: number };

type Persisted = { text: string; settings: Settings; attempts: Attempt[]; chosen: number | null };

const WAITING = ["Membaca maksudmu dulu…", "Menjaga maknanya tetap milikmu…", "Menimbang diksi…", "Merapikan ritme…"];

export function Rewrite({ aiReady, source }: { aiReady: boolean; source: Source }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const key = `words:rewrite:${source?.id ?? "new"}`;
  const initialSettings: Settings = {
    workType: source?.workType ?? "prose",
    language: source?.language ?? "id",
    transformation: "poetic",
    refinements: [],
    depth: source?.depth ?? null,
    keepStructure: true,
    instruction: "",
    explain: false,
  };
  const [text, setText] = useState(source?.content ?? "");
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const { ref: taRef, sel, onSelect } = useTextareaSelection();

  // Restore an unfinished session (results survive a refresh or a failed save).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const p = JSON.parse(raw) as Persisted;
        // A work that changed since keeps its newer text.
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from localStorage after mount
        if (!source || p.attempts.length) setText(p.text);
        setSettings((s) => ({ ...s, ...p.settings }));
        setAttempts(p.attempts ?? []);
        setChosen(p.chosen ?? null);
      }
    } catch {}
    setHydrated(true);
  }, [key, source]);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(key, JSON.stringify({ text, settings, attempts, chosen } satisfies Persisted));
    } catch {}
  }, [hydrated, key, text, settings, attempts, chosen]);
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setWait((i) => (i + 1) % WAITING.length), 3000);
    return () => clearInterval(t);
  }, [busy]);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings((s) => ({ ...s, [k]: v }));
  const current = chosen !== null ? attempts[chosen] : null;

  async function rewrite() {
    if (text.trim().length < 3) {
      setError("Tulis atau tempel dulu tulisanmu.");
      return;
    }
    if (text.length > WORDS_LIMITS.aiInput) {
      setError(`Terlalu panjang untuk sekali olah (maks. ${WORDS_LIMITS.aiInput} karakter). Pilih bagiannya saja.`);
      return;
    }
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setBusy(true);
    setError(null);
    setWait(0);
    try {
      const res = await callWordsAi<{ result: RewriteResult }>(
        {
          mode: "rewrite",
          text,
          workType: settings.workType,
          transformation: settings.transformation,
          refinements: settings.refinements,
          depth: settings.depth,
          language: settings.language,
          keepStructure: settings.keepStructure,
          instruction: settings.instruction.trim() || null,
          explain: settings.explain,
        },
        ctl.signal,
      );
      const label =
        TRANSFORMATIONS.find((t) => t.key === settings.transformation)?.label ??
        (settings.refinements.length
          ? REFINEMENTS.filter((r) => settings.refinements.includes(r.key))
              .map((r) => r.label)
              .join(" · ")
          : "Refined");
      const next = [...attempts, { result: res.result, original: text, label, at: Date.now() }].slice(-6);
      setAttempts(next);
      setChosen(next.length - 1);
      setEditing(null);
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
    } catch (err) {
      if (err instanceof AiCallError && err.code === "aborted") return;
      setError(err instanceof Error ? err.message : "Ada yang salah.");
    } finally {
      setBusy(false);
    }
  }

  const finalText = editing ?? current?.result.revised ?? "";

  async function apply(asNew: boolean) {
    if (!current || !finalText.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const transformation = `The Rewrite · ${current.label}`.slice(0, 80);
      if (source && !asNew) {
        const res = await saveVersion({ id: source.id, content: finalText, kind: "rewrite", transformation });
        if (res.error) throw new Error(res.error);
        clearSession();
        router.push(`/words/w/${source.id}`);
      } else {
        const res = await createWork({
          title: current.result.title || source?.title || "",
          content: finalText,
          work_type: settings.transformation === "expand" ? "prose" : settings.workType,
          language: settings.language,
          literary_depth: settings.depth,
          genre: source?.genre ?? null,
          mood: source?.mood ?? null,
          style: source?.style ?? null,
          theme: source?.theme ?? null,
          origin: "rewrite",
          transformation,
          status: "draft",
        });
        if (res.error || !res.id) throw new Error(res.error ?? "Gagal menyimpan.");
        clearSession();
        router.push(`/words/w/${res.id}`);
      }
    } catch (err) {
      setError(`${err instanceof Error ? err.message : "Gagal menyimpan."} Hasilnya tetap aman di sini — coba lagi.`);
    } finally {
      setSaving(false);
    }
  }

  function clearSession() {
    try {
      localStorage.removeItem(key);
    } catch {}
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <BackLink href={source ? `/words/w/${source.id}` : "/words"} label={source ? source.title || "kembali ke karya" : "little words."} />
        <Eyebrow className="mt-4">The Rewrite</Eyebrow>
        <h1 className="mt-2 font-display text-3xl font-medium text-ink text-balance">Transform your words.</h1>
        <p className="mt-2 text-ink-soft">Bukan parafrasa. Maksudmu dibaca dulu, lalu kualitas sastranya dinaikkan — tanpa mengganti apa yang ingin kamu katakan.</p>
      </div>

      {!aiReady ? <AiOffNotice /> : null}

      <PaperCard className="flex flex-col gap-7 p-5 md:p-7">
        <Field label={source ? `Tulisanmu — ${source.title || "tanpa judul"}` : "Tulisanmu"} hint={`${text.length}/${WORDS_LIMITS.aiInput}`}>
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, WORDS_LIMITS.content))}
            onSelect={onSelect}
            rows={8}
            placeholder="Aku senang mengenalmu. Hal-hal kecil yang kamu lakukan selalu berhasil membuat hariku lebih baik. Aku berharap kita bisa terus bersama."
            className={cn(inputClass, "min-h-48 resize-y font-display text-[17px] leading-relaxed")}
          />
          {aiReady ? (
            <SelectionRefiner
              text={text}
              sel={sel}
              language={settings.language}
              refinements={settings.refinements}
              onApply={(next) => setText(next)}
              disabled={busy}
            />
          ) : null}
        </Field>

        <Field label="Bentuk & bahasa">
          <div className="flex flex-col gap-2">
            <Chips
              size="sm"
              options={WORK_TYPES.map((w) => ({ key: w.key, label: `${w.emoji} ${w.label}` }))}
              value={settings.workType}
              onChange={(v) => set("workType", v as WorkType)}
            />
            <Chips size="sm" options={LANGUAGES} value={settings.language} onChange={(v) => set("language", v as WordsLanguage)} />
          </div>
        </Field>

        <Field label="Transformasi" hint="satu arah besar">
          <Chips
            size="sm"
            allowNone
            showHints
            options={TRANSFORMATIONS}
            value={settings.transformation}
            onChange={(v) => set("transformation", v as string | null)}
          />
        </Field>

        <Field label="Unsur yang diperhalus" hint="boleh lebih dari satu">
          <Chips
            size="sm"
            multiple
            showHints
            options={REFINEMENTS}
            value={settings.refinements}
            onChange={(v) => set("refinements", (v as string[]) ?? [])}
          />
        </Field>

        <Field label="Kedalaman" hint="kosongkan untuk mengikuti aslinya">
          <Chips
            size="sm"
            allowNone
            options={DEPTHS.map((d) => ({ key: String(d.level), label: `${d.level} · ${d.label}` }))}
            value={settings.depth ? String(settings.depth) : null}
            onChange={(v) => set("depth", v ? Number(v) : null)}
          />
        </Field>

        <div className="flex flex-col gap-3 rounded-2xl bg-paper-2/50 p-4">
          <p className="text-sm text-ink">
            🔒 <span className="font-medium">Preserve My Meaning</span>{" "}
            <span className="text-ink-soft">— selalu aktif. Maksud, perasaan, fakta, dan sudut pandangmu dijaga; kekaguman tidak akan berubah jadi janji.</span>
          </p>
          <label className="flex items-center gap-3 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={settings.keepStructure}
              onChange={(e) => set("keepStructure", e.target.checked)}
              className="accent-[var(--accent-ink)]"
            />
            Pertahankan struktur aslinya (urutan gagasan & jumlah paragraf)
          </label>
          <label className="flex items-center gap-3 text-sm text-ink-soft">
            <input type="checkbox" checked={settings.explain} onChange={(e) => set("explain", e.target.checked)} className="accent-[var(--accent-ink)]" />
            Jelaskan diksi & teknik yang dipakai
          </label>
          <input
            value={settings.instruction}
            onChange={(e) => set("instruction", e.target.value.slice(0, WORDS_LIMITS.instruction))}
            placeholder="Instruksi tambahan (opsional) — mis. jangan lebih dari tiga paragraf"
            className={cn(inputClass, "py-2.5 text-sm")}
          />
        </div>

        <div className="flex flex-col items-start gap-3 border-t border-rule-soft pt-5 sm:flex-row sm:items-center">
          <Button type="button" size="lg" onClick={rewrite} disabled={busy || !aiReady}>
            {busy ? "Sedang menyempurnakan…" : attempts.length ? "🪶 Coba versi lain" : "🪶 Transform"}
          </Button>
          {busy ? (
            <div className="flex items-center gap-3">
              <AnimatePresence mode="wait">
                <motion.p
                  key={wait}
                  initial={reduce ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0 }}
                  className="font-display text-sm italic text-ink-soft"
                >
                  {WAITING[wait]}
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

      {current ? (
        <div ref={resultRef} className="flex scroll-mt-6 flex-col gap-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <Eyebrow>Compare Versions</Eyebrow>
            {attempts.length > 1 ? (
              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Versi">
                {attempts.map((a, i) => (
                  <button
                    key={a.at}
                    type="button"
                    role="tab"
                    aria-selected={i === chosen}
                    onClick={() => {
                      setChosen(i);
                      setEditing(null);
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs",
                      i === chosen ? "border-accent-ink/50 bg-blush/60 text-ink" : "border-rule text-ink-soft",
                    )}
                    title={a.label}
                  >
                    v{i + 1}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <PaperCard lift className="flex flex-col gap-5 p-5 md:p-7">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">{current.label}</p>
              {current.result.title ? <h2 className="mt-1 font-display text-2xl font-medium text-ink">{current.result.title}</h2> : null}
            </div>
            {editing === null ? (
              <DiffView original={current.original} revised={current.result.revised} />
            ) : (
              <Field label="Gabungkan / sunting sendiri" hint="ambil yang kamu suka dari versi mana pun">
                <textarea
                  value={editing}
                  onChange={(e) => setEditing(e.target.value.slice(0, WORDS_LIMITS.content))}
                  rows={10}
                  className={cn(inputClass, "min-h-56 resize-y font-display text-[17px] leading-relaxed")}
                />
                <DiffView original={current.original} revised={editing} />
              </Field>
            )}

            {current.result.changes.length ? (
              <div>
                <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">Perubahan utama</p>
                <ul className="flex flex-col gap-3">
                  {current.result.changes.map((c, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-mono text-[11px] uppercase tracking-wider text-accent-ink">{c.aspect}</span>
                      <p className="mt-0.5 text-ink-soft">
                        {c.before ? (
                          <>
                            <span className="line-through decoration-ink-faint/50">{c.before}</span> →{" "}
                          </>
                        ) : null}
                        <span className="font-display text-ink">{c.after}</span>
                      </p>
                      <p className="text-ink-faint">{c.why}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {current.result.meaningKept ? (
              <p className="rounded-xl bg-paper-2/60 p-3 text-sm text-ink-soft">
                <span className="mr-1">🔒</span>
                {current.result.meaningKept}
              </p>
            ) : null}
            {current.result.explanation ? <p className="text-sm text-ink-soft">{current.result.explanation}</p> : null}
            <QualityPanel issues={current.result.issues} review={current.result.review} repaired={current.result.repaired} />

            <div className="flex flex-wrap gap-2 border-t border-rule-soft pt-4">
              {source ? (
                <Button type="button" size="sm" onClick={() => apply(false)} disabled={saving}>
                  {saving ? "Menyimpan…" : "✓ Pakai versi ini"}
                </Button>
              ) : null}
              <Button type="button" size="sm" variant={source ? "soft" : "primary"} onClick={() => apply(true)} disabled={saving}>
                {saving && !source ? "Menyimpan…" : "♡ Simpan sebagai karya baru"}
              </Button>
              {editing === null ? (
                <Button type="button" size="sm" variant="soft" onClick={() => setEditing(current.result.revised)}>
                  ✏️ Sunting / gabungkan
                </Button>
              ) : (
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  Kembali ke perbandingan
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setText(finalText);
                  setEditing(null);
                  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
                }}
              >
                ↺ Olah lagi dari versi ini
              </Button>
            </div>
            <ExplainPanel text={finalText} language={settings.language} compact />
          </PaperCard>
        </div>
      ) : null}
    </div>
  );
}
