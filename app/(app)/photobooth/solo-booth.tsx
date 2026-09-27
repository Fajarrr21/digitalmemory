"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { BoothStage } from "./booth-stage";
import { BoothResultActions } from "./booth-result";
import { composeBoothImage } from "./compose-strip";
import {
  BOOTH_TEMPLATES,
  randomSoloPrompt,
  SOLO_ALBUM_TITLE,
  templateById,
} from "./photobooth-config";

type Phase = "shoot" | "reveal" | "result";

/**
 * 👤 Just Me — straight into the booth: the camera is live inside the chosen
 * frame, the carousel swaps frames on the fly, and every window is shot in
 * turn. Fully client-side; nothing touches the database until "♡ Save".
 */
export function SoloBooth({
  spaceId,
  userId,
  dateISO,
  initialFrameId,
  onBack,
}: {
  spaceId: string;
  userId: string;
  dateISO: string;
  initialFrameId: string | null;
  onBack: () => void;
}) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("shoot");
  const [templateId, setTemplateId] = useState(templateById(initialFrameId).id);
  const [photos, setPhotos] = useState<Record<number, string>>({});
  const [retakeSlot, setRetakeSlot] = useState<number | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [strip, setStrip] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  const template = templateById(templateId);
  const total = template.slots.length;
  const firstEmpty = template.slots.findIndex((_, i) => !photos[i]);
  const currentSlot = retakeSlot ?? (firstEmpty === -1 ? null : firstEmpty);
  const allFilled = firstEmpty === -1 && retakeSlot === null;

  function switchTemplate(id: string) {
    if (id === templateId) return;
    setTemplateId(id);
    setPhotos({}); // window layouts differ — start the strip fresh
    setRetakeSlot(null);
  }

  function keepPhoto(slot: number, _blob: Blob, dataUrl: string) {
    setPhotos((p) => ({ ...p, [slot]: dataUrl }));
    setRetakeSlot(null);
    setPrompt(null);
  }

  async function finish() {
    setComposing(true);
    setError(null);
    try {
      const blob = await composeBoothImage({ template, photos });
      setStrip({ blob, url: URL.createObjectURL(blob) });
      setPhase("reveal");
    } catch {
      setError("Gagal menyusun stripnya. Coba lagi ya. ♡");
    } finally {
      setComposing(false);
    }
  }

  function backToBooth() {
    if (strip) URL.revokeObjectURL(strip.url);
    setStrip(null);
    setPhase("shoot");
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
        <p className="font-display text-2xl font-medium text-ink">Your photos are ready.</p>
        <Button type="button" onClick={() => setPhase("result")}>
          Show me
        </Button>
      </div>
    );
  }

  if (phase === "result" && strip) {
    return (
      <div className="flex flex-col items-center gap-6">
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

        <BoothResultActions
          blob={strip.blob}
          filename={`a-little-photobooth-${dateISO}.png`}
          albumTitle={SOLO_ALBUM_TITLE}
          spaceId={spaceId}
          userId={userId}
        />

        <div className="flex items-center gap-4 text-sm">
          <button type="button" onClick={backToBooth} className="text-ink-faint hover:underline">
            ↻ Retake
          </button>
          <button type="button" onClick={onBack} className="text-ink-faint hover:underline">
            ← Photobooth
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <p className="font-mono text-xs tracking-wide text-ink-faint">
          👤 JUST ME ·{" "}
          {allFilled ? "semua foto sudah ada ✓" : `foto ${Math.min(Object.keys(photos).length + 1, total)} dari ${total}`}
        </p>
      </div>

      <BoothStage
        template={template}
        templates={BOOTH_TEMPLATES}
        onTemplateChange={switchTemplate}
        photos={photos}
        currentSlot={currentSlot}
        prompt={prompt}
        onKeep={keepPhoto}
        onRetakeSlot={(i) => setRetakeSlot(i)}
        footer={
          <div className="flex flex-col items-center gap-2">
            {!allFilled ? (
              <div className="flex items-center gap-3 text-sm">
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
            ) : (
              <>
                <p className="text-sm text-ink-soft">Tap foto mana pun untuk mengulanginya. ♡</p>
                <Button type="button" onClick={finish} disabled={composing}>
                  {composing ? "Menyusun…" : "✨ Jadikan strip"}
                </Button>
              </>
            )}
            {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          </div>
        }
      />

      <div className="text-center">
        <button type="button" onClick={onBack} className="text-sm text-ink-faint hover:underline">
          ← Photobooth
        </button>
      </div>
    </div>
  );
}
