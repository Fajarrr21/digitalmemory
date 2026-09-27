"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PaperCard } from "@/components/ui/paper-card";
import { SoloBooth } from "./solo-booth";
import { createBoothSession } from "./actions";
import { cn } from "@/lib/utils";

/**
 * The booth doorway — "Who's in the frame?" comes FIRST; the frame is chosen
 * afterwards with the camera already live. Just Me runs right here; Both of Us
 * creates a session and moves to its own page (whose link is the invitation).
 */
export function BoothEntry({
  spaceId,
  userId,
  partnerName,
  dateISO,
  initialFrameId,
}: {
  spaceId: string;
  userId: string;
  partnerName: string | null;
  dateISO: string;
  initialFrameId: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"choose" | "solo">("choose");
  const [creating, startCreate] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function createDuo() {
    startCreate(async () => {
      setError(null);
      const res = await createBoothSession(initialFrameId ?? undefined);
      if (!res.ok || !res.id) {
        setError(res.error ?? "Gagal menyiapkan photobooth.");
        return;
      }
      router.push(`/photobooth/session/${res.id}`);
    });
  }

  if (mode === "solo") {
    return (
      <SoloBooth
        spaceId={spaceId}
        userId={userId}
        dateISO={dateISO}
        initialFrameId={initialFrameId}
        onBack={() => setMode("choose")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <p className="text-4xl">📸</p>
        <h1 className="mt-2 font-display text-3xl font-medium text-ink">
          A Little Photo Booth
        </h1>
        <p className="mt-1 font-hand text-xl text-accent-ink">
          Two people. One little frame.
        </p>
        <p className="mt-3 text-sm text-ink-soft">Who&apos;s in the frame?</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button type="button" onClick={() => setMode("solo")} className="group text-left">
          <PaperCard className="h-full transition group-hover:-translate-y-0.5 group-hover:border-accent-ink/40">
            <p className="text-3xl">👤</p>
            <p className="mt-3 font-display text-xl font-medium text-ink">Just Me</p>
            <p className="mt-1 text-sm text-ink-soft">
              Kamera langsung nyala — tinggal pilih frame &amp; jepret.
            </p>
          </PaperCard>
        </button>

        <button
          type="button"
          onClick={createDuo}
          disabled={creating}
          className={cn("group text-left", creating && "opacity-70")}
        >
          <PaperCard className="h-full bg-gradient-to-br from-blush/40 to-paper transition group-hover:-translate-y-0.5 group-hover:border-accent-ink/40">
            <p className="text-3xl">♡</p>
            <p className="mt-3 font-display text-xl font-medium text-ink">Both of Us</p>
            <p className="mt-1 text-sm text-ink-soft">
              {creating
                ? "Menyiapkan boothnya…"
                : `One booth for two — invite ${partnerName ?? "your person"} with a link.`}
            </p>
          </PaperCard>
        </button>
      </div>

      {error ? <p role="alert" className="text-center text-sm text-danger">{error}</p> : null}

      <p className="text-center font-hand text-lg text-accent-ink">
        A little place to make a little memory. ♡
      </p>
    </div>
  );
}
