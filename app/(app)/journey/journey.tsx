"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { formatDateLabel } from "@/lib/date";
import { spotifyEmbedUrl, parseSpotifyTrackId } from "@/lib/spotify";
import { whenYouTubeApiReady, type YTPlayer } from "@/lib/youtube";
import type { Footprint } from "@/lib/journey/logic";
import type { JourneyData, Knowing, PresenceNote } from "@/lib/journey/queries";
import type { JourneyStop } from "@/lib/supabase/database.types";
import {
  AHEAD,
  CHAPTERS,
  FAR_WAYS,
  FIRSTS,
  HARD_DAYS,
  HOW_FAR,
  JOURNEY_SONG,
  KIND_META,
  KNOWING_KINDS,
  NOW,
  OPENING,
  UI,
  type Chapter,
} from "./journey-config";
import {
  ChapterArt,
  NowRoad,
  Rain,
  RoadStrip,
  TwoDotsMeeting,
  ZoomOutRoad,
} from "./journey-art";
import { addKnowing, leavePresenceNote, removeKnowing, removePresenceNote } from "./actions";

// Layar: 0 = pembuka, 1..C = bab, lalu "how far", "now", "ahead".
const C = CHAPTERS.length;
const HOWFAR = C + 1;
const NOWSCENE = C + 2;
const AHEADSCENE = C + 3;
const TOTAL = C + 4;

// Palet terang di atas langit malam sendiri — warna eksplisit, bukan token tema.
const INK = "text-[#f4ead9]";
const SOFT = "text-[#cdbfae]";
const FAINT = "text-[#9a8b7c]";
const ACCENT = "text-[#eda9b2]";
const WARM = "text-[#f2c98a]";
const BTN =
  "rounded-full border border-[#f4ead9]/20 bg-[#f4ead9]/[0.06] px-6 py-2.5 font-display text-[#f4ead9] backdrop-blur transition hover:border-[#eda9b2]/50 hover:text-[#eda9b2]";
const SMALL_BTN =
  "rounded-full border border-[#f4ead9]/20 bg-[#f4ead9]/[0.06] px-4 py-2 text-sm text-[#cdbfae] backdrop-blur transition hover:border-[#eda9b2]/40 hover:text-[#f4ead9]";
const CARD = "rounded-2xl border border-[#f4ead9]/10 bg-[#f4ead9]/[0.04] backdrop-blur-sm";

const STARS = [
  { left: "8%", top: "12%", size: 2, delay: 0 },
  { left: "21%", top: "30%", size: 1.5, delay: 1.4 },
  { left: "36%", top: "8%", size: 2, delay: 0.7 },
  { left: "52%", top: "22%", size: 1.5, delay: 2.1 },
  { left: "67%", top: "10%", size: 2.5, delay: 1.1 },
  { left: "79%", top: "34%", size: 1.5, delay: 0.3 },
  { left: "90%", top: "16%", size: 2, delay: 1.8 },
  { left: "14%", top: "52%", size: 1.5, delay: 2.6 },
  { left: "84%", top: "58%", size: 1.5, delay: 0.9 },
];

type Person = { id: string; name: string };

/** Teks dari ISO timestamp → tanggal (deterministik di server & browser). */
const dateOf = (iso: string) => formatDateLabel(iso.slice(0, 10));

function stopPropagation(e: React.SyntheticEvent) {
  e.stopPropagation();
}

// ── util kecil ─────────────────────────────────────────────────────────────────

function TapHint({ label }: { label: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className={`mt-10 block font-mono text-[11px] tracking-[0.2em] ${FAINT}`}
      animate={reduce ? undefined : { opacity: [0.35, 1, 0.35] }}
      transition={{ duration: 2.4, repeat: Infinity }}
    >
      {label}
    </motion.span>
  );
}

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 12, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ delay: reduce ? 0 : delay, duration: 0.9, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function NextButton({ onNext, label = UI.next }: { onNext: () => void; label?: string }) {
  return (
    <Reveal delay={0.3} className="mt-12">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
        className={`text-[15px] ${BTN}`}
      >
        {label}
      </button>
    </Reveal>
  );
}

function CountUp({ value, delay = 0 }: { value: number; delay?: number }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const startAt = performance.now() + delay * 1000;
    const dur = Math.min(2200, 600 + value * 12);
    const tick = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - startAt) / dur));
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, delay, reduce]);
  return <>{reduce ? value : shown}</>;
}

