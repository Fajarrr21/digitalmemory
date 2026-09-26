"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ColoringSvg, type Fills } from "@/components/coloring/coloring-svg";
import { parseSpotifyTrackId, spotifyEmbedUrl } from "@/lib/spotify";
import { validateFile, extFromMime, IMAGE_MIME } from "@/lib/media-config";
import { cn } from "@/lib/utils";
import type { AwayKind } from "@/lib/supabase/database.types";
import {
  COLORING_PALETTE,
  randomTemplate,
  type ColoringTemplate,
} from "../today/coloring-config";
import {
  TINY_QUESTIONS,
  PICK_ONES,
  SILLY_PICKS,
  SILLY_RATES,
  FROM_ME,
  MICRO_LETTERS,
  MEMORY_EMOJI_POOL,
  FIND_DECOYS,
  REACTIONS,
  SLOWDOWN,
  awayInfo,
  type PickOne,
  type SillyPick,
  type SillyRate,
  type ReactionPrompt,
} from "./meanwhile-config";
import { saveMoment, shareMoment } from "./actions";

// ---- The Moment engine -------------------------------------------------------

type Moment =
  | { kind: "question"; prompt: string }
  | { kind: "pick"; item: PickOne }
  | { kind: "photo" }
  | { kind: "song" }
  | { kind: "creation" }
  | { kind: "fromme"; beats: string[] }
  | { kind: "letter"; beats: string[] }
  | { kind: "memory" }
  | { kind: "find" }
  | { kind: "reaction"; item: ReactionPrompt }
  | { kind: "slowdown" }
  | { kind: "sillypick"; item: SillyPick }
  | { kind: "sillyrate"; item: SillyRate };

type Drawn = { key: string; moment: Moment };

// Weighted category table. "letter" is deliberately very rare, "fromme" rare.
const WEIGHTS: [Moment["kind"], number][] = [
  ["question", 14],
  ["pick", 14],
  ["photo", 10],
  ["song", 9],
  ["creation", 10],
  ["memory", 6],
  ["find", 5],
  ["reaction", 6],
  ["slowdown", 8],
  ["sillypick", 7],
  ["sillyrate", 5],
  ["fromme", 6],
  ["letter", 2],
];

function rand(n: number) {
  return Math.floor(Math.random() * n);
}

function drawKind(): Moment["kind"] {
  const total = WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [kind, w] of WEIGHTS) {
    r -= w;
    if (r < 0) return kind;
  }
  return "question";
}

/** Draw one Moment, avoiding the most recently seen prompts. */
function drawMoment(recent: string[]): Drawn {
  for (let attempt = 0; attempt < 12; attempt++) {
    const kind = drawKind();
    let drawn: Drawn;
    switch (kind) {
      case "question": {
        const i = rand(TINY_QUESTIONS.length);
        drawn = { key: `question:${i}`, moment: { kind, prompt: TINY_QUESTIONS[i] } };
        break;
      }
      case "pick": {
        const i = rand(PICK_ONES.length);
        drawn = { key: `pick:${i}`, moment: { kind, item: PICK_ONES[i] } };
        break;
      }
      case "reaction": {
        const i = rand(REACTIONS.length);
        drawn = { key: `reaction:${i}`, moment: { kind, item: REACTIONS[i] } };
        break;
      }
      case "sillypick": {
        const i = rand(SILLY_PICKS.length);
        drawn = { key: `sillypick:${i}`, moment: { kind, item: SILLY_PICKS[i] } };
        break;
      }
      case "sillyrate": {
        const i = rand(SILLY_RATES.length);
        drawn = { key: `sillyrate:${i}`, moment: { kind, item: SILLY_RATES[i] } };
        break;
      }
      case "fromme": {
        const i = rand(FROM_ME.length);
        drawn = { key: `fromme:${i}`, moment: { kind, beats: FROM_ME[i] } };
        break;
      }
      case "letter": {
        const i = rand(MICRO_LETTERS.length);
        drawn = { key: `letter:${i}`, moment: { kind, beats: MICRO_LETTERS[i] } };
        break;
      }
      default:
        drawn = { key: kind, moment: { kind } as Moment };
    }
    if (!recent.includes(drawn.key)) return drawn;
  }
  // Everything recent? Just hand over whatever came last.
  const i = rand(TINY_QUESTIONS.length);
  return { key: `question:${i}`, moment: { kind: "question", prompt: TINY_QUESTIONS[i] } };
}

