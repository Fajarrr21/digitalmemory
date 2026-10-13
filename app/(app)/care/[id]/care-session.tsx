"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import type { CareAfter, CareAnswer, CareKind } from "@/lib/supabase/database.types";
import type { CareAction, CarePrivate, CareSession } from "@/lib/care/queries";
import { canCare, isLive, orbPhase, safetyLevel, sipGently, suggestedCare } from "@/lib/care/logic";
import { CareOrb, CareRoom, GestureBloom } from "@/components/care/care-room";
import { SafetyCard } from "@/components/care/safety-card";
import { Choice } from "@/components/hold/choice";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/utils";
import {
  afterCare,
  answerCare,
  careFor,
  closeCare,
  deleteCare,
  setCareKept,
  setCareRest,
} from "../actions";
import {
  ACCOMPANY,
  AFTER,
  AFTER_FOR_CARER,
  DRINK_SIP_NOTE,
  GESTURES,
  HELP,
  MESSAGE_PRESETS,
  NOT_MEDICAL,
  REST_RECEIVED,
  redFlagLabel,
  severityLabel,
  symptomInfo,
  wantInfo,
} from "../care-config";

type Viewer = "sender" | "carer";
type Gesture = "hug" | "glow" | "star";

const NETWORK = "Koneksinya terputus. Coba lagi — nggak akan terkirim dua kali. ♡";

export function CareSessionView({
  viewer,
  session,
  actions,
  privateNote,
  partnerName,
  sentLabel,
}: {
  viewer: Viewer;
  session: CareSession;
  actions: CareAction[];
  privateNote: CarePrivate | null;
  partnerName: string;
  sentLabel: string;
}) {
  const router = useRouter();
  const live = isLive(session.status);
  const phase = orbPhase(session.status, actions.length > 0);

  // The latest gesture blooms on the orb; the carer's own pick previews first.
  const latestGesture = [...actions].reverse().find((a) => a.kind === "gesture");
  const [bloom, setBloom] = useState<{ kind: Gesture; key: string } | null>(
    latestGesture ? { kind: latestGesture.variant as Gesture, key: latestGesture.id } : null,
  );

  // Both sides look again now and then while the room is alive and visible.
  useEffect(() => {
    if (!live) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 20000);
    return () => window.clearInterval(t);
  }, [live, router]);

  // The sender's own safety level comes from the private, full truth.
  const ownLevel = privateNote
    ? safetyLevel({ severity: privateNote.severity, redFlags: privateNote.red_flags, symptoms: privateNote.symptoms })
    : "none";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link href="/care" className="text-sm text-ink-faint hover:text-ink-soft">
          ← Little Care
        </Link>
        <p className="font-mono text-[11px] text-ink-faint">{sentLabel}</p>
      </div>

      {/* Safety first — above every comforting thing, while the room is alive. */}
      {live && viewer === "sender" && ownLevel !== "none" ? <SafetyCard level={ownLevel} /> : null}
      {live && viewer === "carer" && session.needs_check ? (
        <SafetyCard level="urgent" viewer="carer" partnerName={partnerName} />
      ) : null}

      <CareRoom dim={phase === "resting"}>
        <div className="flex flex-col items-center px-6 pt-7 pb-8 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#f6c98d]">
            {viewer === "carer" ? "let me care for you" : "little care-mu"}
          </p>
          <div className="relative my-1 w-full max-w-[15rem]">
            <CareOrb phase={phase} label={orbLabel(phase)} />
            {bloom ? <GestureBloom kind={bloom.kind} playKey={bloom.key} /> : null}
          </div>
          <h1 className="font-display text-xl leading-snug font-medium text-balance md:text-2xl">
            {viewer === "carer" ? `${partnerName} sedang nggak enak badan.` : "Kamu nggak sendirian."}
          </h1>
          {viewer === "carer" ? (
            <p className="mt-2 max-w-sm text-[15px] text-[#f2e2d6]/85">
              Kamu nggak harus menyembuhkannya. Cukup hadir dengan cara yang dia minta.
            </p>
          ) : null}
          <p aria-live="polite" className="mt-4 rounded-full bg-white/10 px-3 py-1 font-mono text-[11px] tracking-wide text-[#fff3e4]/90">
            {statusLine(viewer, session, actions.length > 0, partnerName)}
          </p>
        </div>
      </CareRoom>

      <SharedDetails viewer={viewer} session={session} privateNote={privateNote} partnerName={partnerName} />

      {viewer === "carer" && session.after_choice && live ? (
        <p className="rounded-2xl border border-dashed border-rule px-5 py-4 text-ink">
          {AFTER_FOR_CARER[session.after_choice]}
        </p>
      ) : null}

      {viewer === "carer" && live ? (
        <CarePanel session={session} actions={actions} partnerName={partnerName} onGesture={setBloom} />
      ) : null}

      <CareFeed viewer={viewer} session={session} actions={actions} partnerName={partnerName} />

      {viewer === "sender" && live ? (
        <>
          <RestSwitch session={session} partnerName={partnerName} />
          {actions.length > 0 ? (
            <AfterPanel session={session} level={ownLevel} />
          ) : (
            <CloseControl session={session} partnerName={partnerName} />
          )}
        </>
      ) : null}

      {!live ? <EndedPanel viewer={viewer} session={session} partnerName={partnerName} /> : null}

      <SafetyCard level="gentle" />
      <p className="text-center text-xs leading-relaxed text-ink-faint">{NOT_MEDICAL}</p>
    </div>
  );
}

