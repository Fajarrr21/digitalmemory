"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Flame } from "@/components/flame/flame";
import { MILESTONES, type Milestone } from "@/app/(app)/flame/flame-config";
import { shareFlameCard } from "@/app/(app)/flame/share-flame-card";

const KEY = (day: number) => `flame:celebrated:${day}`;

/**
 * The milestone popup: when the streak has passed a milestone this device
 * hasn't celebrated yet, opening the app shows one warm full-screen moment —
 * the flame, DAY N, both photos, the milestone's line, and a manual Share.
 * Shown once per milestone per device (localStorage), never stacked: only the
 * highest un-celebrated one appears, then everything below it is marked seen.
 */
export function MilestoneCelebration({
  streak,
  youName,
  partnerName,
  youAvatarUrl,
  partnerAvatarUrl,
}: {
  streak: number;
  youName: string;
  partnerName: string;
  youAvatarUrl: string | null;
  partnerAvatarUrl: string | null;
}) {
  const reduce = useReducedMotion();
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (streak <= 0) return;
    try {
      const fresh = MILESTONES.filter(
        (m) => m.day <= streak && localStorage.getItem(KEY(m.day)) !== "1",
      );
      if (fresh.length > 0) setMilestone(fresh[fresh.length - 1]);
    } catch {
      // no storage → no popup, never an error
    }
  }, [streak]);

  function close() {
    try {
      for (const m of MILESTONES) {
        if (m.day <= streak) localStorage.setItem(KEY(m.day), "1");
      }
    } catch {
      // fine
    }
    setMilestone(null);
  }

  async function share() {
    if (!milestone) return;
    setBusy(true);
    setNote(null);
    try {
      const outcome = await shareFlameCard({
        milestone,
        youName,
        partnerName,
        youAvatarUrl,
        partnerAvatarUrl,
      });
      if (outcome === "downloaded") setNote("Tersimpan ✓ tinggal upload ke story ♡");
    } catch {
      setNote("Gagal menyiapkan kartunya.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {milestone ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-5"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          role="dialog"
          aria-modal="true"
          aria-label={`Milestone day ${milestone.day}`}
        >
          {/* warm night backdrop */}
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: "rgba(24, 13, 16, 0.82)" }}
            onClick={close}
          />

          <motion.div
            className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-[#5a3a35] px-6 py-9 text-center"
            style={{ background: "linear-gradient(180deg, #2b181a 0%, #211316 100%)" }}
            initial={reduce ? false : { opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* floating embers */}
            {!reduce
              ? [14, 82, 30, 66].map((left, i) => (
                  <motion.span
                    key={left}
                    aria-hidden
                    className="absolute bottom-10 h-1.5 w-1.5 rounded-full"
                    style={{ left: `${left}%`, background: "#ffab5c" }}
                    animate={{ y: [0, -180], opacity: [0, 0.8, 0] }}
                    transition={{ duration: 3 + i * 0.6, delay: i * 0.7, repeat: Infinity, ease: "easeOut" }}
                  />
                ))
              : null}

            <Flame streak={milestone.day} size={110} />

            <motion.p
              className="mt-3 font-display text-4xl font-medium"
              style={{ color: "#fdf3e3" }}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : 0.35, duration: 0.6 }}
            >
              DAY {milestone.day}
            </motion.p>
            <p className="font-mono text-xs tracking-widest uppercase" style={{ color: "#c8a08a" }}>
              {milestone.title}
            </p>

            {/* the two of you */}
            <motion.div
              className="mt-5 flex items-center justify-center gap-4"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : 0.55, duration: 0.6 }}
            >
              <CelebAvatar url={youAvatarUrl} name={youName} />
              <span className="font-display text-xl" style={{ color: "#c8a08a" }}>
                ×
              </span>
              <CelebAvatar url={partnerAvatarUrl} name={partnerName} />
            </motion.div>
            <p className="mt-2 font-mono text-sm" style={{ color: "#e9d7c3" }}>
              {youName} × {partnerName}
            </p>

            <motion.p
              className="mt-4 font-hand text-2xl leading-snug"
              style={{ color: "#f2cfae" }}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: reduce ? 0 : 0.8, duration: 0.7 }}
            >
              “{milestone.line}”
            </motion.p>

            {note ? (
              <p className="mt-3 text-xs" style={{ color: "#c8a08a" }}>
                {note}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col items-center gap-2">
              <Button type="button" onClick={share} disabled={busy}>
                {busy ? "Menyiapkan…" : "📤 Share ke story"}
              </Button>
              <button
                type="button"
                onClick={close}
                className="text-sm transition hover:opacity-80"
                style={{ color: "#c8a08a" }}
              >
                Tutup ♡
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function CelebAvatar({ url, name }: { url: string | null; name: string }) {
  return (
    <span
      className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2"
      style={{ borderColor: "#ffab5c88", background: "#3a2226" }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="font-display text-3xl" style={{ color: "#f4b6bd" }}>
          {(name.trim()[0] ?? "♡").toUpperCase()}
        </span>
      )}
    </span>
  );
}