const RECENT_KEY = "meanwhile:recent";
const LAST_VISIT_KEY = "meanwhile:last";

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string").slice(0, 10) : [];
  } catch {
    return [];
  }
}

function pushRecent(key: string) {
  try {
    const next = [key, ...loadRecent().filter((k) => k !== key)].slice(0, 10);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // per-viewer convenience only
  }
}

// ---- Save helper ---------------------------------------------------------------

async function keepMoment(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return saveMoment({}, fd);
}

// ---- The experience --------------------------------------------------------------

type Stage = "loading" | "gate" | "intro" | "moment" | "done";

export function Meanwhile({
  spaceId,
  userId,
  partnerName,
  partnerAway,
  todayISO,
  dateLabel,
}: {
  spaceId: string;
  userId: string;
  partnerName: string;
  partnerAway: { kind: AwayKind; active: boolean; justBack: boolean } | null;
  todayISO: string;
  dateLabel: string;
}) {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState<Stage>("loading");
  const [drawn, setDrawn] = useState<Drawn | null>(null);

  useEffect(() => {
    let visited = false;
    try {
      visited = localStorage.getItem(LAST_VISIT_KEY) === todayISO;
    } catch {
      // fine — treat as first visit
    }
    setStage(visited ? "gate" : "intro");
  }, [todayISO]);

  const nextMoment = useCallback(() => {
    const d = drawMoment(loadRecent());
    pushRecent(d.key);
    setDrawn(d);
    setStage("moment");
  }, []);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(LAST_VISIT_KEY, todayISO);
    } catch {
      // fine
    }
    setStage("done");
  }, [todayISO]);

  const awayLine = useMemo(() => {
    if (!partnerAway) return null;
    if (partnerAway.active) {
      const info = awayInfo(partnerAway.kind);
      return `${info.emoji} ${partnerName} ${info.doing} right now.`;
    }
    if (partnerAway.justBack) return `${partnerName} is back. ♡`;
    return null;
  }, [partnerAway, partnerName]);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-rule bg-gradient-to-b from-paper to-blush/20 px-5 py-10 sm:px-8">
      {/* small floating dust, very slow */}
      {!reduce ? (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {[
            { left: "12%", top: "18%", d: 11 },
            { left: "82%", top: "26%", d: 14 },
            { left: "68%", top: "78%", d: 12 },
            { left: "24%", top: "70%", d: 16 },
          ].map((p, i) => (
            <motion.span
              key={i}
              className="absolute h-1.5 w-1.5 rounded-full bg-accent/40"
              style={{ left: p.left, top: p.top }}
              animate={{ y: [0, -14, 0], opacity: [0.25, 0.6, 0.25] }}
              transition={{ duration: p.d, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        {stage === "loading" ? (
          <motion.div key="loading" className="min-h-[16rem]" />
        ) : stage === "gate" ? (
          <Screen key="gate" reduce={reduce}>
            <p className="font-hand text-2xl text-accent-ink">You&apos;ve already had your little moment.</p>
            <p className="mt-2 text-ink-soft">Go do something else for a while. ♡</p>
            <div className="mt-8 flex flex-col items-center gap-3">
              <Button type="button" variant="soft" onClick={() => setStage("intro")}>
                satu lagi deh →
              </Button>
              <Link href="/" className="text-sm text-ink-faint hover:text-accent-ink">
                ← balik ke home
              </Link>
            </div>
          </Screen>
        ) : stage === "intro" ? (
          <Screen key="intro" reduce={reduce}>
            <TitleReveal reduce={reduce} />
            {awayLine ? (
              <motion.p
                className="mt-4 font-mono text-sm text-ink-faint"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: reduce ? 0 : 1.4 }}
              >
                {awayLine}
              </motion.p>
            ) : null}
            <motion.div
              className="mt-6 space-y-1.5 text-ink-soft"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : 1.7, duration: 0.8 }}
            >
              <p>You&apos;re here.</p>
              <p>I&apos;m probably somewhere else — working, playing, getting distracted.</p>
              <p>And that&apos;s okay.</p>
              <p className="pt-2 font-hand text-xl text-accent-ink">
                Here&apos;s a little something for you. ♡
              </p>
            </motion.div>
            <motion.div
              className="mt-8"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: reduce ? 0 : 2.6, duration: 0.8 }}
            >
              <Button type="button" onClick={nextMoment}>
                What&apos;s waiting? →
              </Button>
            </motion.div>
          </Screen>
        ) : stage === "moment" && drawn ? (
          <Screen key={drawn.key} reduce={reduce}>
            <MomentView
              drawn={drawn}
              spaceId={spaceId}
              userId={userId}
              partnerName={partnerName}
              dateLabel={dateLabel}
              onDone={finish}
              onSkip={nextMoment}
            />
          </Screen>
        ) : stage === "done" ? (
          <Screen key="done" reduce={reduce}>
            <p className="font-hand text-2xl text-accent-ink">That&apos;s enough for now. ♡</p>
            <p className="mt-2 text-ink-soft">I&apos;ll leave another little thing for later.</p>
            <div className="mt-8 flex flex-col items-center gap-3">
              <Link href="/">
                <Button type="button">Done →</Button>
              </Link>
              <Link
                href="/meanwhile/archive"
                className="text-sm text-ink-faint hover:text-accent-ink"
              >
                lihat serpihan yang tersimpan →
              </Link>
            </div>
          </Screen>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Screen({
  children,
  reduce,
}: {
  children: React.ReactNode;
  reduce: boolean | null;
}) {
  return (
    <motion.div
      className="relative mx-auto flex min-h-[16rem] w-full max-w-md flex-col items-center justify-center text-center"
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, y: -8 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

/** "Meanwhile…" — the letters arrive one by one. */
function TitleReveal({ reduce }: { reduce: boolean | null }) {
  const text = "Meanwhile…";
  return (
    <h1 className="font-display text-4xl font-medium text-ink" aria-label={text}>
      {text.split("").map((ch, i) => (
        <motion.span
          key={i}
          aria-hidden
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduce ? 0 : 0.12 * i, duration: 0.5 }}
        >
          {ch}
        </motion.span>
      ))}
    </h1>
  );
}

function SkipLink({ onSkip }: { onSkip: () => void }) {
  return (
    <button
      type="button"
      onClick={onSkip}
      className="mt-7 text-sm text-ink-faint transition hover:text-accent-ink"
    >
      Not feeling it →
    </button>
  );
}

// ---- Per-kind Moment views ---------------------------------------------------

function MomentView({
  drawn,
  spaceId,
  userId,
  partnerName,
  dateLabel,
  onDone,
  onSkip,
}: {
  drawn: Drawn;
  spaceId: string;
  userId: string;
  partnerName: string;
  dateLabel: string;
  onDone: () => void;
  onSkip: () => void;
}) {
  const m = drawn.moment;
  switch (m.kind) {
    case "question":
      return <QuestionMoment prompt={m.prompt} onDone={onDone} onSkip={onSkip} />;
    case "pick":
      return <PickMoment item={m.item} onDone={onDone} onSkip={onSkip} />;
    case "photo":
      return (
        <PhotoMoment
          spaceId={spaceId}
          userId={userId}
          partnerName={partnerName}
          dateLabel={dateLabel}
          onDone={onDone}
          onSkip={onSkip}
        />
      );
    case "song":
      return <SongMoment dateLabel={dateLabel} onDone={onDone} onSkip={onSkip} />;
    case "creation":
      return <CreationMoment onDone={onDone} onSkip={onSkip} />;
    case "fromme":
      return <BeatsMoment eyebrow="meanwhile, from me…" beats={m.beats} onDone={onDone} />;
    case "letter":
      return <LetterMoment beats={m.beats} onDone={onDone} />;
    case "memory":
      return <MemoryMoment onDone={onDone} onSkip={onSkip} />;
    case "find":
      return <FindMoment onDone={onDone} onSkip={onSkip} />;
    case "reaction":
      return <ReactionMoment item={m.item} onDone={onDone} onSkip={onSkip} />;
    case "slowdown":
      return <SlowdownMoment onDone={onDone} onSkip={onSkip} />;
    case "sillypick":
      return <SillyPickMoment item={m.item} onDone={onDone} onSkip={onSkip} />;
    case "sillyrate":
      return <SillyRateMoment item={m.item} onDone={onDone} onSkip={onSkip} />;
    default:
      return null;
  }
}

// 💭 Tiny Question
function QuestionMoment({
  prompt,
  onDone,
  onSkip,
}: {
  prompt: string;
  onDone: () => void;
  onSkip: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!answer.trim()) return;
    setSaving(true);
    setError(null);
    const res = await keepMoment({ category: "question", prompt, answer: answer.trim() });
    setSaving(false);
    if (res.ok) setSaved(true);
    else setError(res.error ?? "Coba lagi ya.");
  }

  if (saved) {
    return (
      <>
        <p className="font-hand text-2xl text-accent-ink">I&apos;ll keep that little thought here. ♡</p>
        <Button type="button" className="mt-8" onClick={onDone}>
          ♡
        </Button>
      </>
    );
  }

  return (
    <>
      <p className="font-display text-2xl font-medium text-ink text-balance">{prompt}</p>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder="tulis sedikit aja…"
        className="mt-6 w-full resize-none rounded-2xl border border-rule bg-paper px-4 py-3 text-ink outline-none transition placeholder:text-ink-faint focus:border-accent-ink/50"
      />
      {error ? <p role="alert" className="mt-2 text-sm text-danger">{error}</p> : null}
      <div className="mt-5 flex items-center gap-3">
        <Button type="button" variant="ghost" onClick={onDone} disabled={saving}>
          Skip
        </Button>
        <Button type="button" onClick={submit} disabled={saving || !answer.trim()}>
          {saving ? "Menyimpan…" : "Answer ♡"}
        </Button>
      </div>
      <SkipLink onSkip={onSkip} />
    </>
  );
}

// Shared "keep it?" footer for choice-style moments.
function KeepFooter({
  fields,
  onDone,
}: {
  fields: Record<string, string>;
  onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function keep() {
    setSaving(true);
    setError(null);
    const res = await keepMoment(fields);
    setSaving(false);
    if (res.ok) onDone();
    else setError(res.error ?? "Coba lagi ya.");
  }

  return (
    <div className="mt-7 flex flex-col items-center gap-2">
      <p className="text-sm text-ink-faint">Keep this little moment?</p>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <div className="flex items-center gap-3">
        <Button type="button" size="sm" onClick={keep} disabled={saving}>
          {saving ? "…" : "Keep ♡"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone} disabled={saving}>
          Let it go
        </Button>
      </div>
    </div>
  );
}

// 🎲 Pick One
function PickMoment({
  item,
  onDone,
  onSkip,
}: {
  item: PickOne;
  onDone: () => void;
  onSkip: () => void;
}) {
  const [choice, setChoice] = useState<{ emoji: string; label: string } | null>(null);

  if (choice) {
    return (
      <>
        <p className="text-4xl">{choice.emoji}</p>
        <p className="mt-3 font-display text-xl font-medium text-ink">{choice.label}.</p>
        <p className="mt-2 text-ink-soft">{item.quip}</p>
        <KeepFooter
          fields={{
            category: "pick",
            prompt: item.prompt,
            choice: choice.label,
            emoji: choice.emoji,
          }}
          onDone={onDone}
        />
      </>
    );
  }

  return (
    <>
      <p className="font-display text-2xl font-medium text-ink text-balance">{item.prompt}</p>
      <div className="mt-7 grid w-full grid-cols-2 gap-3">
        {[item.a, item.b].map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => setChoice(opt)}
            className="flex flex-col items-center gap-2 rounded-2xl border border-rule bg-paper px-4 py-6 transition hover:-translate-y-0.5 hover:border-accent-ink/50"
          >
            <span className="text-3xl">{opt.emoji}</span>
            <span className="text-sm text-ink">{opt.label}</span>
          </button>
        ))}
      </div>
      <SkipLink onSkip={onSkip} />
    </>
  );
}