function orbLabel(phase: ReturnType<typeof orbPhase>) {
  switch (phase) {
    case "waiting":
      return "Bola cahaya yang menunggu";
    case "cared":
      return "Bola cahaya dengan satu cahaya kecil yang menemaninya";
    case "resting":
      return "Bola cahaya yang beristirahat di bawah bulan";
    case "ended":
      return "Bola cahaya yang tenang";
    default:
      return "Sebuah bola cahaya kecil berbentuk hati";
  }
}

function statusLine(viewer: Viewer, s: CareSession, cared: boolean, them: string): string {
  if (s.status === "closed") return s.after_choice === "better" ? "sedikit lebih nyaman ♡" : "little care ini sudah ditutup";
  if (s.status === "expired") return "little care ini sudah berlalu";
  if (viewer === "sender") {
    if (s.status === "resting") return "mode istirahat · nggak ada yang perlu dibalas";
    if (cared) return `${them} sedang menemanimu ♡`;
    return s.opened_at ? `${them} sudah membukanya` : `terkirim · ${them} akan datang`;
  }
  if (s.status === "resting") return "dia sedang istirahat · satu pesan untuk nanti";
  return cared ? "kamu sedang menemaninya" : "dia menunggumu, pelan-pelan saja";
}

function SharedDetails({
  viewer,
  session,
  privateNote,
  partnerName,
}: {
  viewer: Viewer;
  session: CareSession;
  privateNote: CarePrivate | null;
  partnerName: string;
}) {
  const sharedSymptoms = session.shared_symptoms;
  // Without shared details, assume a drink should be sip-by-sip anyway.
  const sip = sharedSymptoms ? sipGently(sharedSymptoms) : true;

  return (
    <section className="flex flex-col gap-3" aria-label="Yang dibagikan">
      <div className="rounded-2xl border border-rule bg-paper px-6 py-5">
        <Eyebrow>{viewer === "carer" ? "yang dia butuhkan" : "yang kamu minta"}</Eyebrow>
        <ul className="mt-3 flex flex-col gap-2.5">
          {session.wants.map((w) => {
            const info = wantInfo(w);
            return (
              <li key={w} className="flex gap-3">
                <span aria-hidden className="text-lg">{info.emoji}</span>
                <span>
                  <span className="block font-display text-[17px] text-ink">{info.label}</span>
                  <span className="block text-sm text-ink-soft">{info.line}</span>
                  {w === "drink" && sip ? <span className="mt-0.5 block text-xs text-accent-ink">{DRINK_SIP_NOTE}</span> : null}
                  {w === "warm" && viewer === "carer" && info.note ? (
                    <span className="mt-0.5 block text-xs text-ink-faint">{info.note}</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>

        {sharedSymptoms ? (
          <div className="mt-5 border-t border-rule-soft pt-4">
            <Eyebrow>{viewer === "carer" ? `yang ${partnerName} rasakan` : `yang ${partnerName} bisa lihat`}</Eyebrow>
            <p className="mt-2 text-[15px] text-ink">
              {sharedSymptoms.map((s) => `${symptomInfo(s).emoji} ${symptomInfo(s).label}`).join(" · ")}
            </p>
            <p className="mt-1 font-mono text-[11px] text-ink-faint">terasa {severityLabel(session.shared_severity).toLowerCase()} · bukan diagnosis</p>
          </div>
        ) : viewer === "carer" ? (
          <p className="mt-5 border-t border-rule-soft pt-4 text-sm text-ink-faint">
            {partnerName} memilih untuk nggak membagikan detail keluhannya. Nggak apa-apa — yang penting kamu tahu
            apa yang dia butuhkan.
          </p>
        ) : null}

        {session.shared_note ? (
          <blockquote className="mt-4 border-l-2 border-accent pl-4 text-[15px] leading-relaxed text-ink">
            {session.shared_note}
          </blockquote>
        ) : null}
      </div>

      {viewer === "sender" && privateNote ? (
        <div className="rounded-2xl border border-dashed border-rule px-6 py-4">
          <Eyebrow className="text-ink-faint">🔒 hanya kamu yang bisa melihat ini</Eyebrow>
          {!sharedSymptoms ? (
            <p className="mt-2 text-sm text-ink-soft">
              {privateNote.symptoms.map((s) => symptomInfo(s).label).join(", ")} · {severityLabel(privateNote.severity)}
            </p>
          ) : null}
          {privateNote.note && !session.shared_note ? (
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{privateNote.note}</p>
          ) : null}
          {privateNote.red_flags.length ? (
            <ul className="mt-2 list-inside list-disc text-sm text-danger">
              {privateNote.red_flags.map((r) => (
                <li key={r}>{redFlagLabel(r)}</li>
              ))}
            </ul>
          ) : null}
          {privateNote.red_flags.length || privateNote.severity === "severe" ? (
            <p className="mt-2 text-xs text-ink-faint">
              {session.needs_check
                ? `${partnerName} hanya tahu bahwa kamu mungkin perlu diperiksa.`
                : `${partnerName} nggak diberi tahu soal ini.`}
            </p>
          ) : null}
          {sharedSymptoms && !privateNote.note && !privateNote.red_flags.length ? (
            <p className="mt-2 text-sm text-ink-faint">Nggak ada yang kamu simpan sendiri.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

// ---- The carer's side: "Let Me Care for You" --------------------------------

type Picked =
  | { kind: "gesture"; variant: Gesture }
  | { kind: "message"; message: string }
  | { kind: "accompany"; variant: "chat" | "call" }
  | { kind: "rest" }
  | { kind: "help"; variant: "drink" | "family" | "medical" | "close" };

const TILES: { kind: CareKind; emoji: string; label: string; line: string }[] = [
  { kind: "gesture", emoji: "🫂", label: "Kirim pelukan", line: "Tanpa kata — pelukan, cahaya hangat, atau bintang." },
  { kind: "message", emoji: "✉️", label: "Pesan personal", line: "Satu kalimat dari kamu sendiri." },
  { kind: "accompany", emoji: "🤍", label: "Temani dia", line: "Tawarkan chat atau telepon — dia yang memutuskan." },
  { kind: "rest", emoji: "🌙", label: "Beri ruang istirahat", line: "Kamu nggak akan terus menanyakan kabarnya." },
  { kind: "help", emoji: "🧺", label: "Bantuan nyata", line: "Minum, keluarga, orang terdekat, atau pertolongan medis." },
];

function CarePanel({
  session,
  actions,
  partnerName,
  onGesture,
}: {
  session: CareSession;
  actions: CareAction[];
  partnerName: string;
  onGesture: (b: { kind: Gesture; key: string }) => void;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const suggested = useMemo(() => suggestedCare(session.wants, session.needs_check), [session.wants, session.needs_check]);
  const restNoteUsed =
    session.status === "resting" &&
    actions.some((a) => a.kind === "message" && session.rest_since && a.created_at >= session.rest_since);

  const [tile, setTile] = useState<CareKind | null>(session.needs_check ? "help" : null);
  const [gesture, setGesture] = useState<Gesture>("hug");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentNote, setSentNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // One key per attempt; kept across a network retry so nothing doubles.
  const keyRef = useRef<string>(crypto.randomUUID());

  const isSuggested = (kind: CareKind, variant: string | null = null) =>
    suggested.some((s) => s.kind === kind && (variant === null || s.variant === variant));

  function send(care: Picked) {
    if (pending) return;
    setError(null);
    setSentNote(null);
    start(async () => {
      try {
        const res = await careFor({ id: session.id, clientKey: keyRef.current, care });
        if (!res.ok) {
          setError(res.error ?? null);
          return;
        }
        keyRef.current = crypto.randomUUID();
        if (care.kind === "gesture") onGesture({ kind: care.variant, key: keyRef.current });
        if (care.kind === "message") setMessage("");
        setSentNote(
          care.kind === "rest"
            ? "Tercatat. Kamu nggak harus terus bertanya — dia tahu kamu ada. ♡"
            : care.kind === "accompany" || care.kind === "help"
              ? "Tawaranmu sudah sampai. Dia yang memutuskan, tanpa tekanan."
              : "Sudah sampai. ♡",
        );
        router.refresh();
      } catch {
        setError(NETWORK);
      }
    });
  }

  const blocked = (kind: CareKind) => canCare(kind, session.status, restNoteUsed);

  return (
    <section className="flex flex-col gap-4" aria-labelledby="care-panel-title">
      <div>
        <Eyebrow>let me care for you</Eyebrow>
        <h2 id="care-panel-title" className="mt-1.5 font-display text-xl font-medium text-ink">
          Bagaimana kamu ingin merawatnya?
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Pilih yang terasa pas. {partnerName} nggak perlu membalas apa pun.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {TILES.map((t) => {
          const gate = blocked(t.kind);
          return (
            <button
              key={t.kind}
              type="button"
              onClick={() => setTile(tile === t.kind ? null : t.kind)}
              aria-expanded={tile === t.kind}
              disabled={!gate.ok}
              className={cn(
                "flex min-h-16 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink disabled:opacity-50",
                tile === t.kind ? "border-accent bg-blush/45" : "border-rule bg-paper hover:border-accent-ink/40",
              )}
            >
              <span aria-hidden className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-paper-2 text-lg">
                {t.emoji}
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-medium text-ink">
                  {t.label}
                  {isSuggested(t.kind) ? (
                    <span className="ml-2 rounded-full bg-[#f6c98d]/30 px-2 py-0.5 align-middle font-mono text-[10px] text-accent-ink">
                      dia minta ini
                    </span>
                  ) : null}
                </span>
                <span className="block text-sm text-ink-soft">
                  {!gate.ok && gate.reason === "resting"
                    ? "Disimpan dulu — dia sedang istirahat."
                    : !gate.ok && gate.reason === "rest_note_used"
                      ? "Pesanmu untuk nanti sudah ada. ♡"
                      : t.line}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {tile ? (
        <motion.div
          key={tile}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3 rounded-2xl border border-rule bg-paper px-5 py-5"
        >
          {tile === "gesture" ? (
            <>
              <fieldset>
                <legend className="mb-2 text-sm text-ink-soft">Pilih gestur kecilnya — tanpa kata pun cukup.</legend>
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
                        onChange={() => setGesture(g.key)}
                        className="sr-only"
                      />
                      <span aria-hidden className="text-xl">{g.emoji}</span>
                      {g.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="flex justify-end">
                <Button onClick={() => send({ kind: "gesture", variant: gesture })} disabled={pending} aria-busy={pending}>
                  {pending ? "Mengirim…" : "Kirim"}
                </Button>
              </div>
            </>
          ) : null}

          {tile === "message" ? (
            <>
              <label htmlFor="care-message" className="text-sm text-ink-soft">
                {session.status === "resting"
                  ? "Dia sedang istirahat. Tinggalkan satu pesan — dia akan membacanya nanti."
                  : "Pendek saja. Pakai kalimatmu sendiri, atau mulai dari salah satu ini:"}
              </label>
              <div className="flex flex-wrap gap-2">
                {MESSAGE_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setMessage(p.slice(0, 280))}
                    className="rounded-full border border-rule px-3 py-1.5 text-left text-sm text-ink-soft transition hover:border-accent-ink/40 hover:text-ink"
                  >
                    {p}
                  </button>
                ))}
              </div>
              <textarea
                id="care-message"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 280))}
                rows={3}
                placeholder="Aku di sini…"
                className="w-full resize-none rounded-2xl border border-rule bg-paper px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint focus:border-accent-ink/50 focus:outline-none"
              />
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-ink-faint">{message.length}/280</span>
                <Button onClick={() => send({ kind: "message", message })} disabled={pending || !message.trim()} aria-busy={pending}>
                  {pending ? "Mengirim…" : "Kirim pesan"}
                </Button>
              </div>
            </>
          ) : null}

          {tile === "accompany" ? (
            <>
              <p className="text-sm text-ink-soft">
                Ini tawaran, bukan ajakan wajib. {partnerName} bisa jawab &ldquo;iya&rdquo; atau &ldquo;nanti dulu&rdquo;.
              </p>
              <div className="flex flex-wrap gap-2">
                {ACCOMPANY.map((a) => (
                  <Button key={a.key} variant="soft" onClick={() => send({ kind: "accompany", variant: a.key })} disabled={pending}>
                    {a.key === "call" ? "📞" : "💬"} {a.label}
                  </Button>
                ))}
              </div>
            </>
          ) : null}

          {tile === "rest" ? (
            <>
              <p className="text-sm text-ink-soft">
                Kamu menandai bahwa kamu akan membiarkan {partnerName} istirahat, tanpa terus menanyakan kondisinya.
                Dia nggak akan dapat notifikasi untuk ini.
              </p>
              <div className="flex justify-end">
                <Button onClick={() => send({ kind: "rest" })} disabled={pending}>
                  🌙 Istirahatlah, aku di sini
                </Button>
              </div>
            </>
          ) : null}

          {tile === "help" ? (
            <>
              <p className="text-sm text-ink-soft">
                Tanyakan dulu — {partnerName} yang memilih. Kalau keadaannya darurat, jangan tunggu jawaban di sini:
                telepon dia, atau hubungi orang di dekatnya.
              </p>
              <div className="flex flex-col gap-2">
                {HELP.map((h) => (
                  <Button
                    key={h.key}
                    variant="soft"
                    className={cn("justify-start", isSuggested("help", h.key) && "border-accent")}
                    onClick={() => send({ kind: "help", variant: h.key })}
                    disabled={pending}
                  >
                    {h.label}
                    {isSuggested("help", h.key) ? <span className="font-mono text-[10px] text-accent-ink">· disarankan</span> : null}
                  </Button>
                ))}
              </div>
            </>
          ) : null}
        </motion.div>
      ) : null}

      {sentNote ? (
        <p role="status" className="text-sm text-accent-ink">
          {sentNote}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}

// ---- The feed — what's arrived / what you've given ---------------------------

function describe(a: CareAction, viewer: Viewer, them: string): { emoji: string; line: string } {
  const who = viewer === "sender" ? them : "Kamu";
  switch (a.kind) {
    case "gesture": {
      const g = GESTURES.find((x) => x.key === a.variant);
      return { emoji: g?.emoji ?? "🫂", line: `${who} ${g?.received ?? "mengirim pelukan."}` };
    }
    case "message":
      return { emoji: "✉️", line: viewer === "sender" ? `Pesan dari ${them}` : "Pesanmu" };
    case "accompany": {
      const o = ACCOMPANY.find((x) => x.key === a.variant);
      return { emoji: a.variant === "call" ? "📞" : "💬", line: `${who} ${o?.offer ?? ""}` };
    }
    case "rest":
      return { emoji: "🌙", line: `${who} ${REST_RECEIVED}` };
    case "help": {
      const o = HELP.find((x) => x.key === a.variant);
      return { emoji: "🧺", line: `${who} ${o?.offer ?? ""}` };
    }
  }
}

function CareFeed({
  viewer,
  session,
  actions,
  partnerName,
}: {
  viewer: Viewer;
  session: CareSession;
  actions: CareAction[];
  partnerName: string;
}) {
  const reduce = useReducedMotion();
  if (actions.length === 0) {
    return viewer === "sender" && isLive(session.status) ? (
      <p className="text-center text-sm text-ink-soft">
        {partnerName} akan datang. Sementara itu, kamu nggak perlu melakukan apa-apa — cukup istirahat.
      </p>
    ) : null;
  }
  const live = isLive(session.status);

  return (
    <section aria-label={viewer === "sender" ? "Perhatian yang datang" : "Yang sudah kamu berikan"} className="flex flex-col gap-2.5">
      <Eyebrow>{viewer === "sender" ? `dari ${partnerName}` : "yang sudah kamu berikan"}</Eyebrow>
      <ul className="flex flex-col gap-2.5">
        {[...actions].reverse().map((a) => {
          const d = describe(a, viewer, partnerName);
          const offer = a.kind === "accompany" || a.kind === "help";
          return (
            <motion.li
              key={a.id}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "rounded-2xl border px-5 py-4",
                a.kind === "message" ? "border-accent/40 bg-blush/30" : "border-rule bg-paper",
              )}
            >
              <p className="flex gap-2.5 text-[15px] text-ink">
                <span aria-hidden>{d.emoji}</span>
                <span>{d.line}</span>
              </p>
              {a.message ? (
                <p className="mt-2 font-hand text-2xl leading-snug text-accent-ink">“{a.message}”</p>
              ) : null}
              {offer ? <OfferAnswer viewer={viewer} action={a} sessionId={session.id} live={live} partnerName={partnerName} /> : null}
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
}

function OfferAnswer({
  viewer,
  action,
  sessionId,
  live,
  partnerName,
}: {
  viewer: Viewer;
  action: CareAction;
  sessionId: string;
  live: boolean;
  partnerName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (viewer === "carer") {
    return (
      <p className="mt-2 font-mono text-[11px] text-ink-faint">
        {action.answer === "yes"
          ? `${partnerName}: iya, mau ♡ — sekarang giliranmu, di dunia nyata.`
          : action.answer === "not_now"
            ? `${partnerName}: nanti dulu. Nggak apa-apa.`
            : "belum dijawab — dan nggak harus."}
      </p>
    );
  }

  const answer = (v: CareAnswer) =>
    start(async () => {
      setError(null);
      try {
        const res = await answerCare({ sessionId, actionId: action.id, answer: v });
        if (res.ok) router.refresh();
        else setError(res.error ?? null);
      } catch {
        setError(NETWORK);
      }
    });

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {live ? (
        <>
          <Button size="sm" variant={action.answer === "yes" ? "primary" : "soft"} disabled={pending} onClick={() => answer("yes")}>
            Iya, mau
          </Button>
          <Button size="sm" variant={action.answer === "not_now" ? "primary" : "ghost"} disabled={pending} onClick={() => answer("not_now")}>
            Nanti dulu
          </Button>
        </>
      ) : null}
      <span className="font-mono text-[11px] text-ink-faint">
        {action.answer === "yes" ? "kamu bilang iya ♡" : action.answer === "not_now" ? "kamu bilang nanti dulu" : "nggak harus dijawab"}
      </span>
      {error ? (
        <p role="alert" className="w-full text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// ---- The sender's side --------------------------------------------------------

function RestSwitch({ session, partnerName }: { session: CareSession; partnerName: string }) {
  const router = useRouter();
  const on = session.status === "resting";
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border border-rule px-5 py-4">
      <label className="flex cursor-pointer items-start justify-between gap-4">
        <span>
          <span className="block text-[15px] text-ink">🌙 Rest without pressure</span>
          <span className="mt-0.5 block text-sm text-ink-faint">
            {on
              ? `Kamu sedang istirahat. Nggak ada WhatsApp dari Little Care, dan ${partnerName} cukup meninggalkan satu pesan untuk nanti.`
              : "Nyalakan kalau kamu mau tidur atau istirahat tanpa diganggu."}
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={on}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            setError(null);
            start(async () => {
              try {
                const res = await setCareRest({ id: session.id, on: next });
                if (res.ok) router.refresh();
                else setError(res.error ?? null);
              } catch {
                setError(NETWORK);
              }
            });
          }}
          className="mt-1 h-5 w-5 flex-none accent-[var(--accent-ink)]"
        />
      </label>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function AfterPanel({ session, level }: { session: CareSession; level: ReturnType<typeof safetyLevel> }) {
  const router = useRouter();
  const [choice, setChoice] = useState<CareAfter | null>(null);
  const [keep, setKeep] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    if (!choice || pending) return;
    setError(null);
    start(async () => {
      try {
        const res = await afterCare({ id: session.id, choice, keep });
        if (res.ok) {
          setChoice(null);
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
          <Eyebrow>a little better?</Eyebrow>
          <h2 className="mt-1.5 font-display text-xl font-medium text-ink">Sekarang, gimana rasanya?</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Nggak harus sudah sembuh. Ini cuma tentang apa yang kamu rasakan sekarang.
          </p>
        </legend>
        {AFTER.map((a) => (
          <Choice
            key={a.key}
            name="after"
            value={a.key}
            checked={choice === a.key}
            onChange={(v) => setChoice(v as CareAfter)}
            title={a.label}
            line={a.line}
          />
        ))}
      </fieldset>

      {choice && level !== "none" ? (
        <p role="note" className="rounded-2xl border border-danger/40 px-4 py-3 text-sm text-ink">
          {choice === "better"
            ? "Senang kalau terasa sedikit lebih nyaman. Tapi rasa nyaman sesaat belum tentu berarti kondisinya aman — tetap periksakan, ya."
            : "Istirahat boleh — tapi dengan tanda-tanda tadi, tolong jangan cuma menunggu. Minta orang di dekatmu membantumu diperiksa."}
        </p>
      ) : null}

      {choice === "better" ? <KeepChoice keep={keep} setKeep={setKeep} /> : null}

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button size="lg" onClick={submit} disabled={!choice || pending} aria-busy={pending}>
          {pending ? "Sebentar…" : choice === "longer" ? "Temani aku lagi" : choice === "rest" ? "Istirahat dulu" : "Tutup dengan lembut"}
        </Button>
      </div>
    </section>
  );
}

function KeepChoice({ keep, setKeep }: { keep: boolean; setKeep: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-rule px-4 py-3">
      <input
        type="checkbox"
        checked={keep}
        onChange={(e) => setKeep(e.target.checked)}
        className="mt-1 h-4 w-4 accent-[var(--accent-ink)]"
      />
      <span className="text-sm text-ink-soft">
        <span className="block text-[15px] text-ink">Simpan sebagai kenangan</span>
        {keep
          ? "Tetap ada untuk kalian berdua (detailnya hanya terlihat kalau dibuka), sampai kamu melepaskannya."
          : "Kalau tidak disimpan, detail keluhan dan pesannya dihapus sekarang, dan sisanya hilang dalam 7 hari."}
      </span>
    </label>
  );
}

function CloseControl({ session, partnerName }: { session: CareSession; partnerName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full px-4 py-2 text-sm text-ink-faint transition hover:text-ink-soft"
        >
          Tarik kembali Little Care ini
        </button>
      </div>
    );
  }

  return (
    <div role="group" aria-label="Konfirmasi menutup" className="flex flex-col gap-3 rounded-2xl border border-rule px-5 py-4">
      <p className="text-ink">Tutup sekarang?</p>
      <p className="text-sm text-ink-soft">
        {partnerName} nggak akan bisa merawatmu di sini lagi. Detailnya langsung dihapus.
      </p>
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
                const res = await closeCare({ id: session.id, keep: false });
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

function EndedPanel({ viewer, session, partnerName }: { viewer: Viewer; session: CareSession; partnerName: string }) {
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

  const line =
    session.status === "expired"
      ? "Little Care ini sudah berlalu. Kalian selalu bisa membuka yang baru."
      : session.after_choice === "better"
        ? viewer === "sender"
          ? "Kamu merasa sedikit lebih nyaman. Itu sudah cukup. ♡"
          : AFTER_FOR_CARER.better
        : viewer === "sender"
          ? "Little Care ini sudah ditutup."
          : `${partnerName} sudah menutup Little Care ini. Terima kasih sudah ada. ♡`;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-dashed border-rule px-6 py-5">
      <p className="font-display text-lg text-ink">{line}</p>
      {viewer === "sender" ? (
        <>
          <p className="text-sm text-ink-soft">
            {session.kept
              ? `Tersimpan — terlihat oleh kamu dan ${partnerName}.`
              : "Tidak disimpan: detail kesehatan dan pesannya sudah dihapus, dan sisanya hilang sendiri dalam 7 hari."}
          </p>
          <div className="flex flex-wrap gap-2">
            {session.kept ? (
              <Button variant="soft" size="sm" disabled={pending} onClick={() => run(() => setCareKept({ id: session.id, keep: false }))}>
                Lepaskan
              </Button>
            ) : (
              <Button variant="soft" size="sm" disabled={pending} onClick={() => run(() => setCareKept({ id: session.id, keep: true }))}>
                Simpan (tanpa detail yang sudah dihapus)
              </Button>
            )}
            {!confirmDelete ? (
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                Hapus sekarang
              </Button>
            ) : null}
            <Link href="/care/new" className="inline-flex h-9 items-center px-3 text-sm text-accent-ink hover:underline">
              Buka yang baru →
            </Link>
          </div>
          {confirmDelete ? (
            <div role="group" aria-label="Konfirmasi hapus" className="rounded-xl bg-paper-2 px-4 py-3">
              <p className="text-sm text-ink">
                Hapus selamanya? Little Care ini dan semua perhatian dari {partnerName} akan hilang untuk kalian berdua.
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
                  onClick={() => run(() => deleteCare(session.id), () => router.push("/care"))}
                >
                  Ya, hapus
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
