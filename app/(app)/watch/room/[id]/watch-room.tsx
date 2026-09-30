"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { PaperCard } from "@/components/ui/paper-card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { LittleChat, type ChatLine } from "@/components/watch/little-chat";
import { ReactionLayer, type FloatingReaction } from "@/components/watch/reaction-layer";
import { VideoStage, type StageHandle } from "@/components/watch/video-stage";
import {
  CLOCK_TICK_MS,
  ROOM_POLL_MS,
  claimAt,
  expectedPosition,
  formatClock,
  minutesTogether,
  seekFromRatio,
  shouldResync,
  type PlaybackState,
} from "@/lib/watch/sync";
import { cn } from "@/lib/utils";
import {
  AWAY_AFTER_MS,
  CHAT_MAX,
  COUNTDOWN_FROM,
  COUNTDOWN_STEP_MS,
  QUICK_REACTIONS,
  REACTIONS,
  REACTION_LIFETIME_MS,
  SNACK_BREAK_AFTER_MS,
  sourceNote,
} from "../../watch-config";
import {
  addWatchReaction,
  endWatchRoom,
  getRoomState,
  saveWatchMemory,
  sendWatchMessage,
  startWatching,
  updatePlayback,
  type RoomSnapshot,
} from "../../actions";
import {
  useRoomChannel,
  type RoomEvent,
  type RtcSignal,
  type SelfPresence,
} from "./use-room-channel";
import { useVoice } from "./use-voice";

/**
 * 🍿 The Watch Room.
 *
 * One room, one watching, two people. Playback lives in ONE claim — "we were
 * here, as of then" — which both sides derive the present from: broadcast
 * makes a pause feel instant, the room row makes it survive a reload, and a
 * slow poll catches whatever slipped through. Voice is peer-to-peer and never
 * recorded. Chat and reactions are for the two of you and nobody else.
 */

const STATUS_RANK = { waiting: 0, ready: 1, watching: 2, ended: 3 } as const;

/** Statuses only ever move forward — a slow poll can't drag us back. */
function advance(room: RoomSnapshot, status: RoomSnapshot["status"]): RoomSnapshot {
  return STATUS_RANK[status] > STATUS_RANK[room.status] ? { ...room, status } : room;
}