// 📸 Tiny Moment
function PhotoMoment({
  spaceId,
  userId,
  partnerName,
  dateLabel,
  onDone,
  onSkip,
}: {
  spaceId: string;
  userId: string;
  partnerName: string;
  dateLabel: string;
  onDone: () => void;
  onSkip: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [working, setWorking] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [sharedDone, setSharedDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(f: File | null) {
    if (!f) return;
    const v = validateFile(f);
    if (!v.ok || v.kind !== "image" || !IMAGE_MIME.includes(f.type)) {
      setError("Fotonya belum kebaca — coba format lain ya.");
      return;
    }
    setError(null);
    setFile(f);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(f);
    });
  }

  async function save() {
    if (!file) return;
    setWorking(true);
    setError(null);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1.2,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
      });
      const path = `${spaceId}/${userId}/meanwhile/${crypto.randomUUID()}.${extFromMime(file.type)}`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from("media")
        .upload(path, compressed, { contentType: file.type, upsert: false });
      if (upErr) throw new Error(upErr.message);

      const res = await keepMoment({
        category: "photo",
        prompt: "Find something that feels like today.",
        path,
        mime: file.type,
      });
      if (!res.ok || !res.id) throw new Error(res.error ?? "save failed");
      setSavedId(res.id);
    } catch {
      setError("Fotonya gagal disimpan. Coba lagi sebentar ya. ♡");
    } finally {
      setWorking(false);
    }
  }

  async function sendToPartner() {
    if (!savedId) return;
    setWorking(true);
    const res = await shareMoment(savedId);
    setWorking(false);
    if (res.ok) setSharedDone(true);
  }

  if (savedId) {
    return (
      <>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="max-h-56 w-auto rounded-2xl border border-rule object-cover" />
        ) : null}
        <p className="mt-4 font-hand text-2xl text-accent-ink">A little piece of {dateLabel}.</p>
        <p className="mt-1 text-sm text-ink-soft">Tersimpan. Nggak dikirim ke siapa-siapa.</p>
        <div className="mt-6 flex flex-col items-center gap-2">
          {sharedDone ? (
            <p className="text-sm text-accent-ink">Dikirim ke {partnerName} ♡</p>
          ) : (
            <Button type="button" variant="soft" size="sm" onClick={sendToPartner} disabled={working}>
              Send to {partnerName} →
            </Button>
          )}
          <Button type="button" onClick={onDone}>
            Done ♡
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="font-display text-2xl font-medium text-ink">Look around you.</p>
      <p className="mt-2 text-ink-soft">Find something that feels like today.</p>
      <input
        ref={input}
        type="file"
        accept={IMAGE_MIME.join(",")}
        capture="environment"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />
      {preview ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="mt-5 max-h-56 w-auto rounded-2xl border border-rule object-cover" />
          <div className="mt-5 flex items-center gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => input.current?.click()} disabled={working}>
              ganti
            </Button>
            <Button type="button" onClick={save} disabled={working}>
              {working ? "Menyimpan…" : "Keep ♡"}
            </Button>
          </div>
        </>
      ) : (
        <Button type="button" className="mt-7" onClick={() => input.current?.click()}>
          Take a little picture →
        </Button>
      )}
      {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
      <SkipLink onSkip={onSkip} />
    </>
  );
}