// ── Presence Note — "aku pernah berhenti di sini" ────────────────────────────
function PresenceNotes({
  stop,
  notes,
  me,
  nameOf,
  writable,
  onAdded,
  onRemoved,
}: {
  stop: JourneyStop;
  notes: PresenceNote[];
  me: Person;
  nameOf: (id: string) => string;
  writable: boolean;
  onAdded: (n: PresenceNote) => void;
  onRemoved: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const here = notes.filter((n) => n.stop === stop);

  if (here.length === 0 && !writable) return null;

  function save() {
    setError(null);
    start(async () => {
      const res = await leavePresenceNote({ stop, body });
      if (res.ok) {
        onAdded(res.item);
        setBody("");
        setOpen(false);
      } else setError(res.error);
    });
  }

  return (
    <div className="mt-12 flex w-full max-w-md flex-col items-center gap-4" onClick={stopPropagation}>
      {here.map((n, i) => (
        <Reveal key={n.id} delay={0.2 + i * 0.25} className={`relative w-full px-5 py-4 text-left ${CARD}`}>
          <p className={`font-mono text-[10px] uppercase tracking-[0.24em] ${FAINT}`}>
            🌙 {UI.noteLeftHere(n.authorId === me.id ? "Kamu" : nameOf(n.authorId))}
          </p>
          <p className={`mt-2 whitespace-pre-line font-hand text-2xl leading-snug ${INK}`}>
            “{n.body}”
          </p>
          <p className={`mt-2 font-mono text-[10px] ${FAINT}`}>{dateOf(n.createdAt)}</p>
          {n.authorId === me.id ? (
            <button
              type="button"
              aria-label="hapus jejak ini"
              onClick={() => {
                onRemoved(n.id);
                void removePresenceNote(n.id);
              }}
              className={`absolute right-3 top-3 text-xs ${FAINT} transition hover:text-[#eda9b2]`}
            >
              ✕
            </button>
          ) : null}
        </Reveal>
      ))}

      {writable ? (
        open ? (
          <div className={`w-full p-4 ${CARD}`}>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={280}
              rows={3}
              autoFocus
              placeholder={UI.notePlaceholder}
              className="w-full resize-none bg-transparent font-hand text-xl text-[#f4ead9] placeholder:text-[#9a8b7c] focus:outline-none"
            />
            {error ? <p className="mt-1 text-xs text-[#eda9b2]">{error}</p> : null}
            <div className="mt-2 flex items-center justify-between">
              <span className={`font-mono text-[10px] ${FAINT}`}>{body.length}/280</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setOpen(false)} className={`px-3 text-sm ${FAINT}`}>
                  {UI.cancel}
                </button>
                <button
                  type="button"
                  disabled={pending || body.trim().length === 0}
                  onClick={save}
                  className={`${SMALL_BTN} disabled:opacity-40`}
                >
                  {pending ? "…" : UI.noteSave}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`font-mono text-[11px] tracking-[0.14em] ${FAINT} transition hover:text-[#eda9b2]`}
          >
            {UI.leaveNote}
          </button>
        )
      ) : null}
    </div>
  );
}

// ── jejak (satu batu di jalan) ─────────────────────────────────────────────────
function footprintTitle(f: Footprint) {
  const meta = KIND_META[f.kind];
  if (f.kind === "flame") return f.label ?? meta.title;
  return f.first ? meta.firstTitle : meta.title;
}

