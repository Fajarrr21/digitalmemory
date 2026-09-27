"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/utils";
import { CameraCapture } from "./camera";
import { FramePicker } from "./frame-picker";
import { BoothResultActions } from "./booth-result";
import { composeBoothStrip } from "./compose-strip";
import { frameById, randomSoloPrompt, SOLO_ALBUM_TITLE } from "./photobooth-config";

type Phase = "setup" | "shoot" | "reveal" | "result";

/**
 * 👤 Just Me — the whole flow lives on this device: choose frame & shots,
 * countdown-capture each photo, compose the strip on a canvas, then
 * download / save to the "My Photobooth" album / share. No session rows.
 */
export function SoloBooth({
  spaceId,
  userId,
  name,
  dateISO,
  dateLabel,
  bestFlameDay,
  initialFrameId,
  onBack,
}: {
  spaceId: string;
  userId: string;
  name: string;
  dateISO: string;
  dateLabel: string;
  bestFlameDay: number;
  initialFrameId: string | null;
  onBack: () => void;
}) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("setup");
  const [frameId, setFrameId] = useState(frameById(initialFrameId).id);
  const [shotCount, setShotCount] = useState<1 | 4>(1);
  const [photos, setPhotos] = useState<string[]>([]);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [strip, setStrip] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const frame = frameById(frameId);

  async function keepPhoto(_blob: Blob, dataUrl: string) {
    const next = [...photos, dataUrl];
    setPhotos(next);
    setPrompt(null);
    if (next.length >= shotCount) {
      setError(null);
      try {
        const blob = await composeBoothStrip({
          frame,
          shots: next.map((p) => [p]),
          names: [name],
          dateLabel,
        });
        setStrip({ blob, url: URL.createObjectURL(blob) });
        setPhase("reveal");
      } catch {
        setError("Gagal menyusun stripnya. Coba lagi ya. ♡");
        setPhotos([]);
        setPhase("setup");
      }
    }
  }

  function restart() {
    if (strip) URL.revokeObjectURL(strip.url);
    setStrip(null);
    setPhotos([]);
    setPrompt(null);
    setPhase("setup");
  }

  if (phase === "setup") {
    return (
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <p className="text-4xl">👤</p>
          <h2 className="mt-2 font-display text-2xl font-medium text-ink">Just Me</h2>
          <p className="mt-1 text-sm text-ink-soft">A little frame, just for you.</p>
        </div>

        <section className="flex flex-col gap-2">
          <Eyebrow>how many shots?</Eyebrow>
          <div className="grid grid-cols-2 gap-3">
            {([1, 4] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setShotCount(n)}
                aria-pressed={shotCount === n}
                className={cn(
                  "rounded-2xl border p-4 text-center transition",
                  shotCount === n
                    ? "border-accent-ink/60 bg-blush/30"
                    : "border-rule bg-paper hover:border-accent-ink/40",
                )}
              >
                <p className="font-display text-lg font-medium text-ink">
                  {n === 1 ? "Classic" : "4 Shot"}
                </p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {n === 1 ? "satu foto, satu frame" : "strip photobooth klasik"}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <Eyebrow>choose a frame</Eyebrow>
          <FramePicker value={frameId} onChange={setFrameId} bestFlameDay={bestFlameDay} />
        </section>

        {error ? <p role="alert" className="text-center text-sm text-danger">{error}</p> : null}

        <div className="flex items-center justify-center gap-3">
          <Button type="button" variant="ghost" onClick={onBack}>
            ← Back
          </Button>
          <Button type="button" onClick={() => setPhase("shoot")}>
            Step inside →
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "shoot") {
    return (
      <div className="flex flex-col gap-5">
        <CameraCapture
          key={photos.length}
          prompt={prompt}
          label={shotCount > 1 ? `Shot ${photos.length + 1} of ${shotCount}` : null}
          onKeep={keepPhoto}
        />

        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => setPrompt(randomSoloPrompt())}
            className="text-accent-ink hover:underline"
          >
            🎲 {prompt ? "Prompt lain" : "Kasih pose prompt"}
          </button>
          {prompt ? (
            <button type="button" onClick={() => setPrompt(null)} className="text-ink-faint hover:underline">
              Skip →
            </button>
          ) : null}
        </div>

        {photos.length > 0 ? (
          <div className="flex justify-center gap-2">
            {photos.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={p} alt="" className="h-14 w-14 rounded-lg border border-rule object-cover" />
            ))}
          </div>
        ) : null}

        <div className="text-center">
          <button type="button" onClick={restart} className="text-sm text-ink-faint hover:underline">
            ← mulai ulang
          </button>
        </div>
      </div>
    );
  }

  if (phase === "reveal") {
    return (
      <div className="flex flex-col items-center gap-5 py-10 text-center">
        <motion.p
          initial={reduce ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-4xl"
        >
          ✨
        </motion.p>
        <p className="font-display text-2xl font-medium text-ink">
          Your photos are ready.
        </p>
        <Button type="button" onClick={() => setPhase("result")}>
          Show me
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {strip ? (
        <motion.div
          initial={reduce ? false : { y: -70, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 90, damping: 16 }}
          className="w-full max-w-xs"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={strip.url}
            alt="Hasil photobooth"
            className="w-full rounded-2xl border border-rule shadow-[var(--shadow-soft)]"
          />
        </motion.div>
      ) : null}

      {strip ? (
        <BoothResultActions
          blob={strip.blob}
          filename={`a-little-photobooth-${dateISO}.png`}
          albumTitle={SOLO_ALBUM_TITLE}
          spaceId={spaceId}
          userId={userId}
        />
      ) : null}

      <div className="flex items-center gap-4 text-sm">
        <button type="button" onClick={restart} className="text-ink-faint hover:underline">
          ↻ Retake
        </button>
        <button type="button" onClick={onBack} className="text-ink-faint hover:underline">
          ← Photobooth
        </button>
      </div>
    </div>
  );
}