// 🎧 Soundtrack
function SongMoment({
  dateLabel,
  onDone,
  onSkip,
}: {
  dateLabel: string;
  onDone: () => void;
  onSkip: () => void;
}) {
  const [link, setLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedTrackId, setSavedTrackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const id = parseSpotifyTrackId(link);
    if (!id) {
      setError("Itu belum kelihatan seperti link lagu Spotify. Coba salin dari tombol Share ya.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await keepMoment({
      category: "song",
      prompt: "If this moment had a soundtrack…",
      link,
    });
    setSaving(false);
    if (res.ok) setSavedTrackId(id);
    else setError(res.error ?? "Coba lagi ya.");
  }

  if (savedTrackId) {
    return (
      <>
        <p className="font-mono text-xs text-ink-faint">{dateLabel}</p>
        <div className="mt-3 w-full">
          <iframe
            title="Today's soundtrack"
            src={spotifyEmbedUrl(savedTrackId)}
            width="100%"
            height={152}
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            style={{ border: 0, borderRadius: 12 }}
          />
        </div>
        <p className="mt-3 font-hand text-xl text-accent-ink">This was today&apos;s soundtrack.</p>
        <Button type="button" className="mt-6" onClick={onDone}>
          Done ♡
        </Button>
      </>
    );
  }

  return (
    <>
      <p className="font-display text-2xl font-medium text-ink text-balance">
        If this moment had a soundtrack…
      </p>
      <p className="mt-2 text-ink-soft">What would you play?</p>
      <input
        value={link}
        onChange={(e) => setLink(e.target.value)}
        inputMode="url"
        placeholder="tempel link lagu Spotify…"
        className="mt-6 w-full rounded-full border border-rule bg-paper px-5 py-3 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-accent-ink/50"
      />
      {error ? <p role="alert" className="mt-2 text-sm text-danger">{error}</p> : null}
      <Button type="button" className="mt-5" onClick={submit} disabled={saving || !link.trim()}>
        {saving ? "Menyimpan…" : "Keep this song ♡"}
      </Button>
      <SkipLink onSkip={onSkip} />
    </>
  );
}