function Stone({
  f,
  onOpen,
  delay = 0,
  showDate = true,
}: {
  f: Footprint;
  onOpen: (f: Footprint) => void;
  delay?: number;
  showDate?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(f);
      }}
      aria-label={`${footprintTitle(f)} · ${formatDateLabel(f.date)}`}
      className="group flex flex-col items-center gap-1"
      initial={reduce ? false : { opacity: 0, y: 8, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: reduce ? 0 : delay, duration: 0.5, ease: "easeOut" }}
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-full border text-xl transition group-hover:scale-110 group-hover:border-[#eda9b2]/60 ${
          f.first ? "border-[#f2c98a]/40 bg-[#f2c98a]/10" : "border-[#f4ead9]/15 bg-[#f4ead9]/[0.05]"
        }`}
      >
        {KIND_META[f.kind].emoji}
      </span>
      {showDate ? (
        <span className={`font-mono text-[9px] ${FAINT}`}>{f.date.slice(5).replace("-", "/")}</span>
      ) : null}
    </motion.button>
  );
}

/** Jejak-jejak dalam satu baris jalan yang bisa dibungkus. */
function RoadOfStones({
  road,
  onOpen,
  showDates = true,
}: {
  road: Footprint[];
  onOpen: (f: Footprint) => void;
  showDates?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-center gap-y-4">
      {road.map((f, i) => (
        <div key={f.id} className="flex items-start">
          {i > 0 ? <span className="mt-[22px] h-px w-4 bg-[#f4ead9]/25 sm:w-6" /> : null}
          <Stone f={f} onOpen={onOpen} delay={Math.min(i, 30) * 0.06} showDate={showDates} />
        </div>
      ))}
    </div>
  );
}

// ── kartu pratinjau jejak (tanpa meninggalkan perjalanan) ─────────────────────
function FootprintSheet({
  f,
  nameOf,
  onClose,
}: {
  f: Footprint;
  nameOf: (id: string) => string;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const meta = KIND_META[f.kind];
  const p = f.preview ?? {};
  const title = footprintTitle(f);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 p-4 backdrop-blur-sm sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <motion.div
        className="max-h-[85dvh] w-full max-w-sm overflow-y-auto rounded-3xl border border-[#f4ead9]/15 bg-[#17151f] p-6 text-center shadow-2xl"
        initial={reduce ? false : { y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={reduce ? { opacity: 0 } : { y: 30, opacity: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        onClick={stopPropagation}
      >
        <p className="text-4xl">{meta.emoji}</p>
        <p className={`mt-3 font-display text-xl ${INK}`}>{title}</p>
        <p className={`mt-1 font-mono text-[11px] ${FAINT}`}>
          {formatDateLabel(f.date)}
          {f.byId ? ` · dari ${nameOf(f.byId)}` : ""}
        </p>
        {f.count && f.count > 1 ? (
          <p className={`mt-1 font-mono text-[11px] ${FAINT}`}>{f.count} surat sekaligus</p>
        ) : null}

        {f.label && f.kind !== "flame" ? (
          <p className={`mt-4 font-display text-lg ${WARM}`}>{f.label}</p>
        ) : null}

        {p.sealed ? (
          <p className={`mt-4 text-sm ${SOFT}`}>💌 Masih tersegel — buka dulu di Letters ya. ♡</p>
        ) : null}

        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.image}
            alt=""
            className="mx-auto mt-4 max-h-60 w-full rounded-xl object-cover"
          />
        ) : null}

        {p.text ? (
          <p className={`mt-4 whitespace-pre-line text-pretty text-[15px] leading-relaxed ${SOFT}`}>
            {p.text}
          </p>
        ) : null}

        {p.audio ? <audio controls src={p.audio} className="mx-auto mt-4 w-full" /> : null}

        {p.spotifyTrackId ? (
          <iframe
            title="Spotify"
            src={spotifyEmbedUrl(p.spotifyTrackId)}
            className="mt-4 h-20 w-full rounded-xl"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        ) : null}

        <p className={`mt-5 font-hand text-xl ${ACCENT}`}>{meta.caption}</p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button type="button" onClick={onClose} className={SMALL_BTN}>
            {UI.close}
          </button>
          {f.href && meta.open ? (
            <Link href={f.href} className={SMALL_BTN}>
              {meta.open}
            </Link>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── isi khusus tiap bab ────────────────────────────────────────────────────────

function FirstsGrid({ road, onOpen }: { road: Footprint[]; onOpen: (f: Footprint) => void }) {
  const [song, setSong] = useState<string | null>(null);
  const facts = FIRSTS.filter((f) => f.value.trim().length > 0);
  const start = road.find((f) => f.kind === "start");
  const firstLetter = road.find((f) => f.kind === "letter" && f.first);

  if (facts.length === 0 && !start && !firstLetter) return null;

  return (
    <div className="mt-10 grid w-full max-w-md grid-cols-2 gap-3" onClick={stopPropagation}>
      {facts.map((f, i) => {
        const track = f.spotify ? parseSpotifyTrackId(f.spotify) : null;
        return (
          <Reveal key={f.label} delay={0.15 * i} className={`p-4 text-left ${CARD} ${track ? "col-span-2" : ""}`}>
            <p className="text-xl">{f.emoji}</p>
            <p className={`mt-2 font-mono text-[10px] uppercase tracking-[0.2em] ${FAINT}`}>{f.label}</p>
            <p className={`mt-1 font-display text-[15px] leading-snug ${INK}`}>{f.value}</p>
            {f.note ? <p className={`mt-1 font-hand text-lg ${ACCENT}`}>{f.note}</p> : null}
            {track ? (
              song === track ? (
                <iframe
                  title="Spotify"
                  src={spotifyEmbedUrl(track)}
                  className="mt-3 h-20 w-full rounded-xl"
                  allow="autoplay; clipboard-write; encrypted-media"
                />
              ) : (
                <button type="button" onClick={() => setSong(track)} className={`mt-3 text-xs ${ACCENT}`}>
                  ▶ putar lagunya
                </button>
              )
            ) : null}
          </Reveal>
        );
      })}
      {[start, firstLetter].filter((f): f is Footprint => !!f).map((f, i) => (
        <Reveal key={f.id} delay={0.15 * (facts.length + i)}>
          <button
            type="button"
            onClick={() => onOpen(f)}
            className={`h-full w-full p-4 text-left transition hover:border-[#eda9b2]/40 ${CARD}`}
          >
            <p className="text-xl">{KIND_META[f.kind].emoji}</p>
            <p className={`mt-2 font-mono text-[10px] uppercase tracking-[0.2em] ${FAINT}`}>
              {f.kind === "start" ? "di tempat kecil ini" : "surat pertama di sini"}
            </p>
            <p className={`mt-1 font-display text-[15px] leading-snug ${INK}`}>{formatDateLabel(f.date)}</p>
          </button>
        </Reveal>
      ))}
    </div>
  );
}