export function WatchRoom({
  initial,
  initialMessages,
  selfId,
  selfName,
  inviteUrl,
}: {
  initial: RoomSnapshot;
  initialMessages: ChatLine[];
  selfId: string;
  selfName: string;
  inviteUrl: string;
}) {
  const reduce = useReducedMotion();
  const [room, setRoom] = useState<RoomSnapshot>(initial);
  const [messages, setMessages] = useState<ChatLine[]>(initialMessages);
  const [floating, setFloating] = useState<FloatingReaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, startBusy] = useTransition();

  const [selfReady, setSelfReady] = useState(false);
  const [away, setAway] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [playing, setPlaying] = useState(initial.isPlaying);
  const [displayTime, setDisplayTime] = useState(initial.positionSeconds);
  const [duration, setDuration] = useState<number | null>(initial.durationSeconds);
  const [partnerBack, setPartnerBack] = useState(false);
  const [snack, setSnack] = useState(false);
  const [note, setNote] = useState("");
  const [savedMemoryId, setSavedMemoryId] = useState<string | null>(initial.memoryId);

  const stageRef = useRef<StageHandle>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const clockRef = useRef<PlaybackState>({
    isPlaying: initial.isPlaying,
    positionSeconds: initial.positionSeconds,
    positionAt: initial.positionAt,
    durationSeconds: initial.durationSeconds,
  });
  /** A window in which player events are OUR doing, not the viewer's. */
  const suppressUntil = useRef(0);
  /** When the current pause began — null while playing. */
  const pausedSince = useRef<number | null>(null);
  const lastPersist = useRef(0);
  const awayTimer = useRef<number | null>(null);
  /** Late-bound, so event handling doesn't have to be declared after voice. */
  const onRtcRef = useRef<(signal: RtcSignal) => void>(() => {});

  const isHost = room.hostId === selfId;
  const partnerName = (isHost ? room.guestName : room.hostName) ?? "Dia";
  const controllable = room.controllable;

  // ---- the shared clock ----------------------------------------------------

  /** Put this player where the room says we are. */
  const applyClock = useCallback((hard = false) => {
    const clock = clockRef.current;
    setPlaying(clock.isPlaying);
    const stage = stageRef.current;
    if (!stage?.controllable) return;
    const target = expectedPosition(clock);
    suppressUntil.current = Date.now() + 900;
    if (hard || shouldResync(stage.getTime(), target)) stage.seek(target);
    if (clock.isPlaying) stage.play();
    else stage.pause();
  }, []);

  /** Follow somebody else's claim. */
  const adoptClock = useCallback(
    (next: PlaybackState, hard = false) => {
      clockRef.current = next;
      pausedSince.current = next.isPlaying ? null : Date.now();
      setDuration(next.durationSeconds);
      applyClock(hard);
    },
    [applyClock],
  );

  const pushReaction = useCallback((emoji: string, mine: boolean, id: string) => {
    const item: FloatingReaction = { id, emoji, x: 0.15 + Math.random() * 0.7, mine };
    setFloating((prev) => [...prev, item]);
    window.setTimeout(
      () => setFloating((prev) => prev.filter((r) => r.id !== item.id)),
      REACTION_LIFETIME_MS,
    );
  }, []);

  // ---- realtime ------------------------------------------------------------

  const handleEvent = useCallback(
    (e: RoomEvent) => {
      switch (e.type) {
        case "playback":
          adoptClock(
            {
              isPlaying: e.isPlaying,
              positionSeconds: e.positionSeconds,
              positionAt: e.positionAt,
              durationSeconds: e.durationSeconds,
            },
            !!e.hard,
          );
          break;
        case "start":
          setRoom((r) => advance(r, "watching"));
          setCountdown(COUNTDOWN_FROM);
          break;
        case "end":
          setRoom((r) => advance(r, "ended"));
          break;
        case "chat":
          setMessages((prev) =>
            prev.some((m) => m.id === e.id)
              ? prev
              : [
                  ...prev,
                  {
                    id: e.id,
                    userId: e.by,
                    body: e.body,
                    replyTo: e.replyTo,
                    atSeconds: e.atSeconds,
                    createdAt: e.createdAt,
                  },
                ],
          );
          break;
        case "reaction":
          pushReaction(e.emoji, false, e.id);
          break;
        case "rtc":
          if (e.to === null || e.to === selfId) onRtcRef.current(e.signal);
          break;
      }
    },
    [adoptClock, pushReaction, selfId],
  );

  const { connected, partnerPeer, send, track } = useRoomChannel({
    roomId: room.id,
    selfId,
    initialPresence: {
      name: selfName,
      away: false,
      ready: false,
      mic: false,
      speaking: false,
      voice: false,
    },
    onEvent: handleEvent,
  });

  // ---- voice ---------------------------------------------------------------

  const sendSignal = useCallback(
    (to: string | null, signal: RtcSignal) => send({ type: "rtc", by: selfId, to, signal }),
    [selfId, send],
  );

  const voice = useVoice({
    isHost,
    partnerInVoice: !!partnerPeer?.voice,
    send: sendSignal,
    onSpeakingChange: setSpeaking,
  });

  const handleSignal = voice.handleSignal;
  useEffect(() => {
    onRtcRef.current = (signal) => void handleSignal(signal);
  }, [handleSignal]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.srcObject = voice.remoteStream;
  }, [voice.remoteStream]);

  // Everything the other side should know about us, announced whenever it moves.
  const presence: SelfPresence = useMemo(
    () => ({
      name: selfName,
      away,
      ready: selfReady,
      mic: voice.inVoice && !voice.muted,
      speaking,
      voice: voice.inVoice,
    }),
    [away, selfName, selfReady, speaking, voice.inVoice, voice.muted],
  );
  useEffect(() => {
    track(presence);
  }, [presence, track]);

  useEffect(() => {
    if (!clockRef.current.isPlaying) pausedSince.current = Date.now();
  }, []);

  // ---- refresh + slow poll -------------------------------------------------

  const refresh = useCallback(async () => {
    const res = await getRoomState(room.id);
    if (!res.ok || !res.room) return;
    const next = res.room;
    setRoom((prev) =>
      STATUS_RANK[next.status] >= STATUS_RANK[prev.status]
        ? next
        : { ...next, status: prev.status },
    );
    setSavedMemoryId(next.memoryId);
    // Only adopt a claim newer than the one we're already following.
    if (next.positionAt > clockRef.current.positionAt && next.updatedBy !== selfId) {
      adoptClock({
        isPlaying: next.isPlaying,
        positionSeconds: next.positionSeconds,
        positionAt: next.positionAt,
        durationSeconds: next.durationSeconds,
      });
    }
  }, [adoptClock, room.id, selfId]);

  useEffect(() => {
    if (room.status === "ended") return;
    const t = window.setInterval(() => void refresh(), ROOM_POLL_MS);
    return () => window.clearInterval(t);
  }, [refresh, room.status]);

  // ---- publishing our own moves -------------------------------------------

  const publish = useCallback(
    (state: PlaybackState, hard: boolean, persist: boolean) => {
      clockRef.current = state;
      pausedSince.current = state.isPlaying ? null : Date.now();
      setPlaying(state.isPlaying);
      send({
        type: "playback",
        by: selfId,
        isPlaying: state.isPlaying,
        positionSeconds: state.positionSeconds,
        positionAt: state.positionAt,
        durationSeconds: state.durationSeconds,
        hard,
      });
      if (persist) {
        lastPersist.current = Date.now();
        void updatePlayback(room.id, {
          isPlaying: state.isPlaying,
          positionSeconds: state.positionSeconds,
          durationSeconds: state.durationSeconds,
        });
      }
    },
    [room.id, selfId, send],
  );

  /** The player moved on its own — i.e. the person in front of it moved it. */
  const onStageState = useCallback(
    (isPlaying: boolean, at: number, dur: number | null) => {
      setDuration(dur);
      if (Date.now() < suppressUntil.current) return; // that was us, following
      if (room.status !== "watching") return;
      publish(claimAt(at, isPlaying, dur), false, true);
    },
    [publish, room.status],
  );

  const toggle = useCallback(() => {
    const stage = stageRef.current;
    if (!stage?.controllable) {
      // An embed: we can't move their player, but we can still say "hold on".
      publish(
        claimAt(expectedPosition(clockRef.current), !clockRef.current.isPlaying, duration),
        false,
        true,
      );
      return;
    }
    if (clockRef.current.isPlaying) stage.pause();
    else stage.play();
  }, [duration, publish]);

  const seekTo = useCallback(
    (seconds: number) => {
      const stage = stageRef.current;
      if (!stage?.controllable) return;
      suppressUntil.current = Date.now() + 900;
      stage.seek(seconds);
      publish(claimAt(seconds, clockRef.current.isPlaying, duration), true, true);
    },
    [duration, publish],
  );

  // The bar's heartbeat.
  useEffect(() => {
    if (room.status !== "watching") return;
    const id = window.setInterval(() => {
      const stage = stageRef.current;
      setDisplayTime(stage?.controllable ? stage.getTime() : expectedPosition(clockRef.current));
      const dur = stage?.getDuration() ?? clockRef.current.durationSeconds;
      if (dur && dur !== duration) setDuration(dur);
    }, 250);
    return () => window.clearInterval(id);
  }, [duration, room.status]);

  // The host re-states the truth now and then, so drift can't accumulate.
  useEffect(() => {
    if (room.status !== "watching" || !isHost || !controllable) return;
    const id = window.setInterval(() => {
      const stage = stageRef.current;
      if (!stage?.controllable || !clockRef.current.isPlaying) return;
      // Broadcast often, write to the database rarely — the row only has to be
      // right enough for a reload, not for every second of the film.
      publish(
        claimAt(stage.getTime(), true, stage.getDuration()),
        false,
        Date.now() - lastPersist.current > 20_000,
      );
    }, CLOCK_TICK_MS);
    return () => window.clearInterval(id);
  }, [controllable, isHost, publish, room.status]);

  // ---- presence: stepping away --------------------------------------------

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        awayTimer.current = window.setTimeout(() => setAway(true), AWAY_AFTER_MS);
      } else {
        if (awayTimer.current) window.clearTimeout(awayTimer.current);
        awayTimer.current = null;
        setAway(false);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (awayTimer.current) window.clearTimeout(awayTimer.current);
    };
  }, []);

  // "Nobody gets left behind": when one of you wanders off, the room waits.
  const partnerAway = !!partnerPeer?.away;
  const wasAway = useRef(false);
  useEffect(() => {
    if (partnerAway && !wasAway.current) {
      wasAway.current = true;
      if (room.status === "watching" && clockRef.current.isPlaying && controllable) {
        stageRef.current?.pause();
      }
    } else if (!partnerAway && wasAway.current) {
      wasAway.current = false;
      setPartnerBack(true);
      const t = window.setTimeout(() => setPartnerBack(false), 4000);
      return () => window.clearTimeout(t);
    }
  }, [controllable, partnerAway, room.status]);

  // ---- 3 → 2 → 1 → PLAY ----------------------------------------------------

  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const t = window.setTimeout(
        () => setCountdown((c) => (c === null ? null : c - 1)),
        COUNTDOWN_STEP_MS,
      );
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => {
      setCountdown(null);
      const stage = stageRef.current;
      // Start immediately on both sides, then let the host's claim be the one
      // everyone lines up to — nobody waits a round-trip to hear the first note.
      if (isHost) {
        publish(claimAt(0, true, duration), true, true);
      } else {
        clockRef.current = claimAt(0, true, duration);
        setPlaying(true);
      }
      if (stage?.controllable) {
        suppressUntil.current = Date.now() + 900;
        stage.seek(0);
        stage.play();
      }
    }, 700);
    return () => window.clearTimeout(t);
  }, [countdown, duration, isHost, publish]);

  // ---- 🍿 snack break ------------------------------------------------------

  useEffect(() => {
    if (room.status !== "watching") return;
    const id = window.setInterval(() => {
      const since = pausedSince.current;
      setSnack(!!since && !clockRef.current.isPlaying && Date.now() - since > SNACK_BREAK_AFTER_MS);
    }, 1000);
    return () => window.clearInterval(id);
  }, [room.status]);

  // ---- things you press ----------------------------------------------------

  function react(emoji: string) {
    const id = crypto.randomUUID();
    pushReaction(emoji, true, id);
    send({ type: "reaction", by: selfId, id, emoji });
    void addWatchReaction(room.id, emoji, controllable ? displayTime : null);
  }

  function sendLine(body: string, replyTo: string | null) {
    const tempId = `temp-${crypto.randomUUID()}`;
    const atSeconds = room.status === "watching" ? displayTime : null;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        userId: selfId,
        body,
        replyTo,
        atSeconds,
        createdAt: new Date().toISOString(),
        pending: true,
      },
    ]);

    void (async () => {
      const res = await sendWatchMessage(room.id, body, atSeconds, replyTo);
      if (!res.ok || !res.message) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)),
        );
        return;
      }
      const saved = res.message;
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...saved } : m)));
      send({
        type: "chat",
        by: selfId,
        id: saved.id,
        body: saved.body,
        atSeconds: saved.atSeconds,
        replyTo: saved.replyTo,
        createdAt: saved.createdAt,
      });
    })();
  }

  function run(fn: () => Promise<{ ok?: boolean; error?: string }>, after?: () => void) {
    startBusy(async () => {
      setError(null);
      const res = await fn();
      if (res.error) setError(res.error);
      else after?.();
    });
  }

  function beginCountdown() {
    run(
      () => startWatching(room.id),
      () => {
        setRoom((r) => advance(r, "watching"));
        send({ type: "start", by: selfId, at: Date.now() });
        setCountdown(COUNTDOWN_FROM);
      },
    );
  }

  function wrapUp() {
    run(
      () => endWatchRoom(room.id),
      () => {
        stageRef.current?.pause();
        if (voice.inVoice) voice.leave();
        setRoom((r) => advance(r, "ended"));
        send({ type: "end", by: selfId });
      },
    );
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Gagal menyalin link. Salin manual dari address bar ya.");
    }
  }

  function toggleQuiet() {
    const next = !quiet;
    setQuiet(next);
    if (next) {
      setChatOpen(false);
      if (voice.inVoice) voice.leave();
    }
  }

  // ---- render --------------------------------------------------------------

  const bothHere = !!room.guestId;

  if (room.status === "ended") {
    return (
      <Wrap
        room={room}
        minutes={minutesTogether(room.startedAt, room.endedAt)}
        messageCount={messages.length}
        note={note}
        setNote={setNote}
        busy={busy}
        savedId={savedMemoryId}
        error={error}
        onSave={() =>
          run(async () => {
            const res = await saveWatchMemory(room.id, note);
            if (res.ok && res.id) setSavedMemoryId(res.id);
            return res;
          })
        }
      />
    );
  }

  if (room.status !== "watching") {
    return (
      <Lobby
        room={room}
        waiting={room.status === "waiting" || !bothHere}
        selfName={selfName}
        partnerName={partnerName}
        selfReady={selfReady}
        partnerReady={!!partnerPeer?.ready}
        connected={connected}
        copied={copied}
        busy={busy}
        error={error}
        onCopy={copyInvite}
        onReady={() => setSelfReady((r) => !r)}
        onStart={beginCountdown}
        onCancel={wrapUp}
      />
    );
  }

  const progress = duration && duration > 0 ? Math.min(1, displayTime / duration) : 0;
  const chat = (
    <LittleChat
      open
      lines={messages}
      selfId={selfId}
      selfName={selfName}
      partnerName={partnerName}
      maxLength={CHAT_MAX}
      onSend={sendLine}
      onClose={() => setChatOpen(false)}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {/* The other person's voice. Never recorded, never stored. */}
      <audio ref={audioRef} autoPlay playsInline className="hidden" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>🍿 watch together</Eyebrow>
          <h1 className="mt-1 truncate font-display text-xl font-medium text-ink">{room.title}</h1>
          {room.subtitle ? <p className="text-sm text-ink-soft">{room.subtitle}</p> : null}
        </div>
        <button
          type="button"
          onClick={wrapUp}
          disabled={busy}
          className="flex-none rounded-full border border-rule px-3 py-1.5 text-xs text-ink-soft transition hover:border-accent-ink/40 hover:text-accent-ink"
        >
          Selesai
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-3">
          <VideoStage
            ref={stageRef}
            kind={room.sourceKind}
            url={room.sourceUrl}
            videoId={room.videoId}
            posterUrl={room.posterUrl}
            onStateChange={onStageState}
            onReady={() => applyClock(true)}
            onTap={controllable ? toggle : undefined}
            overlay={
              <>
                <ReactionLayer items={floating} />

                <AnimatePresence>
                  {countdown !== null ? (
                    <motion.div
                      key="countdown"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 grid place-items-center bg-black/70"
                    >
                      <motion.p
                        key={countdown}
                        initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="font-display text-7xl font-medium text-white"
                      >
                        {countdown === 0 ? "▶" : countdown}
                      </motion.p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <AnimatePresence>
                  {snack && countdown === null ? (
                    <motion.div
                      key="snack"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 grid place-items-center bg-black/65 text-center"
                    >
                      <div>
                        <p className="text-4xl">⏸️</p>
                        <p className="mt-2 font-hand text-2xl text-white">Snack break? 🍿</p>
                        <p className="mt-2 font-mono text-[11px] tracking-[0.18em] text-white/60 uppercase">
                          {selfName} ● &nbsp; {partnerName} {partnerPeer && !partnerPeer.away ? "●" : "○"}
                        </p>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                {partnerAway ? (
                  <p className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 font-mono text-[11px] text-white/80">
                    ○ {partnerName} stepped away
                  </p>
                ) : partnerBack ? (
                  <p className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 font-hand text-sm text-white">
                    ● {partnerName} is back ♡
                  </p>
                ) : null}
              </>
            }
          />

          {/* ▶ 12:43 ━━━━━━━━━━━ 24:51 */}
          <div className="flex items-center gap-3 rounded-2xl border border-rule bg-paper px-4 py-3">
            <button
              type="button"
              onClick={toggle}
              aria-label={playing ? "Pause" : "Play"}
              className="flex-none text-lg text-accent-ink"
            >
              {playing ? "⏸" : "▶"}
            </button>
            <span className="flex-none font-mono text-xs text-ink-faint">
              {formatClock(displayTime)}
            </span>
            {controllable ? (
              <button
                type="button"
                aria-label="Geser posisi video"
                onClick={(e) => {
                  const box = e.currentTarget.getBoundingClientRect();
                  seekTo(seekFromRatio((e.clientX - box.left) / box.width, duration));
                }}
                className="relative h-6 min-w-0 flex-1 cursor-pointer"
              >
                <span className="absolute top-1/2 left-0 h-1 w-full -translate-y-1/2 rounded-full bg-rule" />
                <span
                  className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-accent-ink/70"
                  style={{ width: `${progress * 100}%` }}
                />
              </button>
            ) : (
              <span className="min-w-0 flex-1 truncate text-center font-hand text-sm text-accent-ink">
                nonton bareng — tekan play masing-masing ♡
              </span>
            )}
            <span className="flex-none font-mono text-xs text-ink-faint">
              {controllable && duration ? formatClock(duration) : ""}
            </span>
          </div>

          {/* ● Fajar  ● Her · 🎙️ 💬 ❤️ 😂 😭 */}
          <div className="flex flex-col gap-3 rounded-2xl border border-rule bg-paper px-4 py-3">
            <div className="flex items-center justify-center gap-5">
              <Watcher
                name={selfName}
                here={!away}
                speaking={speaking}
                mic={voice.inVoice && !voice.muted}
              />
              <Watcher
                name={partnerName}
                here={!!partnerPeer && !partnerPeer.away}
                speaking={!!partnerPeer?.speaking}
                mic={!!partnerPeer?.mic}
              />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => (voice.inVoice ? voice.leave() : void voice.join())}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition",
                  voice.inVoice
                    ? "border-accent-ink/40 bg-blush/40 text-accent-ink"
                    : "border-rule text-ink-soft hover:border-accent-ink/40",
                )}
              >
                🎙️{" "}
                {voice.status === "connecting"
                  ? "menyambungkan…"
                  : voice.inVoice
                    ? "On mic"
                    : "Nyalakan mic"}
              </button>
              {voice.inVoice ? (
                <button
                  type="button"
                  onClick={voice.toggleMute}
                  className="rounded-full border border-rule px-3 py-1.5 text-sm text-ink-soft transition hover:border-accent-ink/40"
                >
                  {voice.muted ? "🔇 Unmute" : "🔊 Mute"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setChatOpen((c) => !c)}
                className="rounded-full border border-rule px-3 py-1.5 text-sm text-ink-soft transition hover:border-accent-ink/40"
              >
                💬 Chat
              </button>
              <button
                type="button"
                onClick={toggleQuiet}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition",
                  quiet
                    ? "border-accent-ink/40 bg-blush/40 text-accent-ink"
                    : "border-rule text-ink-soft hover:border-accent-ink/40",
                )}
              >
                🎧 Quiet
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {[...(quiet ? QUICK_REACTIONS : REACTIONS)].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => react(emoji)}
                  aria-label={`Kirim ${emoji}`}
                  className="rounded-full px-2.5 py-1.5 text-xl transition hover:scale-110 hover:bg-blush/40 active:scale-95"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {quiet ? (
              <p className="text-center text-xs text-ink-soft">
                🎧 Quiet Watch — mic mati, chat disembunyikan. Reaksi tetap ada. ♡
              </p>
            ) : null}
            {voice.error ? <p className="text-center text-xs text-ink-soft">{voice.error}</p> : null}
            {!connected ? (
              <p className="text-center font-mono text-[11px] text-ink-faint">
                menyambungkan kembali…
              </p>
            ) : null}
          </div>

          {!controllable ? (
            <p className="text-center text-xs text-ink-soft">{sourceNote(room.sourceKind)}</p>
          ) : null}
          {error ? <p className="text-center text-sm text-ink-soft">{error}</p> : null}
        </div>

        {/* Chat: a column on a wide screen, a drawer over the bottom on a phone. */}
        {chatOpen ? (
          <>
            <div className="hidden lg:block">{chat}</div>
            <div
              className="fixed inset-x-0 bottom-0 z-50 p-3 lg:hidden"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
            >
              {chat}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Watcher({
  name,
  here,
  speaking,
  mic,
}: {
  name: string;
  here: boolean;
  speaking: boolean;
  mic: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "grid h-9 w-9 place-items-center rounded-full border text-sm transition-all duration-300",
          here ? "border-accent-ink/40 bg-blush/50 text-accent-ink" : "border-rule text-ink-faint",
          speaking && "ring-2 ring-accent-ink/60 ring-offset-2 ring-offset-paper",
        )}
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm text-ink">{name}</span>
        <span className="font-mono text-[10px] text-ink-faint">
          {here ? (mic ? "● on mic" : "● watching") : "○ stepped away"}
        </span>
      </span>
    </div>
  );
}

function Lobby({
  room,
  waiting,
  selfName,
  partnerName,
  selfReady,
  partnerReady,
  connected,
  copied,
  busy,
  error,
  onCopy,
  onReady,
  onStart,
  onCancel,
}: {
  room: RoomSnapshot;
  waiting: boolean;
  selfName: string;
  partnerName: string;
  selfReady: boolean;
  partnerReady: boolean;
  connected: boolean;
  copied: boolean;
  busy: boolean;
  error: string | null;
  onCopy: () => void;
  onReady: () => void;
  onStart: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <Eyebrow>🍿 {waiting ? "watch room" : "movie night"}</Eyebrow>
        <h1 className="mt-3 font-display text-2xl font-medium text-ink text-balance">
          🎬 {room.title}
        </h1>
        {room.subtitle ? <p className="mt-1 text-ink-soft">{room.subtitle}</p> : null}
      </div>

      <PaperCard className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Row name={selfName} state={selfReady ? "✓ Ready" : "● Here"} />
          <Row
            name={partnerName}
            state={waiting ? "○ Waiting…" : partnerReady ? "✓ Ready" : "● Here"}
          />
        </div>

        <div className="border-t border-rule-soft pt-4 text-center">
          {waiting ? (
            <>
              <p className="font-hand text-xl text-accent-ink">kirim linknya ke dia ♡</p>
              <p className="mt-1 text-sm text-ink-soft">
                Room ini cuma bisa dibuka lewat link ini, dan cuma oleh kalian berdua.
              </p>
              <Button type="button" onClick={onCopy} className="mt-4">
                {copied ? "Tersalin ♡" : "🔗 Copy invite link"}
              </Button>
            </>
          ) : (
            <>
              <p className="font-hand text-xl text-accent-ink">Both of you are here. ♡</p>
              <p className="mt-1 text-sm text-ink-soft">
                Tekan siap dulu berdua — biar suaranya nggak ketahan browser pas mulai.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button type="button" variant={selfReady ? "soft" : "primary"} onClick={onReady}>
                  {selfReady ? "✓ Aku siap" : "Aku siap"}
                </Button>
                <Button type="button" onClick={onStart} disabled={busy || !selfReady || !partnerReady}>
                  Start watching →
                </Button>
              </div>
              {!partnerReady ? (
                <p className="mt-2 font-mono text-[11px] text-ink-faint">
                  menunggu {partnerName} menekan siap…
                </p>
              ) : null}
            </>
          )}
        </div>

        <p className="text-center text-xs text-ink-soft">{sourceNote(room.sourceKind)}</p>
        {!connected ? (
          <p className="text-center font-mono text-[11px] text-ink-faint">menyambungkan…</p>
        ) : null}
        {error ? <p className="text-center text-sm text-ink-soft">{error}</p> : null}
      </PaperCard>

      <div className="text-center">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="text-xs text-ink-faint underline underline-offset-4 hover:text-ink-soft"
        >
          Tutup room ini
        </button>
      </div>
    </div>
  );
}

function Row({ name, state }: { name: string; state: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink">{name}</span>
      <span className="font-mono text-xs text-ink-faint">{state}</span>
    </div>
  );
}

function Wrap({
  room,
  minutes,
  messageCount,
  note,
  setNote,
  busy,
  savedId,
  error,
  onSave,
}: {
  room: RoomSnapshot;
  minutes: number;
  messageCount: number;
  note: string;
  setNote: (v: string) => void;
  busy: boolean;
  savedId: string | null;
  error: string | null;
  onSave: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <p className="text-4xl">🍿</p>
        <h1 className="mt-3 font-display text-2xl font-medium text-ink">That&apos;s a wrap.</h1>
        <p className="mt-2 text-ink">{room.title}</p>
        {room.subtitle ? <p className="text-sm text-ink-soft">{room.subtitle}</p> : null}
        <p className="mt-4 text-ink-soft">
          You watched together for <span className="text-accent-ink">{minutes}</span> minute
          {minutes === 1 ? "" : "s"}.
        </p>
        <p className="mt-2 font-hand text-2xl text-accent-ink">♡</p>
      </div>

      {savedId ? (
        <PaperCard className="text-center">
          <p className="font-hand text-xl text-accent-ink">disimpan ♡</p>
          <p className="mt-1 text-sm text-ink-soft">
            {messageCount} pesan malam ini ikut tersimpan.
          </p>
          <Link
            href={`/watch/${savedId}`}
            className="mt-4 inline-block text-sm text-accent-ink hover:underline"
          >
            Lihat momennya →
          </Link>
        </PaperCard>
      ) : (
        <PaperCard className="flex flex-col gap-3">
          <Eyebrow>save this moment</Eyebrow>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Kita malah lebih banyak ketawa daripada nonton 😭"
            className="w-full resize-none rounded-xl border border-rule bg-ground px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-accent-ink/50"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/watch" className="text-sm text-ink-faint hover:text-ink-soft">
              Nanti aja
            </Link>
            <Button type="button" onClick={onSave} disabled={busy}>
              💾 Save this moment
            </Button>
          </div>
          {error ? <p className="text-sm text-ink-soft">{error}</p> : null}
        </PaperCard>
      )}

      <div className="text-center">
        <Link href="/watch" className="text-sm text-accent-ink hover:underline">
          ← Kembali ke Watch Together
        </Link>
      </div>
    </div>
  );
}
