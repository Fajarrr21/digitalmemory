"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * The room's nervous system: one Supabase Realtime channel per room.
 *
 * Broadcast carries the things that must feel instant — a pause, a seek, a
 * line of chat, a floating ❤️, and the WebRTC handshake for voice. Presence
 * carries who is actually here right now (watching / stepped away / on mic /
 * speaking), which is exactly the kind of state that should evaporate when
 * someone closes the tab rather than linger in a table.
 *
 * Durable truth still lives in `watch_rooms` and `watch_messages` — broadcast
 * is the fast path, never the only path, so a missed packet costs a second of
 * drift and nothing more.
 */

export type RoomEvent =
  /** "We are HERE, as of then." — the shared clock moved. */
  | {
      type: "playback";
      by: string;
      isPlaying: boolean;
      positionSeconds: number;
      positionAt: number;
      durationSeconds: number | null;
      /** A seek should snap immediately, even inside the drift tolerance. */
      hard?: boolean;
    }
  /** 3 → 2 → 1 → PLAY, together. */
  | { type: "start"; by: string; at: number }
  | { type: "end"; by: string }
  | {
      type: "chat";
      by: string;
      id: string;
      body: string;
      atSeconds: number | null;
      replyTo: string | null;
      createdAt: string;
    }
  | { type: "reaction"; by: string; id: string; emoji: string }
  /** WebRTC signalling — opaque to the room, forwarded to the voice hook. */
  | { type: "rtc"; by: string; to: string | null; signal: RtcSignal };

export type RtcSignal =
  | { kind: "join" }
  | { kind: "leave" }
  | { kind: "offer"; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; sdp: RTCSessionDescriptionInit }
  | { kind: "ice"; candidate: RTCIceCandidateInit };

export type SelfPresence = {
  name: string;
  away: boolean;
  ready: boolean;
  mic: boolean;
  speaking: boolean;
  voice: boolean;
};

export type Peer = SelfPresence & { userId: string };

const EVENTS: RoomEvent["type"][] = ["playback", "start", "end", "chat", "reaction", "rtc"];

export function useRoomChannel({
  roomId,
  selfId,
  initialPresence,
  onEvent,
}: {
  roomId: string;
  selfId: string;
  /** What we announce the moment we connect; change it later with `track`. */
  initialPresence: SelfPresence;
  onEvent: (event: RoomEvent) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [connected, setConnected] = useState(false);
  const [peers, setPeers] = useState<Peer[]>([]);

  // Kept in refs so the subscription is built once per room, not per render.
  // Synced in an effect declared *before* the one that subscribes, so the
  // handler is already current by the time anything can arrive.
  const onEventRef = useRef(onEvent);
  const presenceRef = useRef(initialPresence);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let disposed = false;
    let current: RealtimeChannel | null = null;

    /**
     * Prefer a PRIVATE channel, which Supabase authorises against the policy in
     * migration 0016 — only members of this room's space may join. If that
     * policy isn't in place (an older Realtime, or the block in 0016 was
     * skipped), fall back once to a public channel on the same unguessable
     * topic so a room still works, and say why in the console.
     */
    function open(isPrivate: boolean) {
      if (disposed) return;
      const channel = supabase.channel(`watch:${roomId}`, {
        config: {
          private: isPrivate,
          // We already applied our own actions locally; echoes would fight them.
          broadcast: { self: false },
          presence: { key: selfId },
        },
      });
      current = channel;
      channelRef.current = channel;

      for (const event of EVENTS) {
        channel.on("broadcast", { event }, ({ payload }) => {
          const e = payload as RoomEvent;
          if (e && e.by !== selfId) onEventRef.current(e);
        });
      }

      channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<SelfPresence & { userId?: string }>();
        const next: Peer[] = [];
        for (const [key, entries] of Object.entries(state)) {
          const latest = entries[entries.length - 1];
          if (!latest) continue;
          next.push({
            userId: latest.userId ?? key,
            name: latest.name ?? "…",
            away: !!latest.away,
            ready: !!latest.ready,
            mic: !!latest.mic,
            speaking: !!latest.speaking,
            voice: !!latest.voice,
          });
        }
        setPeers(next);
      });

      void channel.subscribe((status) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          setConnected(true);
          void channel.track({ userId: selfId, ...presenceRef.current });
          return;
        }
        setConnected(false);
        if (status === "CHANNEL_ERROR" && isPrivate) {
          console.warn(
            "[watch] private Realtime channel refused — run the realtime policy block in supabase/migrations/0016_watch_together.sql. Falling back to a public channel.",
          );
          void supabase.removeChannel(channel);
          open(false);
        }
      });
    }

    open(true);

    return () => {
      disposed = true;
      channelRef.current = null;
      setConnected(false);
      if (current) void supabase.removeChannel(current);
    };
  }, [roomId, selfId, supabase]);

  /**
   * Announce a change in our own presence — being here, stepping away, going
   * on mic, starting to talk. Remembered, so a reconnect re-announces the
   * latest state rather than whatever was true when the room opened.
   */
  const track = useCallback(
    (next: SelfPresence) => {
      presenceRef.current = next;
      void channelRef.current?.track({ userId: selfId, ...next });
    },
    [selfId],
  );

  const send = useCallback((event: RoomEvent) => {
    const channel = channelRef.current;
    if (!channel) return;
    void channel.send({ type: "broadcast", event: event.type, payload: event });
  }, []);

  /** The other person, if they're currently in the room. */
  const partnerPeer = peers.find((p) => p.userId !== selfId) ?? null;

  return { connected, peers, partnerPeer, send, track };
}
