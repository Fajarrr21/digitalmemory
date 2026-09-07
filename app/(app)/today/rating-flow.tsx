"use client";

import { useActionState, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { extFromMime } from "@/lib/media-config";
import { VoiceRecorder, type VoiceState } from "@/components/media/voice-recorder";
import { saveRating, type RatingState } from "./actions";
import { MOODS, bandLabel, encouragementFor, promptFor, type Mood } from "./rating-config";

type Existing = {
  score: number;
  mood: string | null;
  reason: string | null;
  note: string | null;
} | null;

const fieldClass =
  "w-full rounded-xl border border-rule bg-ground px-3.5 py-2.5 text-ink placeholder:text-ink-faint outline-none transition focus:border-accent-ink/50";

export function RatingFlow({
  existing,
  seed,
  spaceId,
  userId,
  existingVoiceUrl = null,
}: {
  existing: Existing;
  seed: string;
  spaceId: string;
  userId: string;
  existingVoiceUrl?: string | null;
}) {
  const reduce = useReducedMotion();
  const [score, setScore] = useState<number | null>(existing?.score ?? null);
  const [mood, setMood] = useState<Mood | "">((existing?.mood as Mood) ?? "");
  const [voice, setVoice] = useState<VoiceState>({ kind: "unchanged" });
  const [uploading, setUploading] = useState(false);
  const [voiceErr, setVoiceErr] = useState<string | null>(null);
  const [state, action, pending] = useActionState<RatingState, FormData>(saveRating, {});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setVoiceErr(null);
    try {
      if (voice.kind === "new") {
        setUploading(true);
        const supabase = createClient();
        const path = `${spaceId}/${userId}/rating/${crypto.randomUUID()}.${extFromMime(voice.mime)}`;
        const { error } = await supabase.storage
          .from("media")
          .upload(path, voice.blob, { contentType: voice.mime, upsert: false });
        setUploading(false);
        if (error) {
          setVoiceErr("Voice-nya gagal diunggah. Coba lagi ya. ♡");
          return;
        }
        fd.set("voice_path", path);
        fd.set("voice_mime", voice.mime);
        fd.set("voice_duration", String(voice.durationSec));
        fd.set("voice_size", String(voice.blob.size));
      } else if (voice.kind === "removed") {
        fd.set("voice_clear", "1");
      }
      action(fd);
    } catch {
      setUploading(false);
      setVoiceErr("Voice-nya gagal diunggah. Coba lagi ya. ♡");
    }
  }

  // The score that's actually been saved (fresh save wins over loaded value).
  const savedScore = state.ok ? score : existing?.score ?? null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <input type="hidden" name="score" value={score ?? ""} />
      <input type="hidden" name="mood" value={mood} />

      {savedScore !== null ? (
        <motion.div
          key={`${savedScore}-${state.ok ? "saved" : "loaded"}`}
          className="rounded-2xl border border-accent/40 bg-blush/40 px-5 py-4"
          initial={reduce ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <p className="font-display text-[1.05rem] leading-relaxed text-ink text-balance">
            {encouragementFor(savedScore, seed)}
          </p>
        </motion.div>
      ) : null}

      {/* 1–10 scale */}
      <div>
        <p className="mb-3 text-sm text-ink-soft">Dari 1 sampai 10, hari ini berapa?</p>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            const active = score === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setScore(n)}
                aria-pressed={active}
                className={cn(
                  "aspect-square rounded-xl border text-[15px] font-medium transition",
                  active
                    ? "border-accent bg-accent text-[#4a2b30] shadow-[var(--shadow-lift)]"
                    : "border-rule bg-paper text-ink-soft hover:border-accent-ink/40 hover:text-ink",
                )}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {score !== null ? (
          <motion.div
            key="rest"
            className="flex flex-col gap-6"
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div>
              <p className="font-display text-lg font-medium text-ink">{bandLabel(score)}</p>
              <p className="mt-0.5 text-ink-soft">{promptFor(score)}</p>
            </div>

            {/* mood */}
            <div>
              <p className="mb-2 text-sm text-ink-soft">Perasaanmu? <span className="text-ink-faint">(boleh dilewati)</span></p>
              <div className="flex flex-wrap gap-2">
                {MOODS.map((m) => {
                  const active = mood === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMood(active ? "" : m)}
                      aria-pressed={active}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-sm transition",
                        active
                          ? "border-accent bg-blush/50 text-accent-ink"
                          : "border-rule text-ink-soft hover:border-accent-ink/40",
                      )}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* reason */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reason" className="text-sm text-ink-soft">
                Ceritanya…
              </label>
              <textarea
                id="reason"
                name="reason"
                rows={3}
                defaultValue={existing?.reason ?? ""}
                className={`${fieldClass} resize-y leading-relaxed`}
                placeholder="Apa yang terjadi hari ini?"
              />
            </div>

            {/* note */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="note" className="text-sm text-ink-soft">
                Catatan kecil <span className="text-ink-faint">(opsional)</span>
              </label>
              <input
                id="note"
                name="note"
                defaultValue={existing?.note ?? ""}
                className={fieldClass}
                placeholder="—"
                maxLength={2000}
              />
            </div>

            {/* voice note */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-ink-soft">
                Cerita lewat suara <span className="text-ink-faint">(opsional — males ngetik? rekam aja)</span>
              </label>
              <VoiceRecorder
                existingUrl={existingVoiceUrl}
                onChange={setVoice}
                disabled={pending || uploading}
              />
              {voiceErr ? <p role="alert" className="text-sm text-danger">{voiceErr}</p> : null}
            </div>

            {state.error ? (
              <p role="alert" className="text-sm text-danger">{state.error}</p>
            ) : null}
            {state.ok ? (
              <p className="text-sm text-accent-ink">Tersimpan ✓</p>
            ) : null}

            <Button type="submit" size="lg" disabled={pending || uploading || score === null} className="self-start">
              {uploading ? "Mengunggah suara…" : pending ? "Menyimpan…" : existing ? "Perbarui hari ini" : "Simpan hari ini"}
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </form>
  );
}
