"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type {
  CareRedFlag,
  CareSeverity,
  CareSymptom,
  CareWant,
} from "@/lib/supabase/database.types";
import { safetyLevel, sipGently } from "@/lib/care/logic";
import { CareOrb, CareRoom } from "@/components/care/care-room";
import { SafetyCard } from "@/components/care/safety-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createCare } from "../actions";
import {
  DRINK_SIP_NOTE,
  NOT_MEDICAL,
  RED_FLAGS,
  SEVERITY,
  SYMPTOMS,
  WANTS,
  severityLabel,
  symptomInfo,
  wantInfo,
} from "../care-config";

/**
 * How Are You Feeling? → Is anything worrying? → What Would Help? → review.
 *
 * The warning-signs step is not a formality: if anything there is ticked
 * (or the pain is severe) the medical-help card takes over the screen before
 * the comforting part continues — it never hides behind an animation.
 *
 * The draft lives in sessionStorage with its client_key, so a refresh or a
 * flaky connection never loses it and a retried send lands on one session.
 */

type Draft = {
  symptoms: CareSymptom[];
  severity: CareSeverity | null;
  note: string;
  shareDetails: boolean;
  shareNote: boolean;
  redFlags: CareRedFlag[];
  noneOfThese: boolean;
  needsCheck: boolean;
  wants: CareWant[];
  clientKey: string;
};

const STORE = "care:draft";
const STEPS = ["feeling", "safety", "help", "review"] as const;
type Step = (typeof STEPS)[number];