// 🎨 Little Creation
function CreationMoment({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const [template] = useState<ColoringTemplate>(() => randomTemplate());
  const [fills, setFills] = useState<Fills>({});
  const [color, setColor] = useState(COLORING_PALETTE[0].value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await keepMoment({
      category: "creation",
      prompt: "Color this little thing.",
      template_id: template.id,
      fills: JSON.stringify(fills),
    });
    setSaving(false);
    if (res.ok) onDone();
    else setError(res.error ?? "Coba lagi ya.");
  }

  return (
    <>
      <p className="font-display text-2xl font-medium text-ink">Color this little thing.</p>
      <p className="mt-1 text-sm text-ink-soft">It doesn&apos;t have to be good.</p>
      <div className="mt-5 w-full max-w-[15rem] rounded-2xl border border-rule bg-ground p-3">
        <ColoringSvg
          template={template}
          fills={fills}
          interactive
          onPick={(id) => setFills((f) => ({ ...f, [id]: color }))}
          className="h-auto w-full"
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {COLORING_PALETTE.slice(0, 10).map((c) => (
          <button
            key={c.id}
            type="button"
            aria-label={c.name}
            aria-pressed={color === c.value}
            onClick={() => setColor(c.value)}
            className={cn(
              "h-7 w-7 rounded-full border transition",
              color === c.value
                ? "border-accent-ink ring-2 ring-accent-ink/40 ring-offset-2 ring-offset-paper"
                : "border-rule hover:scale-110",
            )}
            style={{ backgroundColor: c.value }}
          />
        ))}
      </div>
      {error ? <p role="alert" className="mt-2 text-sm text-danger">{error}</p> : null}
      <div className="mt-5 flex items-center gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => setFills({})}>
          Reset
        </Button>
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? "Menyimpan…" : "Keep ♡"}
        </Button>
      </div>
      <SkipLink onSkip={onSkip} />
    </>
  );
}

