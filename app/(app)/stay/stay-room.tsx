"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { StayGift, StayPrefs } from "@/lib/stay/queries";
import { chipsFor, initialRoom, roomReducer, type RoomAction } from "@/lib/stay/room";
import { arrangeTable, latestComfort, presenceLight } from "@/lib/stay/logic";
import { RoomScene } from "@/components/stay/room-scene";
import { GiftArt } from "@/components/stay/gift-art";
import { VoicePlayer } from "@/components/stay/voice-player";
import { cn } from "@/lib/utils";
import { openGift, putAwayGift, saveStayPrefs, setStayWhatsApp } from "./actions";
import { useStayChannel } from "./use-stay-channel";
import {
  CHIP_LABEL,
  COME_IN,
  GIFT_KIND,
  LIGHT_LINE,
  OPENING_FIRST,
  OPENING_RETURN,
  REST_CHOICES,
  REST_LINES,
  REST_TITLE,
  STAY_TITLE,
  lineFor,
  objectName,
} from "./stay-config";

type Phase = "intro" | "room" | "rest";

export function StayRoom({
  spaceId,
  selfId,
  partnerName,
  hasPartner,
  prefs,
  gifts,
  whatsappOn,
}: {
  spaceId: string;
  selfId: string;
  partnerName: string;
  hasPartner: boolean;
  prefs: StayPrefs;
  gifts: StayGift[];
  whatsappOn: boolean;
}) {
  const router = useRouter();
  const systemReduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("intro");
  const [room, dispatch] = useReducer(roomReducer, prefs, initialRoom);
  const [showCharacter, setShowCharacter] = useState(prefs.show_character);
  const [calmMotion, setCalmMotion] = useState(prefs.calm_motion);
  const calm = !!systemReduce || calmMotion;

  // Opened locally before the server confirms, so a gift never "re-seals".
  const [openedNow, setOpenedNow] = useState<Set<string>>(() => new Set());
  const [awayNow, setAwayNow] = useState<Map<string, boolean>>(() => new Map());
  const view = useMemo(
    () =>
      gifts.map((g) => ({
        ...g,
        opened_at: g.opened_at ?? (openedNow.has(g.id) ? "now" : null),
        put_away_at: awayNow.has(g.id) ? (awayNow.get(g.id) ? (g.put_away_at ?? "now") : null) : g.put_away_at,
      })),
    [gifts, openedNow, awayNow],
  );
  const { table, box } = useMemo(() => arrangeTable(view), [view]);
  const unopened = view.filter((g) => !g.opened_at).length;
  const comfort = useMemo(() => latestComfort(view), [view]);

  // ---- Arrivals: a soft glow + a few motes, never a popup ------------------
  const [sparkleKey, setSparkleKey] = useState(0);
  const seen = useRef<Set<string>>(new Set(gifts.map((g) => g.id)));
  useEffect(() => {
    const fresh = gifts.filter((g) => !seen.current.has(g.id));
    fresh.forEach((g) => seen.current.add(g.id));
    if (fresh.length) setSparkleKey((k) => k + 1);
  }, [gifts]);

  // ---- The "I'm here" light -------------------------------------------------
  const [hearts, setHearts] = useState<{ id: string; mine: boolean }[]>([]);
  const [heartNote, setHeartNote] = useState<string | null>(null);
  const addHeart = useCallback((mine: boolean) => {
    const id = crypto.randomUUID();
    setHearts((h) => [...h.slice(-5), { id, mine }]);
    window.setTimeout(() => setHearts((h) => h.filter((x) => x.id !== id)), 3200);
  }, []);
  const { partnerHere, send } = useStayChannel({
    spaceId,
    selfId,
    track: phase !== "intro",
    onEvent: (e) => {
      if (e.type === "heart") {
        addHeart(false);
        setHeartNote(`${partnerName} sent you a little heart.`);
      }
      if (e.type === "gift") router.refresh();
    },
  });
  const light = presenceLight({ partnerHere, unopened });

  // A gentle safety net when Realtime is unavailable: look again now and then.
  useEffect(() => {
    if (phase === "intro") return;
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 60000);
    return () => window.clearInterval(t);
  }, [phase, router]);

  // ---- Remember the lamp + window between visits -----------------------------
  const savedRef = useRef({ lamp: prefs.lamp, scene: prefs.scene });
  useEffect(() => {
    if (room.lamp === savedRef.current.lamp && room.scene === savedRef.current.scene) return;
    const t = window.setTimeout(() => {
      savedRef.current = { lamp: room.lamp, scene: room.scene };
      void saveStayPrefs({ lamp: room.lamp, scene: room.scene }).catch(() => {});
    }, 900);
    return () => window.clearTimeout(t);
  }, [room.lamp, room.scene]);

  // ---- The bedside table sheet ------------------------------------------------
  const [sheet, setSheet] = useState<{ tab: "table" | "box"; giftId: string | null } | null>(null);

  function act(a: RoomAction) {
    setHeartNote(null);
    dispatch(a);
  }

  function onLight() {
    if (light === "together") {
      addHeart(true);
      send({ type: "heart", by: selfId, id: crypto.randomUUID() });
      setHeartNote(`a little heart, on its way to ${partnerName}.`);
      return;
    }
    if (light === "warm") {
      setSheet({ tab: "table", giftId: null });
      return;
    }
    setHeartNote(LIGHT_LINE.quiet());
  }

  const line = room.line ? lineFor(room.line, room.beat) : null;
  const chips = chipsFor(room);

  if (phase === "intro") {
    return (
      <Intro
        returning={!!prefs.intro_seen_at}
        calm={calm}
        onEnter={() => {
          setPhase("room");
          if (!prefs.intro_seen_at) void saveStayPrefs({ intro_seen: true }).catch(() => {});
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-ink-faint hover:text-ink-soft">
          ← pulang
        </Link>
        <p className="font-display text-sm italic text-ink-soft">{STAY_TITLE}</p>
      </div>

      <motion.div
        initial={calm ? false : { opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto w-full max-w-[34rem] overflow-hidden rounded-[2rem] shadow-[var(--shadow-lift)]"
      >
        <RoomScene
          room={room}
          light={light}
          showCharacter={showCharacter}
          calm={calm}
          dimmed={phase === "rest"}
          table={table.map((g) => ({ id: g.id, kind: g.kind, object_kind: g.object_kind, opened: !!g.opened_at }))}
          tableGlow={unopened > 0}
          sparkleKey={sparkleKey}
          hearts={hearts}
          partnerName={partnerName}
          onAct={phase === "rest" ? () => {} : act}
          onTable={() => phase !== "rest" && setSheet({ tab: "table", giftId: null })}
          onLight={phase === "rest" ? () => {} : onLight}
        />
        {phase === "rest" ? (
          <RestScene
            comfort={comfort ? { id: comfort.id, body: comfort.body!, opened: !!comfort.opened_at } : null}
            partnerName={partnerName}
            calm={calm}
            onSettle={() => dispatch({ type: "settle" })}
            onComfortSeen={(id) => {
              setOpenedNow((s) => new Set(s).add(id));
              void openGift(id).catch(() => {});
            }}
            onChoose={(c) => {
              if (c === "stay") {
                dispatch({ type: "hush" });
                setPhase("room");
              } else if (c === "note") router.push("/stay/leave?kind=note");
              else router.push("/");
            }}
          />
        ) : null}
      </motion.div>

      {phase === "room" ? (
        <>
          {/* What the room says — a visual-novel line, never a popup. */}
          <div className="mx-auto flex min-h-[5.5rem] w-full max-w-[34rem] flex-col items-center justify-start gap-2 px-2 text-center">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={`${room.beat}-${heartNote ?? ""}`}
                aria-live="polite"
                initial={calm ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="font-hand text-[1.6rem] leading-snug text-accent-ink text-balance"
              >
                {heartNote ??
                  line ??
                  (light === "together"
                    ? LIGHT_LINE.together(partnerName)
                    : light === "warm"
                      ? LIGHT_LINE.warm()
                      : "everything here is yours. touch anything.")}
              </motion.p>
            </AnimatePresence>
            {chips.length ? (
              <div className="flex flex-wrap justify-center gap-2">
                {chips.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => act(c.action)}
                    className="rounded-full border border-rule bg-paper px-3.5 py-1.5 text-sm text-ink-soft transition hover:border-accent-ink/40 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
                  >
                    {CHIP_LABEL[c.key]}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mx-auto flex w-full max-w-[34rem] flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                setSheet(null);
                setPhase("rest");
              }}
              className="flex items-center justify-between gap-3 rounded-2xl border border-rule bg-paper px-5 py-4 text-left transition hover:-translate-y-0.5 hover:border-accent-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
            >
              <span>
                <span className="block font-display text-lg text-ink">{REST_TITLE}</span>
                <span className="block text-sm text-ink-soft">Sebentar saja. Bisa dilewati kapan pun.</span>
              </span>
              <span aria-hidden className="text-ink-faint">→</span>
            </button>

            {hasPartner ? (
              <Link
                href="/stay/leave"
                className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-rule px-5 py-3.5 text-sm text-ink-soft transition hover:border-accent-ink/40 hover:text-ink"
              >
                <span>Tinggalkan sesuatu di kamar {partnerName}</span>
                <span aria-hidden>→</span>
              </Link>
            ) : null}

            {box.length ? (
              <button
                type="button"
                onClick={() => setSheet({ tab: "box", giftId: null })}
                className="self-center text-sm text-ink-faint hover:text-ink-soft"
              >
                kotak kecil · {box.length} tersimpan
              </button>
            ) : null}

            <RoomSettings
              showCharacter={showCharacter}
              calmMotion={calmMotion}
              systemReduce={!!systemReduce}
              whatsappOn={whatsappOn}
              partnerName={partnerName}
              onCharacter={(v) => {
                setShowCharacter(v);
                void saveStayPrefs({ show_character: v }).catch(() => {});
              }}
              onCalm={(v) => {
                setCalmMotion(v);
                void saveStayPrefs({ calm_motion: v }).catch(() => {});
              }}
            />
          </div>
        </>
      ) : null}

      {sheet ? (
        <GiftSheet
          tab={sheet.tab}
          giftId={sheet.giftId}
          table={table}
          box={box}
          partnerName={partnerName}
          calm={calm}
          onTab={(tab) => setSheet({ tab, giftId: null })}
          onPick={(id) => {
            setSheet((s) => (s ? { ...s, giftId: id } : s));
            const g = view.find((x) => x.id === id);
            if (g && !g.opened_at) {
              setOpenedNow((s) => new Set(s).add(id));
              void openGift(id).catch(() => {});
            }
          }}
          onBack={() => setSheet((s) => (s ? { ...s, giftId: null } : s))}
          onClose={() => setSheet(null)}
          onPutAway={(id, away) => {
            setAwayNow((m) => new Map(m).set(id, away));
            void putAwayGift(id, away)
              .then((r) => {
                if (r.error) setAwayNow((m) => {
                  const n = new Map(m);
                  n.delete(id);
                  return n;
                });
                else router.refresh();
              })
              .catch(() => {});
          }}
          onRetryAudio={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}

// ---- The opening ------------------------------------------------------------

function Intro({ returning, calm, onEnter }: { returning: boolean; calm: boolean; onEnter: () => void }) {
  const lines = returning ? OPENING_RETURN : OPENING_FIRST;
  const step = calm ? 0 : 1.3;
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const t = window.setTimeout(() => buttonRef.current?.focus(), (lines.length * step + 0.6) * 1000);
    return () => window.clearTimeout(t);
  }, [lines.length, step]);

  return (
    <div className="relative -mx-4 flex min-h-[78vh] flex-col items-center justify-center overflow-hidden rounded-[2rem] bg-[radial-gradient(110%_80%_at_50%_30%,#4a3346_0%,#2b1f2c_55%,#1b141c_100%)] px-6 text-center text-[#fbefe4] md:mx-0">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute top-[18%] left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-[#f4c27c] blur-3xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: calm ? 0.18 : [0.08, 0.22, 0.08] }}
        transition={calm ? { duration: 0.6 } : { duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative flex flex-col items-center gap-4">
        {lines.map((l, i) => (
          <motion.p
            key={l}
            initial={{ opacity: 0, y: calm ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * step + 0.3, duration: calm ? 0.3 : 1.1 }}
            className={cn(i === 0 ? "font-display text-3xl italic md:text-4xl" : "font-display text-xl text-[#fbefe4]/85 md:text-2xl")}
          >
            {l}
          </motion.p>
        ))}
        <motion.button
          ref={buttonRef}
          type="button"
          onClick={onEnter}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: lines.length * step + 0.4, duration: 0.8 }}
          className="mt-8 rounded-full border border-[#fbefe4]/40 px-7 py-3 font-hand text-2xl text-[#fbefe4] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f4c27c]"
        >
          {COME_IN}
        </motion.button>
      </div>
    </div>
  );
}

// ---- "you can rest here." ---------------------------------------------------

function RestScene({
  comfort,
  partnerName,
  calm,
  onSettle,
  onComfortSeen,
  onChoose,
}: {
  comfort: { id: string; body: string; opened: boolean } | null;
  partnerName: string;
  calm: boolean;
  onSettle: () => void;
  onComfortSeen: (id: string) => void;
  onChoose: (c: keyof typeof REST_CHOICES) => void;
}) {
  // beats: 0 dim · 1 settle · 2..n lines · last = choices
  const lines = useMemo(() => [...REST_LINES, ...(comfort ? [comfort.body] : [])], [comfort]);
  const total = 2 + lines.length;
  const [beat, setBeat] = useState(0);
  const settled = useRef(false);
  const choicesRef = useRef<HTMLDivElement>(null);

  const advance = useCallback(() => setBeat((b) => Math.min(b + 1, total)), [total]);
  // Kept in refs so a parent re-render (a heart, a presence blip) never restarts a beat's timer.
  const onSettleRef = useRef(onSettle);
  const onComfortSeenRef = useRef(onComfortSeen);
  useEffect(() => {
    onSettleRef.current = onSettle;
    onComfortSeenRef.current = onComfortSeen;
  });

  useEffect(() => {
    if (beat >= 1 && !settled.current) {
      settled.current = true;
      onSettleRef.current();
    }
    if (comfort && beat === total - 1 && !comfort.opened) onComfortSeenRef.current(comfort.id);
    if (beat >= total) {
      choicesRef.current?.querySelector("button")?.focus();
      return;
    }
    const wait = beat < 2 ? 1700 : 4800;
    const t = window.setTimeout(advance, calm ? Math.min(wait, 2600) : wait);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beat, total, calm, advance, comfort?.id]);

  const lineIndex = beat - 2;
  const isComfortLine = !!comfort && lineIndex === lines.length - 1;

  return (
    <div className="absolute inset-0 flex flex-col justify-end" role="region" aria-label={REST_TITLE}>
      <button
        type="button"
        onClick={() => {
          if (!settled.current) {
            settled.current = true;
            onSettle();
          }
          setBeat(total);
        }}
        className={cn(
          "absolute top-3 right-3 rounded-full bg-black/25 px-3 py-1 text-xs text-[#fbefe4] backdrop-blur-sm hover:bg-black/35",
          beat >= total && "hidden",
        )}
      >
        lewati
      </button>
      <div
        className="bg-gradient-to-t from-[#1d141c]/85 via-[#1d141c]/55 to-transparent px-5 pt-16 pb-5 text-center text-[#fbefe4]"
        onClick={() => beat >= 2 && beat < total && advance()}
      >
        <AnimatePresence mode="wait">
          {beat < 2 ? (
            <motion.p key="title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="font-display text-2xl italic">
              {REST_TITLE}
            </motion.p>
          ) : beat < total ? (
            <motion.div key={beat} initial={{ opacity: 0, y: calm ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.9 }}>
              <p aria-live="polite" className={cn("text-balance", isComfortLine ? "font-hand text-[1.75rem] leading-snug" : "font-display text-xl md:text-2xl")}>
                {lines[lineIndex]}
              </p>
              {isComfortLine ? <p className="mt-1 font-mono text-[11px] text-[#fbefe4]/70">— {partnerName}</p> : null}
              <p className="mt-3 text-[11px] text-[#fbefe4]/50">ketuk untuk lanjut</p>
            </motion.div>
          ) : (
            <motion.div key="choices" ref={choicesRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2">
              <button type="button" onClick={() => onChoose("stay")} className="w-full max-w-xs rounded-full bg-[#fbefe4] px-5 py-2.5 text-[15px] font-medium text-[#3a2638] hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4c27c]">
                {REST_CHOICES.stay}
              </button>
              <button type="button" onClick={() => onChoose("note")} className="w-full max-w-xs rounded-full border border-[#fbefe4]/40 px-5 py-2.5 text-[15px] hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4c27c]">
                {REST_CHOICES.note}
              </button>
              <button type="button" onClick={() => onChoose("go")} className="px-5 py-2 text-sm text-[#fbefe4]/75 hover:text-[#fbefe4]">
                {REST_CHOICES.go}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---- The bedside table, up close ---------------------------------------------

type ViewGift = StayGift;

function GiftSheet({
  tab,
  giftId,
  table,
  box,
  partnerName,
  calm,
  onTab,
  onPick,
  onBack,
  onClose,
  onPutAway,
  onRetryAudio,
}: {
  tab: "table" | "box";
  giftId: string | null;
  table: ViewGift[];
  box: ViewGift[];
  partnerName: string;
  calm: boolean;
  onTab: (t: "table" | "box") => void;
  onPick: (id: string) => void;
  onBack: () => void;
  onClose: () => void;
  onPutAway: (id: string, away: boolean) => void;
  onRetryAudio: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const list = tab === "table" ? table : box;
  const gift = giftId ? [...table, ...box].find((g) => g.id === giftId) ?? null : null;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1d141c]/50 backdrop-blur-[2px] md:items-center" onClick={onClose}>
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={gift ? GIFT_KIND[gift.kind].name : "Meja samping kasur"}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        initial={calm ? false : { y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-ground px-5 pt-5 pb-8 outline-none md:rounded-[2rem]"
      >
        <div className="mb-4 flex items-center justify-between">
          {gift ? (
            <button type="button" onClick={onBack} className="text-sm text-ink-faint hover:text-ink-soft">
              ← meja
            </button>
          ) : (
            <div role="tablist" aria-label="Tempat hadiah" className="flex gap-1 rounded-full bg-paper-2 p-1">
              {(["table", "box"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  type="button"
                  aria-selected={tab === t}
                  onClick={() => onTab(t)}
                  className={cn("rounded-full px-3 py-1 text-sm transition", tab === t ? "bg-paper text-ink shadow-sm" : "text-ink-faint")}
                >
                  {t === "table" ? "di meja" : `kotak kecil${box.length ? ` · ${box.length}` : ""}`}
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-full px-2 py-1 text-ink-faint hover:text-ink-soft">
            ✕
          </button>
        </div>

        {gift ? (
          <GiftDetail gift={gift} partnerName={partnerName} calm={calm} onPutAway={onPutAway} onRetryAudio={onRetryAudio} />
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <p className="font-hand text-2xl text-accent-ink">
              {tab === "table" ? "nothing here yet. that's okay." : "the little box is empty."}
            </p>
            <p className="max-w-xs text-sm text-ink-soft">
              {tab === "table"
                ? `Kamarnya tetap milikmu. Kalau ${partnerName} meninggalkan sesuatu, akan muncul di sini.`
                : "Hadiah yang kamu simpan akan tinggal di sini, aman."}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {list.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => onPick(g.id)}
                  className="relative flex w-full flex-col items-center gap-2 rounded-2xl border border-rule bg-paper px-3 pt-4 pb-3 text-center transition hover:-translate-y-0.5 hover:border-accent-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
                >
                  {!g.opened_at ? (
                    <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-[#f4c27c]" aria-label="belum dibuka" />
                  ) : null}
                  <GiftArt kind={g.kind} objectKind={g.object_kind} className="h-16 w-16" />
                  <span className="text-sm text-ink">{g.kind === "object" ? objectName(g.object_kind) : GIFT_KIND[g.kind].name}</span>
                  <span className="font-mono text-[10px] text-ink-faint">{shortDate(g.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </div>
  );
}

function shortDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

function GiftDetail({
  gift,
  partnerName,
  calm,
  onPutAway,
  onRetryAudio,
}: {
  gift: ViewGift;
  partnerName: string;
  calm: boolean;
  onPutAway: (id: string, away: boolean) => void;
  onRetryAudio: () => void;
}) {
  const away = !!gift.put_away_at;
  return (
    <div className="flex flex-col gap-5">
      {gift.kind === "note" || gift.kind === "comfort" ? (
        <motion.div
          initial={calm ? false : { scaleY: 0.08, opacity: 0.4 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          style={{ originY: 0 }}
          className="rounded-xl border border-[#e3cdb6] bg-[#fbf3e8] bg-[repeating-linear-gradient(transparent,transparent_31px,#eadccb_31px,#eadccb_32px)] px-6 pt-6 pb-7 text-[#4b3229] shadow-[var(--shadow-lift)]"
        >
          {gift.kind === "comfort" ? (
            <p className="mb-2 font-mono text-[10px] tracking-[0.18em] text-[#8a6b5e] uppercase">for when you rest</p>
          ) : null}
          <motion.p
            initial={calm ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: calm ? 0 : 0.6, duration: 0.8 }}
            className="font-hand text-[1.6rem] leading-[32px] break-words whitespace-pre-wrap"
          >
            {gift.body}
          </motion.p>
          <p className="mt-4 text-right font-hand text-xl text-[#8a6b5e]">— {partnerName}</p>
        </motion.div>
      ) : null}

      {gift.kind === "voice" ? (
        <div className="flex flex-col items-center gap-4">
          <GiftArt kind="voice" className="h-20 w-20" />
          <p className="text-center font-hand text-2xl text-accent-ink">a voice, from {partnerName}</p>
          <VoicePlayer src={gift.audioUrl} knownSeconds={gift.audio_seconds} onRetry={onRetryAudio} className="w-full" />
          {gift.body ? <p className="text-center font-hand text-xl text-ink-soft">“{gift.body}”</p> : null}
        </div>
      ) : null}

      {gift.kind === "object" ? (
        <div className="flex flex-col items-center gap-3 py-2">
          <motion.div
            animate={calm ? {} : { y: [0, -6, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <GiftArt kind="object" objectKind={gift.object_kind} className="h-32 w-32" title={objectName(gift.object_kind)} />
          </motion.div>
          <p className="font-display text-lg text-ink">{objectName(gift.object_kind)}</p>
          {gift.body ? <p className="max-w-xs text-center font-hand text-2xl text-accent-ink">“{gift.body}”</p> : null}
          <p className="text-sm text-ink-faint">dari {partnerName}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rule-soft pt-4">
        <p className="font-mono text-[11px] text-ink-faint">
          {shortDate(gift.created_at)}
          {gift.edited_at ? " · diubah" : ""}
        </p>
        <button
          type="button"
          onClick={() => onPutAway(gift.id, !away)}
          className="rounded-full border border-rule px-4 py-2 text-sm text-ink-soft transition hover:border-accent-ink/40 hover:text-ink"
        >
          {away ? "taruh lagi di meja" : "simpan di kotak kecil"}
        </button>
      </div>
    </div>
  );
}

// ---- A few quiet settings -----------------------------------------------------

function RoomSettings({
  showCharacter,
  calmMotion,
  systemReduce,
  whatsappOn,
  partnerName,
  onCharacter,
  onCalm,
}: {
  showCharacter: boolean;
  calmMotion: boolean;
  systemReduce: boolean;
  whatsappOn: boolean;
  partnerName: string;
  onCharacter: (v: boolean) => void;
  onCalm: (v: boolean) => void;
}) {
  const [wa, setWa] = useState(whatsappOn);
  const [pending, start] = useTransition();
  return (
    <details className="group rounded-2xl border border-rule px-5 py-3">
      <summary className="cursor-pointer list-none text-sm text-ink-faint marker:hidden group-open:mb-3">
        pengaturan kamar <span aria-hidden>▾</span>
      </summary>
      <div className="flex flex-col gap-3 text-sm">
        <Toggle label="Tampilkan karakter kecil" checked={showCharacter} onChange={onCharacter} />
        <Toggle
          label="Gerakan lebih tenang"
          hint={systemReduce ? "Perangkatmu sudah meminta gerakan dikurangi — kamar mengikutinya." : undefined}
          checked={calmMotion || systemReduce}
          disabled={systemReduce}
          onChange={onCalm}
        />
        <Toggle
          label="Kabari aku lewat WhatsApp"
          hint={`Pesan umum saat ${partnerName} meninggalkan sesuatu — paling sering sekali tiap 3 jam.`}
          checked={wa}
          disabled={pending}
          onChange={(v) => {
            setWa(v);
            start(async () => {
              const r = await setStayWhatsApp(v);
              if (r.error) setWa(!v);
            });
          }}
        />
        <p className="text-xs text-ink-faint">Lampu dan jendela diingat dari terakhir kamu menyentuhnya.</p>
      </div>
    </details>
  );
}

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-ink">{label}</span>
        {hint ? <span className="block text-xs text-ink-faint">{hint}</span> : null}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 flex-none accent-[var(--accent-ink)]"
      />
    </label>
  );
}