function freshDraft(): Draft {
  return {
    symptoms: [],
    severity: null,
    note: "",
    shareDetails: true,
    shareNote: true,
    redFlags: [],
    noneOfThese: false,
    needsCheck: true,
    wants: [],
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

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function CareComposer({ partnerName, hasPartner }: { partnerName: string; hasPartner: boolean }) {
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

  const level = safetyLevel({ severity: draft.severity, redFlags: draft.redFlags, symptoms: draft.symptoms });

  const canNext =
    (step === "feeling" && draft.symptoms.length > 0 && !!draft.severity) ||
    (step === "safety" && (draft.redFlags.length > 0 || draft.noneOfThese)) ||
    (step === "help" && draft.wants.length > 0);

  function send() {
    if (!draft || !draft.severity || draft.symptoms.length === 0 || draft.wants.length === 0) return;
    setError(null);
    start(async () => {
      try {
        const res = await createCare({
          symptoms: draft.symptoms,
          severity: draft.severity!,
          note: draft.note.trim() || null,
          shareDetails: draft.shareDetails,
          shareNote: draft.shareNote,
          redFlags: draft.redFlags,
          needsCheck: level !== "none" && draft.needsCheck,
          wants: draft.wants,
          clientKey: draft.clientKey,
        });
        if (res.ok && res.id) {
          try {
            sessionStorage.removeItem(STORE);
          } catch {}
          router.push(`/care/${res.id}`);
          return;
        }
        setError(res.error ?? "Ada yang tersendat. Coba lagi ya. ♡");
        setExistingId(res.existingId ?? null);
      } catch {
        setError("Koneksinya terputus. Tekan kirim lagi — nggak akan terkirim dua kali. ♡");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        {index === 0 ? (
          <Link href="/care" className="text-sm text-ink-faint hover:text-ink-soft">
            ← Little Care
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

      <CareRoom>
        <div className="flex justify-center px-6 py-3">
          <CareOrb phase="idle" label="Sebuah bola cahaya kecil berbentuk hati" className="max-w-[9rem]" />
        </div>
      </CareRoom>

      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={step}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-5"
        >
          {step === "feeling" ? (
            <>
              <fieldset className="flex flex-col gap-2.5">
                <legend className="mb-3">
                  <StepHeading
                    ref={headingRef}
                    eyebrow="how are you feeling?"
                    title="What are you feeling, love?"
                    sub="Pilih keluhan yang sedang kamu alami. Boleh lebih dari satu."
                  />
                </legend>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {SYMPTOMS.map((s) => (
                    <CheckCard
                      key={s.key}
                      checked={draft.symptoms.includes(s.key)}
                      onChange={() => set({ symptoms: toggle(draft.symptoms, s.key) })}
                      leading={s.emoji}
                      title={s.label}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-1 font-display text-lg font-medium text-ink">Seberapa parah rasanya?</legend>
                <p className="mb-3 text-sm text-ink-soft">
                  Ini hanya untuk membantu {partnerName} memahami keluhanmu, bukan diagnosis medis.
                </p>
                <div className="grid grid-cols-3 gap-2.5">
                  {SEVERITY.map((s) => (
                    <label
                      key={s.key}
                      className={cn(
                        "flex min-h-16 cursor-pointer flex-col items-center justify-center rounded-2xl border px-3 py-3 text-center transition",
                        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink",
                        draft.severity === s.key ? "border-accent bg-blush/45" : "border-rule bg-paper hover:border-accent-ink/40",
                      )}
                    >
                      <input
                        type="radio"
                        name="severity"
                        value={s.key}
                        checked={draft.severity === s.key}
                        onChange={() => set({ severity: s.key })}
                        className="sr-only"
                      />
                      <span aria-hidden className="text-accent-ink">{"●".repeat(s.dots)}</span>
                      <span className="mt-1 text-sm text-ink">{s.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="care-note" className="mb-2 block font-display text-lg font-medium text-ink">
                  Ada yang ingin kamu ceritakan?
                </label>
                <textarea
                  id="care-note"
                  value={draft.note}
                  onChange={(e) => set({ note: e.target.value.slice(0, 400) })}
                  rows={3}
                  placeholder="Opsional. Misalnya: dari tadi siang, makin sore makin nggak enak…"
                  className="w-full resize-none rounded-2xl border border-rule bg-paper px-4 py-3 text-[15px] leading-relaxed text-ink placeholder:text-ink-faint focus:border-accent-ink/50 focus:outline-none"
                />
                <p className="mt-1 text-right font-mono text-[11px] text-ink-faint">{draft.note.length}/400</p>
              </div>

              <div className="flex flex-col gap-2">
                <ShareToggle
                  checked={draft.shareDetails}
                  onChange={(v) => set({ shareDetails: v })}
                  title={`Bagikan keluhan & tingkatnya ke ${partnerName}`}
                  line={
                    draft.shareDetails
                      ? `${partnerName} melihatnya di dalam Little Care — tidak pernah di notifikasi.`
                      : `${partnerName} hanya tahu kamu sedang nggak enak badan, dan apa yang kamu butuhkan.`
                  }
                />
                {draft.note.trim() ? (
                  <ShareToggle
                    checked={draft.shareNote}
                    onChange={(v) => set({ shareNote: v })}
                    title={`Bagikan ceritamu ke ${partnerName}`}
                    line={draft.shareNote ? "Dia bisa membacanya." : "🔒 Hanya kamu yang bisa membacanya."}
                  />
                ) : null}
              </div>
            </>
          ) : null}

          {step === "safety" ? (
            <>
              <fieldset className="flex flex-col gap-2.5">
                <legend className="mb-3">
                  <StepHeading
                    ref={headingRef}
                    eyebrow="sebentar, untuk keamananmu"
                    title="Ada salah satu dari ini?"
                    sub="Kalau ada, ini lebih penting daripada apa pun di aplikasi ini."
                  />
                </legend>
                {RED_FLAGS.map((r) => (
                  <CheckCard
                    key={r.key}
                    checked={draft.redFlags.includes(r.key)}
                    onChange={() => set({ redFlags: toggle(draft.redFlags, r.key), noneOfThese: false })}
                    title={r.label}
                  />
                ))}
                <CheckCard
                  checked={draft.noneOfThese && draft.redFlags.length === 0}
                  onChange={() => set({ noneOfThese: !draft.noneOfThese, redFlags: [] })}
                  title="Nggak ada yang seperti ini"
                />
              </fieldset>

              {level !== "none" ? (
                <>
                  <SafetyCard level={level} />
                  <ShareToggle
                    checked={draft.needsCheck}
                    onChange={(v) => set({ needsCheck: v })}
                    title={`Beri tahu ${partnerName} bahwa aku mungkin perlu diperiksa`}
                    line={`Hanya tanda itu saja yang ${partnerName} lihat — supaya dia bisa membantumu mencari pertolongan.`}
                  />
                </>
              ) : null}
            </>
          ) : null}

          {step === "help" ? (
            <>
              <fieldset className="flex flex-col gap-2.5">
                <legend className="mb-3">
                  <StepHeading
                    ref={headingRef}
                    eyebrow="what would help?"
                    title="Perhatian seperti apa yang kamu mau?"
                    sub="Pilih satu atau beberapa. Ini pilihan kenyamanan, bukan pengobatan."
                  />
                </legend>
                {WANTS.map((w) => (
                  <CheckCard
                    key={w.key}
                    checked={draft.wants.includes(w.key)}
                    onChange={() => set({ wants: toggle(draft.wants, w.key) })}
                    leading={w.emoji}
                    title={w.label}
                    line={
                      <>
                        {w.line}
                        {w.key === "drink" && sipGently(draft.symptoms) ? (
                          <span className="mt-1 block text-xs text-accent-ink">{DRINK_SIP_NOTE}</span>
                        ) : null}
                        {w.note && draft.wants.includes(w.key) ? (
                          <span className="mt-1 block text-xs text-ink-faint">{w.note}</span>
                        ) : null}
                      </>
                    }
                  />
                ))}
              </fieldset>
              {draft.wants.includes("quiet") ? (
                <p className="text-sm text-ink-faint">
                  Quiet Time menyalakan mode istirahat: kamu nggak akan dapat WhatsApp dari Little Care, dan
                  {" "}{partnerName} hanya bisa meninggalkan satu pesan untuk dibaca nanti.
                </p>
              ) : null}
            </>
          ) : null}

          {step === "review" && draft.severity ? (
            <>
              <StepHeading ref={headingRef} eyebrow="sebelum dikirim" title={`Ini yang ${partnerName} akan lihat.`} />
              {level !== "none" ? <SafetyCard level={level} /> : null}
              <dl className="flex flex-col divide-y divide-rule-soft rounded-2xl border border-rule bg-paper px-5">
                <Row
                  label="Keluhan"
                  value={
                    draft.shareDetails
                      ? `${draft.symptoms.map((s) => symptomInfo(s).label).join(", ")} · ${severityLabel(draft.severity)}`
                      : "🔒 Hanya kamu — dia tahu kamu sedang nggak enak badan."
                  }
                  edit={() => go("feeling")}
                />
                <Row
                  label="Ceritamu"
                  value={
                    draft.note.trim()
                      ? draft.shareNote
                        ? `“${draft.note.trim()}”`
                        : "🔒 Hanya kamu"
                      : "Tanpa cerita — itu juga cukup."
                  }
                  edit={() => go("feeling")}
                />
                {level !== "none" ? (
                  <Row
                    label="Perlu diperiksa"
                    value={draft.needsCheck ? `${partnerName} diberi tahu (tanpa detail).` : "🔒 Tidak dibagikan"}
                    edit={() => go("safety")}
                  />
                ) : null}
                <Row
                  label="Yang membantu"
                  value={draft.wants.map((w) => `${wantInfo(w).emoji} ${wantInfo(w).label}`).join(" · ")}
                  edit={() => go("help")}
                />
              </dl>
              <p className="text-sm text-ink-faint">
                {partnerName} akan dapat satu pesan umum: &ldquo;Ada seseorang yang butuh sedikit perhatianmu di
                Little Care.&rdquo; Tanpa keluhan atau detail apa pun.
              </p>
              <p className="text-xs text-ink-faint">{NOT_MEDICAL}</p>
            </>
          ) : null}
        </motion.section>
      </AnimatePresence>

      {error ? (
        <div role="alert" className="rounded-2xl border border-danger/40 px-4 py-3 text-sm text-danger">
          {error}
          {existingId ? (
            <Link href={`/care/${existingId}`} className="ml-1 underline underline-offset-2">
              Buka Little Care-mu →
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="sticky bottom-24 z-10 flex justify-end md:bottom-6">
        {step === "review" ? (
          <Button size="lg" onClick={send} disabled={pending || !hasPartner} aria-busy={pending}>
            {pending ? "Mengirim…" : `Kirim ke ${partnerName}`}
          </Button>
        ) : (
          <Button size="lg" onClick={next} disabled={!canNext}>
            {step === "safety" && level !== "none" ? "Aku mengerti, lanjutkan" : "Lanjutkan"}
          </Button>
        )}
      </div>
    </div>
  );
}

function CheckCard({
  checked,
  onChange,
  title,
  line,
  leading,
}: {
  checked: boolean;
  onChange: () => void;
  title: React.ReactNode;
  line?: React.ReactNode;
  leading?: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink",
        checked ? "border-accent bg-blush/45" : "border-rule bg-paper hover:border-accent-ink/40",
      )}
    >
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      {leading ? (
        <span aria-hidden className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-paper-2 text-lg">
          {leading}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-ink">{title}</span>
        {line ? <span className="mt-0.5 block text-sm text-ink-soft">{line}</span> : null}
      </span>
      <span
        aria-hidden
        className={cn(
          "flex h-5 w-5 flex-none items-center justify-center rounded-md border text-[11px] transition",
          checked ? "border-accent-ink bg-accent-ink text-paper" : "border-rule",
        )}
      >
        {checked ? "✓" : ""}
      </span>
    </label>
  );
}

function ShareToggle({
  checked,
  onChange,
  title,
  line,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  line: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-rule px-4 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 accent-[var(--accent-ink)]"
      />
      <span className="text-sm text-ink-soft">
        <span className="block text-[15px] text-ink">{title}</span>
        {line}
      </span>
    </label>
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