// 🫶 From Me / ✉️ A Letter I Left Here — staggered handwritten beats.
function BeatsMoment({
  eyebrow,
  beats,
  onDone,
}: {
  eyebrow: string;
  beats: string[];
  onDone: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <>
      <p className="font-mono text-xs tracking-widest text-ink-faint uppercase">{eyebrow}</p>
      <div className="mt-5 space-y-2.5">
        {beats.map((b, i) => (
          <motion.p
            key={i}
            className="font-hand text-2xl leading-snug text-ink"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0 : 0.55 * i, duration: 0.7 }}
          >
            {b}
          </motion.p>
        ))}
      </div>
      <motion.div
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reduce ? 0 : 0.55 * beats.length + 0.4 }}
      >
        <Button type="button" className="mt-8" onClick={onDone}>
          ♡
        </Button>
      </motion.div>
    </>
  );
}

function LetterMoment({ beats, onDone }: { beats: string[]; onDone: () => void }) {
  const [opened, setOpened] = useState(false);
  if (!opened) {
    return (
      <>
        <p className="text-5xl">✉️</p>
        <p className="mt-4 font-display text-xl font-medium text-ink">
          Someone left you something.
        </p>
        <Button type="button" className="mt-6" onClick={() => setOpened(true)}>
          Buka →
        </Button>
      </>
    );
  }
  return <BeatsMoment eyebrow="a letter i left here" beats={beats} onDone={onDone} />;
}

