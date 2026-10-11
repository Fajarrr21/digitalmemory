"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type {
  HoldAction,
  HoldAfter,
  HoldGesture,
  HoldNeed,
} from "@/lib/supabase/database.types";
import type { HoldReply, HoldSession } from "@/lib/hold/queries";
import { allowedMoves, objectFor, objectState, orderedActions, type Viewer } from "@/lib/hold/logic";
import { FeelingObject, HoldSky } from "@/components/hold/feeling-object";
import { Choice } from "@/components/hold/choice";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/utils";
import { afterHold, closeHold, deleteHold, respondHold, setHoldKept } from "../actions";
import {
  ACTIONS,
  AFTER,
  AFTER_FOR_PARTNER,
  GESTURES,
  INTENSITY,
  NEEDS,
  OBJECT_COPY,
  RECEIVED_LINE,
  STATUS_LABEL,
  feelingInfo,
  fitNote,
  needInfo,
  timingInfo,
} from "../hold-config";

const NETWORK = "Koneksinya terputus. Coba lagi — nggak akan terkirim dua kali. ♡";

export function HoldSessionView({
  viewer,
  session,
  replies,
  privateNote,
  partnerName,
  sentLabel,
}: {
  viewer: Viewer;
  session: HoldSession;
  replies: HoldReply[];
  privateNote: { intensity: number | null; context: string | null } | null;
  partnerName: string;
  sentLabel: string;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const moves = allowedMoves(viewer, session.status);
  const object = objectFor(session.feeling);
  const copy = OBJECT_COPY[object];

  const supports = replies.filter((r) => r.kind === "support");
  const latestSupport = supports.at(-1) ?? null;
  const currentSupport = supports.find((r) => r.round === session.round) ?? null;

  // The recipient's choice previews on the object before it's sent.
  const [preview, setPreview] = useState<{ action: HoldAction | null; gesture: HoldGesture | null }>({
    action: null,
    gesture: null,
  });
  const shownAction = moves.respond ? preview.action : (latestSupport?.action ?? null);
  const shownGesture = moves.respond ? preview.gesture : (latestSupport?.gesture ?? null);
  const dim = shownAction === "space" || session.after_choice === "quiet";

  // Waiting on the other person? Look again now and then, only while visible.
  const waitingOnOther =
    (viewer === "sender" && ["pending", "opened", "continued"].includes(session.status)) ||
    (viewer === "recipient" && session.status === "responded");
  useEffect(() => {
    if (!waitingOnOther) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 20000);
    return () => window.clearInterval(t);
  }, [waitingOnOther, router]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link href="/hold" className="text-sm text-ink-faint hover:text-ink-soft">
          ← Hold
        </Link>
        <p className="font-mono text-[11px] text-ink-faint">{sentLabel}</p>
      </div>

      <HoldSky dim={dim}>
        <div className="flex flex-col items-center px-6 pt-7 pb-8 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#f4c7cf]">
            {viewer === "recipient" ? "let me hold it" : "ruangmu"} · {copy.name}
          </p>
          <FeelingObject
            object={object}
            state={objectState(session.status)}
            action={shownAction}
            gesture={shownGesture}
            busy={session.feeling === "racing"}
            intensity={session.shared_intensity ?? privateNote?.intensity ?? null}
            label={`${copy.name}${shownAction ? `, dengan ${ACTIONS[shownAction].label}` : ""}`}
            className="my-1 max-w-[18rem]"
          />
          {viewer === "recipient" ? (
            <>
              <h1 className="font-display text-xl leading-snug font-medium text-balance md:text-2xl">
                Seseorang yang kamu sayangi {copy.carrying}
              </h1>
              <p className="mt-2 max-w-sm text-[15px] text-[#f2e2d6]/85">{copy.reassure}</p>
            </>
          ) : (
            <h1 className="font-display text-xl leading-snug font-medium text-balance md:text-2xl">
              {feelingInfo(session.feeling).label}
            </h1>
          )}
          <p aria-live="polite" className="mt-4 rounded-full bg-white/10 px-3 py-1 font-mono text-[11px] tracking-wide text-[#fff3e4]/90">
            {statusLine(viewer, session, partnerName)}
          </p>
        </div>
      </HoldSky>

      {/* What was shared — same words both sides see. */}
      <SharedDetails
        viewer={viewer}
        session={session}
        replies={replies}
        privateNote={privateNote}
        partnerName={partnerName}
      />

      {/* Sender: a gesture arrived. */}
      {viewer === "sender" && latestSupport && latestSupport.action ? (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-accent/40 bg-blush/40 px-6 py-5"
        >
          <Eyebrow>{ACTIONS[latestSupport.action].label.toLowerCase()} · dari {partnerName}</Eyebrow>
          <p className="mt-2 font-display text-lg text-ink">{RECEIVED_LINE[latestSupport.action]}</p>
          {latestSupport.message ? (
            <p className="mt-3 font-hand text-2xl leading-snug text-accent-ink">“{latestSupport.message}”</p>
          ) : null}
        </motion.div>
      ) : null}

      {moves.respond ? (
        <RespondPanel
          key={session.round}
          session={session}
          partnerName={partnerName}
          onPreview={setPreview}
        />
      ) : null}

      {viewer === "recipient" && currentSupport && session.status === "responded" ? (
        <div className="rounded-2xl border border-rule bg-paper px-6 py-5">
          <Eyebrow>kamu sudah hadir ♡</Eyebrow>
          <p className="mt-2 text-ink">
            {currentSupport.action ? ACTIONS[currentSupport.action].label : ""}
            {currentSupport.message ? ` — “${currentSupport.message}”` : ""}
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            {partnerName} nggak harus membalas. Kehadiranmu sudah sampai.
          </p>
        </div>
      ) : null}

      {viewer === "recipient" && (session.status === "closed" || session.status === "expired") ? (
        <div className="rounded-2xl border border-dashed border-rule px-6 py-5 text-center">
          <p className="text-ink">
            {session.status === "closed"
              ? session.after_choice
                ? AFTER_FOR_PARTNER[session.after_choice]
                : `${partnerName} sudah menutup ruang ini. Terima kasih sudah ada. ♡`
              : "Ruang kecil ini sudah berlalu. Nggak apa-apa — kalian selalu bisa membuka yang baru."}
          </p>
        </div>
      ) : null}

      {moves.after ? <AfterPanel session={session} partnerName={partnerName} /> : null}

      {viewer === "sender" && (session.status === "closed" || session.status === "expired") ? (
        <EndedPanel session={session} partnerName={partnerName} />
      ) : null}

      {moves.close && !moves.after ? <CloseControl session={session} partnerName={partnerName} /> : null}
    </div>
  );
}

