"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { HoldFeeling, HoldNeed, HoldTiming } from "@/lib/supabase/database.types";
import { objectFor } from "@/lib/hold/logic";
import { FeelingObject, HoldSky } from "@/components/hold/feeling-object";
import { Choice } from "@/components/hold/choice";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createHold } from "../actions";
import {
  FEELINGS,
  INTENSITY,
  NEEDS,
  OBJECT_COPY,
  TIMINGS,
  TIMING_NOTE,
  feelingInfo,
  needInfo,
  timingInfo,
} from "../hold-config";

/**
 * What I'm Carrying — one gentle question per screen:
 * feeling → how heavy → what would help → a few words (optional, with an
 * explicit privacy choice) → timing → look it over → send.
 *
 * The draft lives in sessionStorage (with its client_key), so going back, a
 * refresh or a flaky connection never loses what was written — and a retried
 * send lands on the very same session instead of making a second one.
 */

type Draft = {
  feeling: HoldFeeling | null;
  intensity: number | null;
  shareIntensity: boolean;
  need: HoldNeed | null;
  context: string;
  shareContext: boolean;
  timing: HoldTiming | null;
  clientKey: string;
};

const STORE = "hold:draft";
const STEPS = ["feeling", "intensity", "need", "context", "timing", "review"] as const;
type Step = (typeof STEPS)[number];

function freshDraft(): Draft {
  return {
    feeling: null,
    intensity: null,
    shareIntensity: false,
    need: null,
    context: "",
    shareContext: true,
    timing: null,
    clientKey: crypto.randomUUID(),
  };
}

function loadDraft(): Draft {
  try {
    const raw = sessionStorage.getItem(STORE);
    if (raw) return { ...freshDraft(), ...(JSON.parse(raw) as Partial<Draft>) };
  } catch {
    // Private mode / blocked storage — start fresh.
  }
  return freshDraft();
}

