"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * stay, my love. — the "I'm here" light. One Realtime channel per space,
 * `stay:<space id>`, opened PRIVATE (gated by the policy in migration 0020).
 *
 *   presence  — who is in their room right now. Only the room page tracks
 *               presence; the "leave something" page joins without it, so
 *               it can never make someone look present who isn't.
 *   broadcast — "heart" (a small heart across the distance) and "gift"
 *               (something was just left — the room re-reads and glows).
 *
 * Presence is never stored and never guessed: if the channel can't connect,
 * the partner simply isn't shown as here. Durable things (gifts) live in the
 * table; broadcast is only the fast path.
 */

export type StayEvent = { type: "heart"; by: string; id: string } | { type: "gift"; by: string };

export function useStayChannel({
  spaceId,
  selfId,
  track,
  onEvent,
}: {
  spaceId: string;
  selfId: string;
  /** Announce "I'm in my room" (room page only). */
  track: boolean;
  onEvent?: (e: StayEvent) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [connected, setConnected] = useState(false);
  const [partnerHere, setPartnerHere] = useState(false);
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let disposed = false;
    let current: RealtimeChannel | null = null;

    function open(isPrivate: boolean) {
      if (disposed) return;
      const channel = supabase.channel(`stay:${spaceId}`, {
        config: { private: isPrivate, broadcast: { self: false }, presence: { key: selfId } },
      });
      current = channel;
      channelRef.current = channel;

      for (const event of ["heart", "gift"] as const) {
        channel.on("broadcast", { event }, ({ payload }) => {
          const e = payload as StayEvent;
          if (e && e.by !== selfId) onEventRef.current?.(e);
        });
      }
      channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ userId?: string; inRoom?: boolean }>();
        const here = Object.entries(state).some(
          ([key, entries]) => key !== selfId && entries.some((p) => p.inRoom),
        );
        setPartnerHere(here);
      });

      void channel.subscribe((status) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          setConnected(true);
          if (track) void channel.track({ userId: selfId, inRoom: true });
          return;
        }
        setConnected(false);
        setPartnerHere(false);
        if (status === "CHANNEL_ERROR" && isPrivate) {
          console.warn(
            "[stay] private Realtime channel refused — run the realtime policy block in supabase/migrations/0020_stay_my_love.sql. Falling back to a public channel.",
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
      setPartnerHere(false);
      if (current) void supabase.removeChannel(current);
    };
  }, [spaceId, selfId, track, supabase]);

  const send = useCallback((e: StayEvent) => {
    void channelRef.current?.send({ type: "broadcast", event: e.type, payload: e });
  }, []);

  return { connected, partnerHere, send };
}