function LittleThings({ road, onOpen }: { road: Footprint[]; onOpen: (f: Footprint) => void }) {
  // Dikelompokkan per bulan supaya jalan yang panjang tetap bisa dibaca.
  const months = useMemo(() => {
    const m = new Map<string, Footprint[]>();
    for (const f of road) {
      const key = f.date.slice(0, 7);
      m.set(key, [...(m.get(key) ?? []), f]);
    }
    return [...m.entries()];
  }, [road]);

  if (road.length === 0) {
    return <p className={`mt-10 max-w-sm font-hand text-xl ${ACCENT}`}>{UI.emptyRoad}</p>;
  }

  return (
    <div className="mt-10 flex w-full max-w-2xl flex-col gap-8" onClick={stopPropagation}>
      <p className={`font-mono text-[11px] tracking-[0.2em] ${FAINT}`}>
        {road.length} jejak · ketuk satu untuk melihatnya
      </p>
      {months.map(([month, list]) => (
        <div key={month} className="flex flex-col items-center gap-3">
          <p className={`font-mono text-[10px] uppercase tracking-[0.3em] ${FAINT}`}>
            {new Date(`${month}-15T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
          <RoadOfStones road={list} onOpen={onOpen} />
        </div>
      ))}
    </div>
  );
}

function HardDays() {
  if (HARD_DAYS.length === 0) return null;
  return (
    <div className="mt-10 flex w-full max-w-md flex-col gap-3">
      {HARD_DAYS.map((d, i) => (
        <Reveal key={i} delay={0.3 * i} className={`px-5 py-4 text-left ${CARD}`}>
          {d.date ? <p className={`font-mono text-[10px] ${FAINT}`}>🌧️ {formatDateLabel(d.date)}</p> : null}
          <p className={`mt-1 whitespace-pre-line text-[15px] leading-relaxed ${SOFT}`}>{d.line}</p>
        </Reveal>
      ))}
    </div>
  );
}

function FarWays({ ways }: { ways: JourneyData["ways"] }) {
  const items = FAR_WAYS.filter((w) => ways[w.key] > 0);
  if (items.length === 0) return null;
  return (
    <div className="mt-10 grid w-full max-w-md grid-cols-2 gap-3" onClick={stopPropagation}>
      {items.map((w, i) => (
        <Reveal key={w.key} delay={0.15 * i}>
          <Link href={w.href} className={`block h-full p-4 text-left transition hover:border-[#eda9b2]/40 ${CARD}`}>
            <p className="text-xl">{w.emoji}</p>
            <p className={`mt-2 font-display text-2xl ${INK}`}>
              <CountUp value={ways[w.key]} delay={0.15 * i} />
            </p>
            <p className={`text-xs ${SOFT}`}>{w.unit}</p>
            <p className={`mt-2 font-mono text-[10px] uppercase tracking-[0.2em] ${FAINT}`}>{w.label}</p>
          </Link>
        </Reveal>
      ))}
    </div>
  );
}

function KnowingList({ items, onRemoved }: { items: Knowing[]; onRemoved?: (id: string) => void }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((k) => (
        <li key={k.id} className={`relative flex items-start gap-3 px-4 py-3 text-left ${CARD}`}>
          <span className="text-lg leading-6">{k.emoji}</span>
          <span className="min-w-0 flex-1">
            <span className={`block font-mono text-[10px] uppercase tracking-[0.2em] ${FAINT}`}>{k.label}</span>
            <span className={`block text-[15px] leading-snug ${INK}`}>{k.body}</span>
          </span>
          {onRemoved ? (
            <button
              type="button"
              aria-label="hapus"
              onClick={() => {
                onRemoved(k.id);
                void removeKnowing(k.id);
              }}
              className={`text-xs ${FAINT} transition hover:text-[#eda9b2]`}
            >
              ✕
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function Knowings({
  me,
  partner,
  knowings,
  writable,
  onAdded,
  onRemoved,
}: {
  me: Person;
  partner: Person | null;
  knowings: Knowing[];
  writable: boolean;
  onAdded: (k: Knowing) => void;
  onRemoved: (id: string) => void;
}) {
  const [kind, setKind] = useState(0);
  const [body, setBody] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!partner) return null;

  const mine = knowings.filter((k) => k.authorId === me.id);
  const theirs = knowings.filter((k) => k.authorId === partner.id);
  const chosen = KNOWING_KINDS[kind];

  function save() {
    setError(null);
    start(async () => {
      const res = await addKnowing({ emoji: chosen.emoji, label: chosen.label, body });
      if (res.ok) {
        onAdded(res.item);
        setBody("");
        setOpen(false);
      } else setError(res.error);
    });
  }

  return (
    <div className="mt-10 grid w-full max-w-2xl gap-8 sm:grid-cols-2" onClick={stopPropagation}>
      <Reveal className="flex flex-col gap-3">
        <p className={`font-hand text-2xl ${ACCENT}`}>Things I know about {partner.name}</p>
        {mine.length > 0 ? <KnowingList items={mine} onRemoved={onRemoved} /> : null}
        {writable ? (
          open ? (
            <div className={`p-4 text-left ${CARD}`}>
              <div className="flex flex-wrap gap-1.5">
                {KNOWING_KINDS.map((k, i) => (
                  <button
                    key={k.label}
                    type="button"
                    onClick={() => setKind(i)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition ${
                      i === kind
                        ? "border-[#eda9b2]/60 bg-[#eda9b2]/15 text-[#f4ead9]"
                        : "border-[#f4ead9]/15 text-[#cdbfae]"
                    }`}
                  >
                    {k.emoji} {k.label}
                  </button>
                ))}
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={200}
                rows={2}
                autoFocus
                placeholder={chosen.placeholder}
                className="mt-3 w-full resize-none bg-transparent text-[15px] text-[#f4ead9] placeholder:text-[#9a8b7c] focus:outline-none"
              />
              {error ? <p className="text-xs text-[#eda9b2]">{error}</p> : null}
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className={`px-3 text-sm ${FAINT}`}>
                  {UI.cancel}
                </button>
                <button
                  type="button"
                  disabled={pending || body.trim().length === 0}
                  onClick={save}
                  className={`${SMALL_BTN} disabled:opacity-40`}
                >
                  {pending ? "…" : "Simpan"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={`self-start font-mono text-[11px] tracking-[0.14em] ${FAINT} transition hover:text-[#eda9b2]`}
            >
              + sesuatu yang aku tahu tentang {partner.name}
            </button>
          )
        ) : null}
      </Reveal>

      <Reveal delay={0.3} className="flex flex-col gap-3">
        <p className={`font-hand text-2xl ${WARM}`}>What {partner.name} knows about you</p>
        {theirs.length > 0 ? (
          <KnowingList items={theirs} />
        ) : (
          <p className={`text-left text-sm ${SOFT}`}>
            {partner.name} belum menulis apa-apa di sini — mungkin nanti. ♡
          </p>
        )}
      </Reveal>
    </div>
  );
}

// ── satu bab ──────────────────────────────────────────────────────────────────
function ChapterScene({
  ch,
  extra,
  notes,
  onNext,
}: {
  ch: Chapter;
  extra: React.ReactNode;
  notes: React.ReactNode;
  onNext: () => void;
}) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(1);
  const done = n >= ch.beats.length;

  return (
    <div
      onClick={() => !done && setN((v) => v + 1)}
      className={`flex min-h-[100dvh] w-full flex-col items-center px-6 pt-24 pb-40 text-center ${
        done ? "" : "cursor-pointer"
      }`}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center">
        <motion.div
          className="mb-8"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <p className={`font-mono text-[11px] uppercase tracking-[0.32em] ${FAINT}`}>
            {ch.emoji} Chapter {ch.no}
          </p>
          <h2 className={`mt-3 text-balance font-display text-2xl sm:text-3xl ${INK}`}>{ch.title}</h2>
          {ch.subtitle ? <p className={`mt-2 font-hand text-xl ${ACCENT}`}>{ch.subtitle}</p> : null}
        </motion.div>

        <div className={SOFT}>
          <ChapterArt kind={ch.kind} />
        </div>

        <div className="flex flex-col items-center gap-6">
          {ch.beats.slice(0, n).map((beat, i) => (
            <Reveal key={i}>
              <p
                className={`max-w-prose whitespace-pre-line text-balance font-display text-[1.25rem] leading-relaxed sm:text-2xl ${INK}`}
              >
                {beat}
              </p>
            </Reveal>
          ))}
        </div>

        {done ? (
          <>
            {extra}
            {ch.after ? (
              <div className="mt-10 flex flex-col items-center gap-4">
                {ch.after.map((line, i) => (
                  <Reveal key={i} delay={0.8 + i * 0.9}>
                    <p className={`whitespace-pre-line text-balance font-display text-xl leading-relaxed ${WARM}`}>
                      {line}
                    </p>
                  </Reveal>
                ))}
              </div>
            ) : null}
            {notes}
            <NextButton onNext={onNext} />
          </>
        ) : (
          <TapHint label={UI.tapHint} />
        )}
      </div>
    </div>
  );
}

// ── "Wait. Look how far we've come." ─────────────────────────────────────────
function HowFarScene({
  road,
  stats,
  onNext,
}: {
  road: Footprint[];
  stats: JourneyData["stats"];
  onNext: () => void;
}) {
  const [step, setStep] = useState(0); // 0 wait+zoom · 1 look · 2 numbers · 3 closing
  const emojis = road.map((f) => KIND_META[f.kind].emoji);

  return (
    <div
      onClick={() => step < 3 && setStep((s) => s + 1)}
      className={`flex min-h-[100dvh] w-full flex-col items-center justify-center px-6 pt-24 pb-24 text-center ${
        step < 3 ? "cursor-pointer" : ""
      }`}
    >
      <Reveal>
        <p className={`font-display text-2xl italic ${SOFT}`}>{HOW_FAR.wait}</p>
      </Reveal>

      <div className="mt-6 w-full max-w-2xl">
        <ZoomOutRoad emojis={emojis} onDone={() => setStep((s) => Math.max(s, 1))} />
      </div>

      {step >= 1 ? (
        <Reveal className="mt-6">
          <p className={`text-balance font-display text-3xl sm:text-4xl ${INK}`}>{HOW_FAR.look}</p>
        </Reveal>
      ) : null}

      {step >= 2 ? (
        <div className="mt-10 flex flex-col items-center gap-2">
          {stats.map((s, i) => (
            <Reveal key={s.key} delay={i * 0.45}>
              <p className={`font-display text-xl ${INK}`}>
                <span className={WARM}>
                  <CountUp value={s.value} delay={i * 0.45} />
                </span>{" "}
                <span className={SOFT}>{HOW_FAR.units[s.key]}</span>
              </p>
            </Reveal>
          ))}
          <Reveal delay={stats.length * 0.45 + 0.2}>
            <p className={`font-display text-xl italic ${SOFT}`}>{HOW_FAR.countless}</p>
          </Reveal>
        </div>
      ) : null}

      {step >= 3 ? (
        <>
          <Reveal className="mt-10">
            <p className={`whitespace-pre-line font-hand text-3xl ${ACCENT}`}>{HOW_FAR.closing}</p>
          </Reveal>
          <NextButton onNext={onNext} />
        </>
      ) : (
        <TapHint label={UI.tapHint} />
      )}
    </div>
  );
}

// ── NOW — "This is us." ───────────────────────────────────────────────────────
function NowScene({
  emojis,
  notes,
  onNext,
}: {
  emojis: string[];
  notes: React.ReactNode;
  onNext: () => void;
}) {
  const [n, setN] = useState(0);
  const done = n > NOW.lines.length;
  return (
    <div
      onClick={() => !done && setN((v) => v + 1)}
      className={`flex min-h-[100dvh] w-full flex-col items-center justify-center px-6 pt-24 pb-24 text-center ${
        done ? "" : "cursor-pointer"
      }`}
    >
      <Reveal className="w-full">
        <NowRoad emojis={emojis} marker={NOW.marker} />
      </Reveal>
      <Reveal delay={0.8} className="mt-16">
        <p className={`font-display text-4xl ${INK}`}>{NOW.title}</p>
      </Reveal>
      <div className="mt-8 flex flex-col items-center gap-5">
        {NOW.lines.slice(0, n).map((line, i) => (
          <Reveal key={i}>
            <p className={`whitespace-pre-line text-balance font-display text-xl leading-relaxed ${SOFT}`}>
              {line}
            </p>
          </Reveal>
        ))}
      </div>
      {done ? (
        <>
          <Reveal className="mt-8">
            <p className={`font-hand text-3xl ${ACCENT}`}>{NOW.final}</p>
          </Reveal>
          {notes}
          <NextButton onNext={onNext} />
        </>
      ) : (
        <TapHint label={UI.tapHint} />
      )}
    </div>
  );
}

// ── THE ROAD AHEAD — "let's keep going." ─────────────────────────────────────
function AheadScene({
  emojis,
  notes,
  songEnded,
  onReplay,
}: {
  emojis: string[];
  notes: React.ReactNode;
  songEnded: boolean;
  onReplay: () => void;
}) {
  const [n, setN] = useState(0);
  const done = n > AHEAD.lines.length;
  return (
    <div
      onClick={() => !done && setN((v) => v + 1)}
      className={`flex min-h-[100dvh] w-full flex-col items-center justify-center px-6 pt-24 pb-24 text-center ${
        done ? "" : "cursor-pointer"
      }`}
    >
      <Reveal className="w-full">
        <NowRoad emojis={emojis} marker={NOW.marker} ahead />
      </Reveal>
      <div className="mt-16 flex flex-col items-center gap-5">
        {AHEAD.lines.slice(0, n).map((line, i) => (
          <Reveal key={i}>
            <p className={`whitespace-pre-line text-balance font-display text-xl leading-relaxed ${INK}`}>
              {line}
            </p>
          </Reveal>
        ))}
      </div>
      {done ? (
        <>
          <Reveal className="mt-6">
            <p className={`font-hand text-4xl ${ACCENT}`}>{AHEAD.final}</p>
          </Reveal>
          {songEnded ? (
            <Reveal delay={0.8} className="mt-6">
              <p className={`whitespace-pre-line font-mono text-[11px] tracking-[0.18em] ${FAINT}`}>
                ♪ {AHEAD.songEnded}
              </p>
            </Reveal>
          ) : null}
          {notes}
          <Reveal delay={1.2} className="mt-12 flex flex-col items-center gap-5">
            <Link href="/" onClick={stopPropagation} className={`text-[15px] ${BTN}`}>
              {AHEAD.continueLabel}
            </Link>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReplay();
              }}
              className={SMALL_BTN}
            >
              {AHEAD.replayLabel}
            </button>
            <p className={`mt-6 max-w-md whitespace-pre-line text-pretty font-hand text-xl ${SOFT}`}>
              {AHEAD.epigraph}
            </p>
          </Reveal>
        </>
      ) : (
        <TapHint label={UI.tapHint} />
      )}
    </div>
  );
}

// ── pembuka ───────────────────────────────────────────────────────────────────
function OpeningScene({ onBegin }: { onBegin: () => void }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  const done = n >= OPENING.lines.length;
  return (
    <div
      onClick={() => !done && setN((v) => v + 1)}
      className={`flex min-h-[100dvh] w-full flex-col items-center justify-center px-8 text-center ${
        done ? "" : "cursor-pointer"
      }`}
    >
      <div className={SOFT}>
        <TwoDotsMeeting />
      </div>
      <motion.h1
        className={`mt-8 font-display text-[1.7rem] font-medium tracking-[0.12em] sm:text-3xl ${INK}`}
        initial={reduce ? false : { opacity: 0, y: 12, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ delay: reduce ? 0 : 4.2, duration: 1.4, ease: "easeOut" }}
      >
        {OPENING.title}
      </motion.h1>
      <motion.p
        className={`mt-3 max-w-md text-pretty font-hand text-xl ${ACCENT}`}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reduce ? 0 : 5, duration: 1.4 }}
      >
        {OPENING.tagline}
      </motion.p>

      <div className="mt-10 flex min-h-[7rem] max-w-md flex-col items-center gap-4">
        {OPENING.lines.slice(0, n).map((line, i) => (
          <Reveal key={i}>
            <p className={`whitespace-pre-line text-pretty text-[16px] leading-relaxed ${SOFT}`}>{line}</p>
          </Reveal>
        ))}
      </div>

      {done ? (
        <NextButton onNext={onBegin} label={OPENING.beginLabel} />
      ) : (
        <TapHint label={UI.tapHint} />
      )}
    </div>
  );
}

// ── langit per layar ─────────────────────────────────────────────────────────
type Sky = { night: number; dusk: number; storm: number; dawn: number };
function skyFor(scene: number): Sky {
  if (scene <= 0) return { night: 1, dusk: 0, storm: 0, dawn: 0 };
  if (scene === HOWFAR) return { night: 0.7, dusk: 0.45, storm: 0, dawn: 0.1 };
  if (scene === NOWSCENE) return { night: 0.2, dusk: 0.35, storm: 0, dawn: 0.7 };
  if (scene === AHEADSCENE) return { night: 0, dusk: 0.1, storm: 0, dawn: 1 };
  switch (CHAPTERS[scene - 1].kind) {
    case "hard":
      return { night: 0.2, dusk: 0, storm: 1, dawn: 0 };
    case "far":
      return { night: 1, dusk: 0.15, storm: 0, dawn: 0 };
    case "learned":
      return { night: 0.3, dusk: 0.8, storm: 0, dawn: 0.3 };
    default:
      return { night: 0.45, dusk: 1, storm: 0, dawn: 0 };
  }
}

/** Seberapa jauh jalan kecil di bawah layar sudah terbentang di bab ini. */
const STRIP_REVEAL: Record<string, number> = {
  beginning: 0.08,
  along: 0.3,
  hard: 0.6,
  far: 0.8,
  learned: 1,
};

// ── shell utama ─────────────────────────────────────────────────────────────────
export function Journey({
  data,
  me,
  partner,
}: {
  data: JourneyData;
  me: Person;
  partner: Person | null;
}) {
  const reduce = useReducedMotion();
  const [scene, setScene] = useState(0);
  const [notes, setNotes] = useState(data.notes);
  const [knowings, setKnowings] = useState(data.knowings);
  const [openFp, setOpenFp] = useState<Footprint | null>(null);
  const [muted, setMuted] = useState(false);
  const [songEnded, setSongEnded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const playerHost = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const pausedForPreview = useRef(false);

  const road = data.road;
  const emojis = useMemo(() => road.map((f) => KIND_META[f.kind].emoji), [road]);
  const firsts = useMemo(() => road.filter((f) => f.first), [road]);
  const began = scene >= 1;
  const hasSong = JOURNEY_SONG.youtubeId.length > 0;

  const nameOf = (id: string) =>
    id === me.id ? me.name : id === partner?.id ? partner.name : "Dia";

  // Setiap pindah layar, mulai dari atas.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [scene]);

  // Bersihkan player saat keluar.
  useEffect(() => () => player.current?.destroy(), []);

  // 🎵 Lagu masuk perlahan setelah "Mulai perjalanan" (gesture → autoplay boleh).
  // Tidak diulang: perjalanan selesai ketika lagu selesai, jalannya tidak.
  function startSong() {
    if (!hasSong || player.current || !playerHost.current) return;
    const host = playerHost.current;
    whenYouTubeApiReady(() => {
      if (!window.YT || player.current) return;
      const el = document.createElement("div");
      host.appendChild(el);
      let fade: ReturnType<typeof setInterval> | undefined;
      player.current = new window.YT.Player(el, {
        videoId: JOURNEY_SONG.youtubeId,
        playerVars: {
          autoplay: 1,
          start: JOURNEY_SONG.startSeconds,
          controls: 0,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            const p = player.current;
            if (!p) return;
            if (reduce) {
              p.setVolume?.(70);
            } else {
              let vol = 0;
              p.setVolume?.(0);
              fade = setInterval(() => {
                vol = Math.min(70, vol + 5);
                player.current?.setVolume?.(vol);
                if (vol >= 70 && fade) clearInterval(fade);
              }, 400);
            }
            p.playVideo();
          },
          onStateChange: (e) => {
            if (window.YT && e.data === window.YT.PlayerState.ENDED) setSongEnded(true);
          },
        },
      });
    });
  }

  function toggleSound() {
    const p = player.current;
    if (!p) return;
    if (muted) {
      p.unMute?.();
      if (!songEnded) p.playVideo();
    } else p.mute?.();
    setMuted((m) => !m);
  }

  // Lagu lain di pratinjau (Spotify / voice note) → musik perjalanan menepi dulu.
  function openFootprint(f: Footprint) {
    if ((f.preview?.spotifyTrackId || f.preview?.audio) && player.current && !songEnded) {
      player.current.pauseVideo();
      pausedForPreview.current = true;
    }
    setOpenFp(f);
  }
  function closeFootprint() {
    setOpenFp(null);
    if (pausedForPreview.current) {
      pausedForPreview.current = false;
      player.current?.playVideo();
    }
  }

  const goNext = () => setScene((s) => Math.min(s + 1, TOTAL - 1));
  const goPrev = () => setScene((s) => Math.max(s - 1, 0));
  const begin = () => {
    startSong();
    goNext();
  };

  const notesAt = (stop: JourneyStop) => (
    <PresenceNotes
      stop={stop}
      notes={notes}
      me={me}
      nameOf={nameOf}
      writable={data.writable}
      onAdded={(n) => setNotes((list) => [...list, n])}
      onRemoved={(id) => setNotes((list) => list.filter((n) => n.id !== id))}
    />
  );

  function extraFor(ch: Chapter) {
    switch (ch.kind) {
      case "beginning":
        return <FirstsGrid road={road} onOpen={openFootprint} />;
      case "along":
        return firsts.length > 0 ? (
          <div className="mt-10 w-full">
            <p className={`mb-5 font-mono text-[11px] tracking-[0.2em] ${FAINT}`}>
              yang pertama-tama · ketuk untuk membuka
            </p>
            <RoadOfStones road={firsts} onOpen={openFootprint} />
          </div>
        ) : null;
      case "little":
        return <LittleThings road={road} onOpen={openFootprint} />;
      case "hard":
        return <HardDays />;
      case "far":
        return <FarWays ways={data.ways} />;
      case "learned":
        return (
          <Knowings
            me={me}
            partner={partner}
            knowings={knowings}
            writable={data.writable}
            onAdded={(k) => setKnowings((list) => [...list, k])}
            onRemoved={(id) => setKnowings((list) => list.filter((k) => k.id !== id))}
          />
        );
    }
  }

  const chapter = scene >= 1 && scene <= C ? CHAPTERS[scene - 1] : null;
  const stripShare = chapter ? STRIP_REVEAL[chapter.kind] : undefined;
  const stripEmojis =
    stripShare !== undefined && emojis.length > 0
      ? emojis.slice(0, Math.max(1, Math.ceil(emojis.length * stripShare)))
      : [];
  const sky = skyFor(scene);

  return (
    <div
      ref={scrollRef}
      className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden bg-[#0b0c12] text-[#f4ead9]"
    >
      {/* 🎵 pemutar tersembunyi (audio saja) */}
      <div
        ref={playerHost}
        aria-hidden
        className="pointer-events-none fixed bottom-0 left-0 h-px w-px overflow-hidden opacity-0"
      />

      {/* langit: malam · senja · mendung · fajar */}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(120% 90% at 50% 10%, #1b2140 0%, #0b0c12 62%)" }}
        animate={{ opacity: sky.night }}
        transition={{ duration: 1.8, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(130% 100% at 50% 100%, #3d2a4a 0%, #1d1830 45%, #0d0c16 85%)" }}
        animate={{ opacity: sky.dusk }}
        transition={{ duration: 1.8, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{ background: "linear-gradient(180deg, #23262e 0%, #14161c 55%, #0b0c10 100%)" }}
        animate={{ opacity: sky.storm }}
        transition={{ duration: 1.8, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(130% 100% at 50% 108%, #f4bd7e 0%, #b57466 34%, #4a2f42 66%, #1a1420 88%)",
        }}
        animate={{ opacity: sky.dawn }}
        transition={{ duration: 2, ease: "easeInOut" }}
      />

      {/* bintang-bintang kecil */}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        animate={{ opacity: sky.storm > 0.5 ? 0 : 1 - sky.dawn * 0.7 }}
        transition={{ duration: 1.6 }}
      >
        {STARS.map((s, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full bg-[#f4ead9]"
            style={{ left: s.left, top: s.top, width: s.size, height: s.size }}
            animate={reduce ? { opacity: 0.5 } : { opacity: [0.15, 0.8, 0.15] }}
            transition={{ duration: 4, delay: s.delay, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </motion.div>

      {chapter?.kind === "hard" ? <Rain /> : null}

      {/* kembali satu langkah */}
      {began ? (
        <button
          type="button"
          onClick={goPrev}
          aria-label={UI.back}
          className="fixed left-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-[#f4ead9]/20 bg-[#f4ead9]/[0.06] text-[#cdbfae] backdrop-blur transition hover:border-[#eda9b2]/40 hover:text-[#f4ead9]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      ) : (
        <Link
          href="/"
          aria-label="kembali ke rumah"
          className="fixed left-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-[#f4ead9]/15 text-sm text-[#9a8b7c] transition hover:text-[#f4ead9]"
        >
          ✕
        </Link>
      )}

      {/* tombol suara */}
      {hasSong && began && !songEnded ? (
        <button
          type="button"
          onClick={toggleSound}
          aria-label={muted ? UI.muteOff : UI.muteOn}
          className="fixed right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-[#f4ead9]/20 bg-[#f4ead9]/[0.06] text-lg backdrop-blur transition hover:border-[#eda9b2]/40"
        >
          {muted ? "🔇" : "🎵"}
        </button>
      ) : null}

      {/* layar aktif */}
      <AnimatePresence mode="wait">
        <motion.div
          key={scene}
          className="relative z-10 min-h-[100dvh]"
          initial={reduce ? false : { opacity: 0, filter: "blur(6px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(6px)" }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        >
          {scene === 0 ? (
            <OpeningScene onBegin={begin} />
          ) : chapter ? (
            <ChapterScene
              ch={chapter}
              extra={extraFor(chapter)}
              notes={notesAt(chapter.stop)}
              onNext={goNext}
            />
          ) : scene === HOWFAR ? (
            <HowFarScene road={road} stats={data.stats} onNext={goNext} />
          ) : scene === NOWSCENE ? (
            <NowScene emojis={emojis} notes={notesAt("now")} onNext={goNext} />
          ) : (
            <AheadScene
              emojis={emojis}
              notes={notesAt("ahead")}
              songEnded={songEnded}
              onReplay={() => setScene(0)}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* jalan kecil yang memanjang dari bab ke bab */}
      {stripEmojis.length > 0 ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#0b0c12]/90 via-[#0b0c12]/60 to-transparent pt-10 pb-12">
          <RoadStrip emojis={stripEmojis} gray={chapter?.kind === "hard"} />
        </div>
      ) : null}

      {/* titik-titik progres */}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex items-center justify-center gap-1.5">
        {Array.from({ length: TOTAL }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i === scene ? "w-5 bg-[#eda9b2]/80" : "w-1.5 bg-[#f4ead9]/25"
            }`}
          />
        ))}
      </div>

      <AnimatePresence>
        {openFp ? <FootprintSheet key={openFp.id} f={openFp} nameOf={nameOf} onClose={closeFootprint} /> : null}
      </AnimatePresence>
    </div>
  );
}