// 🧩 Memory
function MemoryMoment({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const game = useMemo(() => {
    const pool = [...MEMORY_EMOJI_POOL].sort(() => Math.random() - 0.5);
    const seq = pool.slice(0, 4);
    const anchorIdx = 1 + rand(2); // 1 or 2, so a neighbour always exists on both sides
    const askAfter = Math.random() < 0.5;
    const answer = seq[askAfter ? anchorIdx + 1 : anchorIdx - 1];
    return {
      seq,
      anchor: seq[anchorIdx],
      side: askAfter ? "right after" : "right before",
      answer,
      options: [...seq].sort(() => Math.random() - 0.5),
    };
  }, []);
  const [phase, setPhase] = useState<"show" | "ask" | "result">("show");
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    if (phase !== "show") return;
    const t = setTimeout(() => setPhase("ask"), 3500);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "show") {
    return (
      <>
        <p className="font-display text-xl font-medium text-ink">Remember this.</p>
        <p className="mt-6 text-4xl tracking-[0.5em]">{game.seq.join(" ")}</p>
        <p className="mt-6 font-mono text-xs text-ink-faint">jangan kedip…</p>
      </>
    );
  }

  if (phase === "result") {
    const right = picked === game.answer;
    return (
      <>
        <p className="text-4xl">{right ? "✨" : "😌"}</p>
        <p className="mt-3 font-hand text-2xl text-accent-ink">
          {right ? "You remembered. ♡" : `Close enough. It was ${game.answer}.`}
        </p>
        <Button type="button" className="mt-7" onClick={onDone}>
          Done ♡
        </Button>
      </>
    );
  }

  return (
    <>
      <p className="font-display text-xl font-medium text-ink text-balance">
        What was {game.side} the {game.anchor}?
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        {game.options.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => {
              setPicked(e);
              setPhase("result");
            }}
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rule bg-paper text-2xl transition hover:-translate-y-0.5 hover:border-accent-ink/50"
          >
            {e}
          </button>
        ))}
      </div>
      <SkipLink onSkip={onSkip} />
    </>
  );
}

// 🧩 Find the tiny heart
function FindMoment({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const grid = useMemo(() => {
    const cells = Array.from({ length: 24 }, () => FIND_DECOYS[rand(FIND_DECOYS.length)]);
    const heartAt = rand(cells.length);
    return { cells, heartAt };
  }, []);
  const [found, setFound] = useState(false);
  const [wiggle, setWiggle] = useState<number | null>(null);

  if (found) {
    return (
      <>
        <p className="text-4xl">❤️</p>
        <p className="mt-3 font-hand text-2xl text-accent-ink">You found it. ♡</p>
        <Button type="button" className="mt-7" onClick={onDone}>
          Done ♡
        </Button>
      </>
    );
  }

  return (
    <>
      <p className="font-display text-xl font-medium text-ink">Find the tiny heart.</p>
      <div className="mt-6 grid grid-cols-6 gap-1.5">
        {grid.cells.map((c, i) => (
          <button
            key={i}
            type="button"
            aria-label="?"
            onClick={() => (i === grid.heartAt ? setFound(true) : setWiggle(i))}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg border border-rule/60 bg-paper text-base transition hover:border-accent-ink/40",
              wiggle === i && "opacity-50",
            )}
          >
            {i === grid.heartAt ? "❤️" : c}
          </button>
        ))}
      </div>
      <p className="mt-3 font-mono text-xs text-ink-faint">iya, dia sembunyi di antara itu semua</p>
      <SkipLink onSkip={onSkip} />
    </>
  );
}

// 🧩 Reaction
function ReactionMoment({
  item,
  onDone,
  onSkip,
}: {
  item: ReactionPrompt;
  onDone: () => void;
  onSkip: () => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);

  if (picked) {
    return (
      <>
        <p className="text-4xl">{picked}</p>
        <p className="mt-3 text-ink-soft">{item.quip}</p>
        <KeepFooter
          fields={{ category: "silly", prompt: item.prompt, choice: picked, emoji: picked }}
          onDone={onDone}
        />
      </>
    );
  }

  return (
    <>
      <p className="font-mono text-xs tracking-widest text-ink-faint uppercase">how would you react?</p>
      <p className="mt-3 font-display text-xl font-medium text-ink text-balance">{item.prompt}</p>
      <div className="mt-6 flex items-center justify-center gap-3">
        {item.options.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setPicked(e)}
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rule bg-paper text-2xl transition hover:-translate-y-0.5 hover:border-accent-ink/50"
          >
            {e}
          </button>
        ))}
      </div>
      <SkipLink onSkip={onSkip} />
    </>
  );
}

