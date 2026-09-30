"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { joinWatchRoom } from "../../actions";

/** "Fajar invited you to watch something together. ♡" — taking the invite. */
export function JoinRoom({ roomId, alreadyIn }: { roomId: string; alreadyIn: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  function join() {
    startBusy(async () => {
      setError(null);
      const res = await joinWatchRoom(roomId);
      if (res.error) {
        setError(res.error);
        return;
      }
      router.push(`/watch/room/${roomId}`);
    });
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <Button type="button" onClick={join} disabled={busy}>
        {busy ? "Masuk…" : alreadyIn ? "Kembali ke room →" : "Join room"}
      </Button>
      {error ? <p className="text-sm text-ink-soft">{error}</p> : null}
    </div>
  );
}
