"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { PaperCard } from "@/components/ui/paper-card";
import { Button } from "@/components/ui/button";
import { spotifyEmbedUrl } from "@/lib/spotify";
import { VoicePlayer } from "@/components/stay/voice-player";
import { DEFAULT_SURPRISE } from "./adore-config";
import { drawSurprise, markAdore, type DrawnSurprise } from "./actions";

type Shown = Pick<DrawnSurprise, "title" | "subtitle" | "body" | "song_track_id" | "photoUrl" | "audioUrl" | "audioSeconds"> & {
  id: string | null;
};

/**
 * One envelope: either the newest surprise he left (waiting), or whatever the
 * pool gives when she taps "I need a little love". Opening is gentle — a
 * lift, the flap, the words fading in — not a reward animation.
 */
export function SurpriseBox({ waiting, isKeeper }: { waiting: DrawnSurprise | null; isKeeper: boolean }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState<Shown | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [pendingWaiting, setPendingWaiting] = useState(waiting);

  function openWaiting() {
    if (!pendingWaiting) return;
    setShown(pendingWaiting);
    setLastId(pendingWaiting.id);
    if (isKeeper) start(() => void markAdore(pendingWaiting.id));
    setPendingWaiting(null);
  }

  function needLove() {
    start(async () => {
      const got = await drawSurprise(lastId);
      setShown(got ?? { id: null, ...DEFAULT_SURPRISE, subtitle: null, song_track_id: null, photoUrl: null, audioUrl: null, audioSeconds: null });
      if (got) setLastId(got.id);
    });
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <AnimatePresence mode="wait">
        {shown ? (
          <motion.div
            key={shown.id ?? "default"}
            className="w-full"
            initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <PaperCard lift className="px-6 py-8 sm:px-10">
              <p className="font-hand text-xl text-accent-ink">untukmu ♡</p>
              <h2 className="mt-2 font-display text-2xl font-medium text-ink text-balance">{shown.title}</h2>
              {shown.subtitle ? <p className="mt-1 text-ink-soft">{shown.subtitle}</p> : null}
              {shown.body ? (
                <motion.p
                  className="mt-5 whitespace-pre-line font-display text-[1.1rem] leading-[1.85] text-ink"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.8 }}
                >
                  {shown.body}
                </motion.p>
              ) : null}
              {shown.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                <img src={shown.photoUrl} alt="" className="mt-5 w-full rounded-2xl object-cover" />
              ) : null}
              {shown.audioUrl ? <VoicePlayer src={shown.audioUrl} knownSeconds={shown.audioSeconds} className="mt-5" /> : null}
              {shown.song_track_id ? (
                <iframe
                  title="Spotify"
                  src={spotifyEmbedUrl(shown.song_track_id)}
                  className="mt-5 h-20 w-full rounded-xl"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                />
              ) : null}
              <p className="mt-6 text-right font-hand text-xl text-accent-ink">— dari aku ♡</p>
            </PaperCard>
          </motion.div>
        ) : pendingWaiting ? (
          <motion.button
            key="envelope"
            type="button"
            onClick={openWaiting}
            className="group relative w-full max-w-sm"
            whileHover={reduce ? undefined : { y: -3 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.96 }}
          >
            <PaperCard lift className="relative overflow-hidden bg-gradient-to-br from-blush/60 to-paper py-10 text-center">
              <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-0 w-0 border-x-[9rem] border-t-[4.5rem] border-x-transparent border-t-blush/70" />
              <p className="relative mt-6 font-hand text-2xl text-accent-ink">psst… sayang</p>
              <p className="relative mt-1 font-display text-lg text-ink">Aku meninggalkan sesuatu untukmu.</p>
              <p className="relative mt-3 text-sm text-ink-soft">ketuk untuk membuka ♡</p>
            </PaperCard>
          </motion.button>
        ) : (
          <motion.div key="idle" className="text-center" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="font-hand text-2xl text-accent-ink">psst… sayang</p>
            <p className="mt-1 font-display text-lg text-ink">Ada sesuatu yang ingin kutunjukkan.</p>
          </motion.div>
        )}
      </AnimatePresence>

      <Button type="button" onClick={needLove} disabled={pending}>
        {pending ? "…" : shown ? "satu lagi? ♡" : "Aku butuh sedikit sayang ♡"}
      </Button>
      {!isKeeper ? <p className="text-xs text-ink-faint">Kamu bisa coba tombolnya — nggak ada yang ditandai dibuka.</p> : null}
    </div>
  );
}