// 🌱 Slow Down
function SlowdownMoment({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<"beats" | "count" | "after">("beats");
  const [n, setN] = useState(SLOWDOWN.seconds);

  useEffect(() => {
    if (phase !== "count") return;
    if (n <= 0) {
      setPhase("after");
      return;
    }
    const t = setTimeout(() => setN((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, n]);

  if (phase === "beats") {
    return (
      <>
        <div className="space-y-2.5">
          {SLOWDOWN.beats.map((b, i) => (
            <motion.p
              key={i}
              className="font-display text-xl text-ink"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: reduce ? 0 : 0.8 * i, duration: 0.8 }}
            >
              {b}
            </motion.p>
          ))}
        </div>
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduce ? 0 : 0.8 * SLOWDOWN.beats.length + 0.3 }}
        >
          <Button type="button" className="mt-8" onClick={() => setPhase("count")}>
            Oke →
          </Button>
        </motion.div>
        <SkipLink onSkip={onSkip} />
      </>
    );
  }

  if (phase === "count") {
    return (
      <>
        <motion.p
          key={n}
          className="font-display text-6xl font-medium text-accent-ink"
          initial={reduce ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          {n}
        </motion.p>
        <p className="mt-4 font-mono text-xs text-ink-faint">tarik napas pelan-pelan…</p>
      </>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {SLOWDOWN.after.map((b) => (
          <p key={b} className="font-hand text-2xl text-accent-ink">
            {b}
          </p>
        ))}
      </div>
      <Button type="button" className="mt-7" onClick={onDone}>
        Done ♡
      </Button>
    </>
  );
}

// 😈 Silly pick (4 options)
function SillyPickMoment({
  item,
  onDone,
  onSkip,
}: {
  item: SillyPick;
  onDone: () => void;
  onSkip: () => void;
}) {
  const [picked, setPicked] = useState<{ emoji: string; label: string } | null>(null);

  if (picked) {
    return (
      <>
        <p className="text-4xl">{picked.emoji}</p>
        {picked.label !== picked.emoji ? (
          <p className="mt-2 font-display text-lg font-medium text-ink">{picked.label}</p>
        ) : null}
        <p className="mt-2 text-ink-soft">{item.quip}</p>
        <KeepFooter
          fields={{
            category: "silly",
            prompt: item.prompt,
            choice: picked.label,
            emoji: picked.emoji,
          }}
          onDone={onDone}
        />
      </>
    );
  }

  return (
    <>
      <p className="font-display text-xl font-medium text-ink text-balance">{item.prompt}</p>
      <div className="mt-6 grid w-full grid-cols-2 gap-3">
        {item.options.map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => setPicked(opt)}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-rule bg-paper px-3 py-4 transition hover:-translate-y-0.5 hover:border-accent-ink/50"
          >
            <span className="text-3xl">{opt.emoji}</span>
            {opt.label !== opt.emoji ? <span className="text-xs text-ink-soft">{opt.label}</span> : null}
          </button>
        ))}
      </div>
      <SkipLink onSkip={onSkip} />
    </>
  );
}

// 😈 Silly rate (1–10)
function SillyRateMoment({
  item,
  onDone,
  onSkip,
}: {
  item: SillyRate;
  onDone: () => void;
  onSkip: () => void;
}) {
  const [rating, setRating] = useState<number | null>(null);

  if (rating != null) {
    return (
      <>
        <p className="font-display text-4xl font-medium text-accent-ink">{rating}/10</p>
        <p className="mt-2 text-ink-soft">Noted. Very scientific. Dicatat selamanya.</p>
        <KeepFooter
          fields={{
            category: "silly",
            prompt: `${item.prompt} ${item.thing}`,
            choice: item.thing,
            rating: String(rating),
          }}
          onDone={onDone}
        />
      </>
    );
  }

  return (
    <>
      <p className="font-mono text-xs tracking-widest text-ink-faint uppercase">important research</p>
      <p className="mt-3 font-display text-xl font-medium text-ink">{item.prompt}</p>
      <p className="mt-3 text-2xl">{item.thing}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setRating(v)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-rule bg-paper text-sm text-ink transition hover:-translate-y-0.5 hover:border-accent-ink/50"
          >
            {v}
          </button>
        ))}
      </div>
      <SkipLink onSkip={onSkip} />
    </>
  );
}