function statusLine(viewer: Viewer, s: HoldSession, them: string): string {
  if (viewer === "sender") {
    switch (s.status) {
      case "pending":
        return `sudah terkirim · ${them} akan datang kalau sempat`;
      case "opened":
        return `${them} sudah membukanya`;
      case "responded":
        return `${them} sudah hadir ♡`;
      case "continued":
        return "ditemani sedikit lebih lama";
      case "closed":
        return "ruang ini sudah ditutup";
      case "expired":
        return "ruang ini sudah berlalu";
    }
  }
  return STATUS_LABEL[s.status] ?? s.status;
}

function SharedDetails({
  viewer,
  session,
  replies,
  privateNote,
  partnerName,
}: {
  viewer: Viewer;
  session: HoldSession;
  replies: HoldReply[];
  privateNote: { intensity: number | null; context: string | null } | null;
  partnerName: string;
}) {
  const need = needInfo(session.need);
  const followups = replies.filter((r) => r.kind === "followup" && r.message);
  const intensity = (v: number | null) => INTENSITY.find((i) => i.value === v)?.label;

  return (
    <section className="flex flex-col gap-3" aria-label="Yang dibagikan">
      <div className="rounded-2xl border border-rule bg-paper px-6 py-5">
        <Eyebrow>{viewer === "recipient" ? "yang dia butuhkan" : "yang kamu minta"}</Eyebrow>
        <p className="mt-2 font-display text-lg text-ink">{need.label}</p>
        <p className="mt-0.5 text-sm text-ink-soft">{need.line}</p>
        <p className="mt-3 font-mono text-[11px] text-ink-faint">
          {timingInfo(session.timing).label}
          {session.shared_intensity ? ` · terasa ${intensity(session.shared_intensity)}` : ""}
        </p>
        {session.shared_context ? (
          <blockquote className="mt-4 border-l-2 border-accent pl-4 text-[15px] leading-relaxed text-ink">
            {session.shared_context}
          </blockquote>
        ) : null}
        {followups.map((f) => (
          <blockquote key={f.id} className="mt-3 border-l-2 border-accent/50 pl-4 text-[15px] leading-relaxed text-ink">
            <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
              {viewer === "sender" ? "kamu menambahkan" : `${partnerName} menambahkan`}
            </span>
            {f.message}
          </blockquote>
        ))}
      </div>

      {viewer === "sender" && privateNote && (privateNote.context || privateNote.intensity) ? (
        <div className="rounded-2xl border border-dashed border-rule px-6 py-4">
          <Eyebrow className="text-ink-faint">🔒 hanya kamu yang bisa melihat ini</Eyebrow>
          {privateNote.intensity ? (
            <p className="mt-2 text-sm text-ink-soft">Terasa {intensity(privateNote.intensity)}.</p>
          ) : null}
          {privateNote.context ? (
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{privateNote.context}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function RespondPanel({
  session,
  partnerName,
  onPreview,
}: {
  session: HoldSession;
  partnerName: string;
  onPreview: (p: { action: HoldAction | null; gesture: HoldGesture | null }) => void;
}) {
  const router = useRouter();
  const options = useMemo(() => orderedActions(session.need), [session.need]);
  const [action, setAction] = useState<HoldAction | null>(null);
  const [gesture, setGesture] = useState<HoldGesture>("wrap");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  // One key per round (the panel remounts per round): a double tap or a retry
  // is the same gesture.
  const [clientKey] = useState(() => crypto.randomUUID());

  function choose(a: HoldAction) {
    setAction(a);
    onPreview({ action: a, gesture: a === "warmth" ? gesture : null });
  }

  function send() {
    if (!action || pending || sent) return;
    setError(null);
    start(async () => {
      try {
        const res = await respondHold({
          id: session.id,
          action,
          gesture: action === "warmth" ? gesture : null,
          message: message.trim() || null,
          clientKey,
        });
        if (res.ok) {
          setSent(true);
          router.refresh();
        } else setError(res.error ?? null);
      } catch {
        setError(NETWORK);
      }
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-3">
          <Eyebrow>let me hold it</Eyebrow>
          <h2 className="mt-1.5 font-display text-xl font-medium text-ink">Bagaimana kamu ingin hadir?</h2>
        </legend>
        {options.map(({ action: a, fit }) => (
          <Choice
            key={a}
            name="action"
            value={a}
            checked={action === a}
            onChange={() => choose(a)}
            title={ACTIONS[a].label}
            line={
              <>
                {ACTIONS[a].purpose}
                <span className={cn("mt-1 block text-xs", fit === "best" ? "text-accent-ink" : "text-ink-faint")}>
                  {fitNote(session.need, a)}
                </span>
              </>
            }
          />
        ))}
        {session.need === "space" ? (
          <p className="text-sm text-ink-faint">
            {partnerName} minta sedikit ruang, jadi &ldquo;I&apos;m Listening&rdquo; disimpan dulu.
          </p>
        ) : null}
      </fieldset>

      {action === "warmth" ? (
        <fieldset>
          <legend className="mb-2 text-sm text-ink-soft">Pilih gestur kecilnya</legend>
          <div className="grid grid-cols-3 gap-2">
            {GESTURES.map((g) => (
              <label
                key={g.key}
                className={cn(
                  "flex min-h-16 cursor-pointer flex-col items-center justify-center rounded-2xl border text-center text-sm transition",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink",
                  gesture === g.key ? "border-accent bg-blush/45 text-ink" : "border-rule text-ink-soft",
                )}
              >
                <input
                  type="radio"
                  name="gesture"
                  value={g.key}
                  checked={gesture === g.key}
                  onChange={() => {
                    setGesture(g.key);
                    onPreview({ action: "warmth", gesture: g.key });
                  }}
                  className="sr-only"
                />
                <span aria-hidden className="text-xl">{g.emoji}</span>
                {g.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {action ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="hold-message" className="text-sm text-ink-soft">
            Sepatah kata (opsional) — pakai kalimatmu sendiri, atau mulai dari salah satu ini:
          </label>
          <div className="flex flex-wrap gap-2">
            {ACTIONS[action].presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setMessage(p)}
                className="rounded-full border border-rule px-3 py-1.5 text-left text-sm text-ink-soft transition hover:border-accent-ink/40 hover:text-ink"
              >
                {p}
              </button>
            ))}
          </div>
          <textarea
            id="hold-message"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 500))}
            rows={3}
            className="w-full resize-none rounded-2xl border border-rule bg-paper px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint focus:border-accent-ink/50 focus:outline-none"
            placeholder="Aku di sini…"
          />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button size="lg" onClick={send} disabled={!action || pending || sent} aria-busy={pending}>
          {pending ? "Mengirim…" : sent ? "Terkirim ♡" : "Hadir untuknya"}
        </Button>
      </div>
    </section>
  );
}

function AfterPanel({ session, partnerName }: { session: HoldSession; partnerName: string }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [choice, setChoice] = useState<HoldAfter | null>(null);
  const [need, setNeed] = useState<HoldNeed>(session.need);
  const [followup, setFollowup] = useState("");
  const [keep, setKeep] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const [clientKey] = useState(() => crypto.randomUUID());

  function submit() {
    if (!choice || pending || done) return;
    setError(null);
    start(async () => {
      try {
        const res = await afterHold({
          id: session.id,
          choice,
          newNeed: choice === "longer" && need !== session.need ? need : null,
          followup: choice === "longer" ? followup.trim() || null : null,
          keep,
          clientKey,
        });
        if (res.ok) {
          setDone(true);
          router.refresh();
        } else setError(res.error ?? null);
      } catch {
        setError(NETWORK);
      }
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-3">
          <Eyebrow>what do you need now?</Eyebrow>
          <h2 className="mt-1.5 font-display text-xl font-medium text-ink">Sekarang, apa yang kamu butuhkan?</h2>
          <p className="mt-1 text-sm text-ink-soft">Nggak ada jawaban yang salah. Perasaanmu nggak harus sudah hilang.</p>
        </legend>
        {AFTER.map((a) => (
          <Choice
            key={a.key}
            name="after"
            value={a.key}
            checked={choice === a.key}
            onChange={(v) => setChoice(v as HoldAfter)}
            title={a.label}
            line={a.line}
          />
        ))}
      </fieldset>

      <AnimatePresence mode="wait" initial={false}>
        {choice ? (
          <motion.div
            key={choice}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-3"
          >
            {choice === "longer" ? (
              <>
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-sm text-ink-soft">
                    Masih butuh hal yang sama? Boleh diganti, tanpa rasa bersalah.
                  </legend>
                  {NEEDS.map((n) => (
                    <Choice
                      key={n.key}
                      name="new-need"
                      value={n.key}
                      checked={need === n.key}
                      onChange={(v) => setNeed(v as HoldNeed)}
                      title={n.label}
                    />
                  ))}
                </fieldset>
                <label htmlFor="hold-followup" className="text-sm text-ink-soft">
                  Mau menambahkan sesuatu untuk {partnerName}? (opsional)
                </label>
                <textarea
                  id="hold-followup"
                  value={followup}
                  onChange={(e) => setFollowup(e.target.value.slice(0, 500))}
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-rule bg-paper px-4 py-3 text-[15px] text-ink focus:border-accent-ink/50 focus:outline-none"
                />
              </>
            ) : (
              <KeepChoice keep={keep} setKeep={setKeep} partnerName={partnerName} />
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button size="lg" onClick={submit} disabled={!choice || pending || done} aria-busy={pending}>
          {pending
            ? "Sebentar…"
            : choice === "longer"
              ? "Temani aku lagi"
              : choice === "quiet"
                ? "Tenang dulu"
                : "Simpan perasaan ini"}
        </Button>
      </div>
    </section>
  );
}

function KeepChoice({
  keep,
  setKeep,
  partnerName,
}: {
  keep: boolean;
  setKeep: (v: boolean) => void;
  partnerName: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-rule px-4 py-3">
      <input
        type="checkbox"
        checked={keep}
        onChange={(e) => setKeep(e.target.checked)}
        className="mt-1 h-4 w-4 accent-[var(--accent-ink)]"
      />
      <span className="text-sm text-ink-soft">
        <span className="block text-[15px] text-ink">Simpan di Past Holds</span>
        {keep
          ? `Ruang ini akan tetap ada untuk kamu dan ${partnerName}, sampai kamu melepaskannya.`
          : `Kalau tidak disimpan, kata-katanya dihapus sekarang dan sisa ruangnya hilang dalam 7 hari — untuk kalian berdua.`}
      </span>
    </label>
  );
}

function CloseControl({ session, partnerName }: { session: HoldSession; partnerName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [keep, setKeep] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const confirmRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full px-4 py-2 text-sm text-ink-faint transition hover:text-ink-soft"
        >
          {session.status === "pending" ? "Tarik kembali ruang ini" : "Tutup ruang ini"}
        </button>
      </div>
    );
  }

  return (
    <div
      ref={confirmRef}
      tabIndex={-1}
      role="group"
      aria-label="Konfirmasi menutup ruang"
      className="flex flex-col gap-3 rounded-2xl border border-rule px-5 py-4 focus:outline-none"
    >
      <p className="text-ink">Tutup ruang ini sekarang?</p>
      <p className="text-sm text-ink-soft">
        {partnerName} nggak akan bisa menanggapinya lagi. Kamu bisa membuka ruang baru kapan saja.
      </p>
      <KeepChoice keep={keep} setKeep={setKeep} partnerName={partnerName} />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
          Batal
        </Button>
        <Button
          variant="soft"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              try {
                const res = await closeHold({ id: session.id, keep });
                if (res.ok) router.refresh();
                else setError(res.error ?? null);
              } catch {
                setError(NETWORK);
              }
            })
          }
        >
          {pending ? "Menutup…" : "Ya, tutup"}
        </Button>
      </div>
    </div>
  );
}

function EndedPanel({ session, partnerName }: { session: HoldSession; partnerName: string }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok?: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      try {
        const res = await fn();
        if (res.ok) (after ?? (() => router.refresh()))();
        else setError(res.error ?? null);
      } catch {
        setError(NETWORK);
      }
    });

  const closingLine =
    session.after_choice === "less_alone"
      ? "Kamu merasa sedikit lebih ditemani. Itu sudah cukup."
      : session.after_choice === "quiet"
        ? "Kamu memilih tenang dulu. Ruangnya dijaga."
        : session.status === "expired"
          ? "Ruang ini sudah berlalu. Kamu selalu bisa membuka yang baru."
          : "Ruang ini sudah ditutup.";

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-dashed border-rule px-6 py-5">
      <p className="font-display text-lg text-ink">{closingLine}</p>
      <p className="text-sm text-ink-soft">
        {session.kept
          ? `Tersimpan di Past Holds — terlihat oleh kamu dan ${partnerName}.`
          : "Tidak disimpan: kata-katanya sudah dihapus, dan ruang ini hilang sendiri dalam 7 hari."}
      </p>
      <div className="flex flex-wrap gap-2">
        {session.kept ? (
          <Button variant="soft" size="sm" disabled={pending} onClick={() => run(() => setHoldKept({ id: session.id, keep: false }))}>
            Lepaskan dari Past Holds
          </Button>
        ) : (
          <Button variant="soft" size="sm" disabled={pending} onClick={() => run(() => setHoldKept({ id: session.id, keep: true }))}>
            Simpan (tanpa kata-kata yang sudah dihapus)
          </Button>
        )}
        {!confirmDelete ? (
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
            Hapus sekarang
          </Button>
        ) : null}
        <Link href="/hold/new" className="inline-flex h-9 items-center px-3 text-sm text-accent-ink hover:underline">
          Buka ruang baru →
        </Link>
      </div>
      {confirmDelete ? (
        <div role="group" aria-label="Konfirmasi hapus" className="rounded-xl bg-paper-2 px-4 py-3">
          <p className="text-sm text-ink">
            Hapus selamanya? Ruang ini, gestur dari {partnerName}, dan pesannya akan hilang untuk kalian
            berdua. Tidak bisa dikembalikan.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={pending}>
              Batal
            </Button>
            <Button
              variant="soft"
              size="sm"
              disabled={pending}
              className="text-danger"
              onClick={() => run(() => deleteHold(session.id), () => router.push("/hold"))}
            >
              Ya, hapus
            </Button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