export function HoldComposer({ partnerName, hasPartner }: { partnerName: string; hasPartner: boolean }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState<Step>("feeling");
  const [error, setError] = useState<string | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // Client-only: sessionStorage + crypto aren't there during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(loadDraft());
  }, []);

  useEffect(() => {
    if (!draft) return;
    try {
      sessionStorage.setItem(STORE, JSON.stringify(draft));
    } catch {
      // Fine — the draft just won't survive a reload.
    }
  }, [draft]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  if (!draft) {
    return (
      <div aria-busy="true" className="flex min-h-[50vh] items-center justify-center text-sm text-ink-faint">
        sebentar…
      </div>
    );
  }

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const index = STEPS.indexOf(step);
  const go = (s: Step) => {
    setError(null);
    setStep(s);
  };
  const next = () => go(STEPS[Math.min(index + 1, STEPS.length - 1)]);
  const back = () => go(STEPS[Math.max(index - 1, 0)]);

  const canNext =
    (step === "feeling" && !!draft.feeling) ||
    (step === "intensity" && !!draft.intensity) ||
    (step === "need" && !!draft.need) ||
    step === "context" ||
    (step === "timing" && !!draft.timing);

  function send() {
    if (!draft || !draft.feeling || !draft.need || !draft.timing) return;
    setError(null);
    start(async () => {
      try {
        const res = await createHold({
          feeling: draft.feeling!,
          intensity: draft.intensity,
          shareIntensity: draft.shareIntensity,
          need: draft.need!,
          context: draft.context.trim() || null,
          shareContext: draft.shareContext,
          timing: draft.timing!,
          clientKey: draft.clientKey,
        });
        if (res.ok && res.id) {
          try {
            sessionStorage.removeItem(STORE);
          } catch {}
          router.push(`/hold/${res.id}`);
          return;
        }
        setError(res.error ?? "Ada yang tersendat. Coba lagi ya. ♡");
        setExistingId(res.existingId ?? null);
      } catch {
        // Network dropped: the same client_key makes the retry safe.
        setError("Koneksinya terputus. Tekan kirim lagi — nggak akan terkirim dua kali. ♡");
      }
    });
  }

  const chosen = draft.feeling ? objectFor(draft.feeling) : null;
  const object = chosen ?? "orb";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        {index === 0 ? (
          <Link href="/hold" className="text-sm text-ink-faint hover:text-ink-soft">
            ← Hold
          </Link>
        ) : (
          <button type="button" onClick={back} className="text-sm text-ink-faint hover:text-ink-soft">
            ← kembali
          </button>
        )}
        <p className="font-mono text-[11px] tracking-[0.18em] text-ink-faint" aria-label={`Langkah ${index + 1} dari ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <span key={s} aria-hidden className={cn("mx-0.5", i <= index ? "text-accent-ink" : "")}>
              {i <= index ? "●" : "○"}
            </span>
          ))}
        </p>
      </div>

      <HoldSky>
        <div className="flex justify-center px-6 py-4">
          <FeelingObject
            object={object}
            state="initial"
            busy={draft.feeling === "racing"}
            intensity={draft.intensity}
            label={chosen && draft.feeling ? `${OBJECT_COPY[chosen].name}, untuk ${feelingInfo(draft.feeling).label}` : "Sebuah bola cahaya kecil"}
            className="max-w-[13rem]"
          />
        </div>
        {chosen ? (
          <p className="pb-4 text-center font-mono text-[11px] tracking-[0.18em] text-[#f4c7cf] uppercase">
            {OBJECT_COPY[chosen].name}
          </p>
        ) : null}
      </HoldSky>

      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={step}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-4"
        >
          {step === "feeling" ? (
            <fieldset className="flex flex-col gap-2.5">
              <legend className="mb-3">
                <StepHeading ref={headingRef} eyebrow="what i'm carrying" title="Apa yang sedang kamu bawa?" />
              </legend>
              {FEELINGS.map((f) => (
                <Choice
                  key={f.key}
                  name="feeling"
                  value={f.key}
                  checked={draft.feeling === f.key}
                  onChange={(v) => set({ feeling: v as HoldFeeling })}
                  leading={f.emoji}
                  title={f.label}
                  line={f.hint}
                />
              ))}
            </fieldset>
          ) : null}

          {step === "intensity" ? (
            <>
              <fieldset>
                <legend className="mb-3">
                  <StepHeading ref={headingRef} eyebrow="seberapa berat" title="Kira-kira seberat apa rasanya?" />
                </legend>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {INTENSITY.map((i) => (
                    <label
                      key={i.value}
                      className={cn(
                        "flex min-h-16 cursor-pointer flex-col items-center justify-center rounded-2xl border px-3 py-3 text-center transition",
                        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink",
                        draft.intensity === i.value ? "border-accent bg-blush/45" : "border-rule bg-paper hover:border-accent-ink/40",
                      )}
                    >
                      <input
                        type="radio"
                        name="intensity"
                        value={i.value}
                        checked={draft.intensity === i.value}
                        onChange={() => set({ intensity: i.value })}
                        className="sr-only"
                      />
                      <span aria-hidden className="text-accent-ink">{"●".repeat(i.value)}</span>
                      <span className="mt-1 text-sm text-ink">{i.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-rule px-4 py-3">
                <input
                  type="checkbox"
                  checked={draft.shareIntensity}
                  onChange={(e) => set({ shareIntensity: e.target.checked })}
                  className="mt-1 h-4 w-4 accent-[var(--accent-ink)]"
                />
                <span className="text-sm text-ink-soft">
                  <span className="block text-[15px] text-ink">Tunjukkan ini ke {partnerName}</span>
                  Kalau nggak dicentang, hanya kamu yang tahu. Ini bukan skor — cuma sedikit konteks.
                </span>
              </label>
            </>
          ) : null}

          {step === "need" ? (
            <fieldset className="flex flex-col gap-2.5">
              <legend className="mb-3">
                <StepHeading ref={headingRef} eyebrow="what would help" title="Apa yang paling kamu butuhkan?" />
              </legend>
              {NEEDS.map((n) => (
                <Choice
                  key={n.key}
                  name="need"
                  value={n.key}
                  checked={draft.need === n.key}
                  onChange={(v) => set({ need: v as HoldNeed })}
                  title={n.label}
                  line={n.line}
                />
              ))}
            </fieldset>
          ) : null}

          {step === "context" ? (
            <>
              <StepHeading
                ref={headingRef}
                eyebrow="kalau mau"
                title="Mau cerita sedikit?"
                sub="Boleh dilewati. Satu kalimat juga cukup."
              />
              <div>
                <label htmlFor="hold-context" className="sr-only">
                  Sedikit cerita
                </label>
                <textarea
                  id="hold-context"
                  value={draft.context}
                  onChange={(e) => set({ context: e.target.value.slice(0, 600) })}
                  rows={4}
                  placeholder="Hari ini rasanya semua hal datang bersamaan…"
                  className="w-full resize-none rounded-2xl border border-rule bg-paper px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-ink-faint focus:border-accent-ink/50 focus:outline-none"
                />
                <p className="mt-1 text-right font-mono text-[11px] text-ink-faint">{draft.context.length}/600</p>
              </div>
              {draft.context.trim() ? (
                <fieldset className="flex flex-col gap-2.5">
                  <legend className="mb-2 text-sm text-ink-soft">Siapa yang boleh membaca ini?</legend>
                  <Choice
                    name="privacy"
                    value="share"
                    checked={draft.shareContext}
                    onChange={() => set({ shareContext: true })}
                    leading="♡"
                    title={`Bagikan ke ${partnerName}`}
                    line="Dia akan membacanya di ruang ini (tidak pernah di notifikasi)."
                  />
                  <Choice
                    name="privacy"
                    value="private"
                    checked={!draft.shareContext}
                    onChange={() => set({ shareContext: false })}
                    leading="🔒"
                    title="Simpan untuk diriku sendiri"
                    line={`${partnerName} tidak bisa membacanya sama sekali.`}
                  />
                </fieldset>
              ) : null}
            </>
          ) : null}

          {step === "timing" ? (
            <>
              <fieldset className="flex flex-col gap-2.5">
                <legend className="mb-3">
                  <StepHeading ref={headingRef} eyebrow="no rush" title="Kapan kamu ingin ditemani?" />
                </legend>
                {TIMINGS.map((t) => (
                  <Choice
                    key={t.key}
                    name="timing"
                    value={t.key}
                    checked={draft.timing === t.key}
                    onChange={(v) => set({ timing: v as HoldTiming })}
                    title={t.label}
                    line={t.line}
                  />
                ))}
              </fieldset>
              <p className="text-sm leading-relaxed text-ink-faint">{TIMING_NOTE}</p>
            </>
          ) : null}

          {step === "review" && draft.feeling && draft.need && draft.timing ? (
            <>
              <StepHeading ref={headingRef} eyebrow="sebelum dikirim" title="Begini ruangmu akan terlihat." />
              <dl className="flex flex-col divide-y divide-rule-soft rounded-2xl border border-rule bg-paper px-5">
                <Row label="Yang kamu bawa" value={feelingInfo(draft.feeling).label} edit={() => go("feeling")} />
                <Row
                  label="Seberat"
                  value={`${INTENSITY.find((i) => i.value === draft.intensity)?.label ?? "—"} · ${
                    draft.shareIntensity ? `${partnerName} bisa lihat` : "🔒 hanya kamu"
                  }`}
                  edit={() => go("intensity")}
                />
                <Row label="Yang kamu butuhkan" value={needInfo(draft.need).label} edit={() => go("need")} />
                <Row
                  label="Ceritamu"
                  value={
                    draft.context.trim()
                      ? `“${draft.context.trim()}” · ${draft.shareContext ? `${partnerName} bisa baca` : "🔒 hanya kamu"}`
                      : "Tanpa cerita — itu juga cukup."
                  }
                  edit={() => go("context")}
                />
                <Row label="Waktu" value={timingInfo(draft.timing).label} edit={() => go("timing")} />
              </dl>
              <p className="text-sm text-ink-faint">
                {draft.timing === "soon"
                  ? `${partnerName} akan dapat satu pesan umum: “Ada ruang kecil yang menunggumu di Hold.” Tanpa isi perasaanmu.`
                  : `Tidak ada pesan WhatsApp — ${partnerName} akan melihatnya saat membuka app.`}
              </p>
            </>
          ) : null}
        </motion.section>
      </AnimatePresence>

      {error ? (
        <div role="alert" className="rounded-2xl border border-danger/40 px-4 py-3 text-sm text-danger">
          {error}
          {existingId ? (
            <Link href={`/hold/${existingId}`} className="ml-1 underline underline-offset-2">
              Buka ruangmu →
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="sticky bottom-24 z-10 flex justify-end md:bottom-6">
        {step === "review" ? (
          <Button size="lg" onClick={send} disabled={pending || !hasPartner} aria-busy={pending}>
            {pending ? "Mengirim…" : "Kirim ruang kecil ini"}
          </Button>
        ) : (
          <Button size="lg" onClick={next} disabled={!canNext}>
            {step === "context" && !draft.context.trim() ? "Lewati" : "Lanjut"}
          </Button>
        )}
      </div>
    </div>
  );
}

function StepHeading({
  eyebrow,
  title,
  sub,
  ref,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  ref: React.Ref<HTMLHeadingElement>;
}) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-ink">{eyebrow}</p>
      <h1 ref={ref} tabIndex={-1} className="mt-1.5 font-display text-2xl font-medium text-ink text-balance focus:outline-none">
        {title}
      </h1>
      {sub ? <p className="mt-1 text-sm text-ink-soft">{sub}</p> : null}
    </div>
  );
}

function Row({ label, value, edit }: { label: string; value: string; edit: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3.5">
      <div className="min-w-0">
        <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">{label}</dt>
        <dd className="mt-0.5 text-[15px] text-ink break-words">{value}</dd>
      </div>
      <button
        type="button"
        onClick={edit}
        className="flex-none rounded-full px-2 py-1 text-sm text-accent-ink hover:underline"
        aria-label={`Ubah: ${label}`}
      >
        ubah
      </button>
    </div>
  );
}
