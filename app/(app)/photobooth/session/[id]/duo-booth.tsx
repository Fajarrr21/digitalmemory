"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { PaperCard } from "@/components/ui/paper-card";
import { cn } from "@/lib/utils";
import { BoothStage } from "../../booth-stage";
import { BoothResultActions } from "../../booth-result";
import { composeBoothImage } from "../../compose-strip";
import {
  BOOTH_POLL_MS,
  DUO_ALBUM_TITLE,
  DUO_SHOT_PROMPTS,
  DUO_TEMPLATES,
  mySlots,
  slotOwnerIsCreator,
  templateById,
} from "../../photobooth-config";
import {
  clearBoothPhoto,
  completeBooth,
  getBoothState,
  joinBoothSession,
  saveBoothPhoto,
  setBoothTemplate,
  startBoothShooting,
  type BoothSnapshot,
} from "../../actions";

/**
 * ♡ Both of Us — a remote photobooth. Each person shoots on their own camera
 * into their own windows of ONE shared frame (slots alternate top→bottom);
 * the session syncs by polling. Partner photos stay hidden (🤫) until the
 * shared reveal, so the finished strip is a little surprise for both.
 */
export function DuoBooth({
  initial,
  spaceId,
  selfId,
  dateISO,
}: {
  initial: BoothSnapshot;
  spaceId: string;
  selfId: string;
  dateISO: string;
}) {
  const reduce = useReducedMotion();
  const [snap, setSnap] = useState<BoothSnapshot>(initial);
  const [localShots, setLocalShots] = useState<Record<number, string>>({});
  const [retakeSlot, setRetakeSlot] = useState<number | null>(null);
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [strip, setStrip] = useState<{ blob: Blob; url: string } | null>(null);
  const composing = useRef(false);

  const template = templateById(snap.frameId);
  const isCreator = snap.creatorId === selfId;
  const otherName = isCreator ? (snap.participantName ?? "Dia") : snap.creatorName;

  const myIdx = mySlots(template, isCreator);
  const theirIdx = mySlots(template, !isCreator);
  const photoAt = (i: number) =>
    snap.photos.find((p) => p.shotIndex === i && (slotOwnerIsCreator(i) ? p.userId === snap.creatorId : p.userId !== snap.creatorId));
  const mineDone = myIdx.filter((i) => photoAt(i) || localShots[i]);
  const theirsDone = theirIdx.filter((i) => photoAt(i));
  const allDone = mineDone.length >= myIdx.length && theirsDone.length >= theirIdx.length;

  // ---- polling ---------------------------------------------------------------
  const refresh = useCallback(async () => {
    const res = await getBoothState(snap.id);
    if (res.ok && res.session) setSnap(res.session);
  }, [snap.id]);

  useEffect(() => {
    if (snap.status === "completed" && strip) return; // nothing left to sync
    const t = setInterval(() => void refresh(), BOOTH_POLL_MS);
    return () => clearInterval(t);
  }, [refresh, snap.status, strip]);

  // ---- compose on completion ---------------------------------------------------
  useEffect(() => {
    if (snap.status !== "completed" || strip || composing.current) return;
    const photos: Record<number, string> = {};
    for (let i = 0; i < template.slots.length; i++) {
      const url = snap.photos.find((p) => p.shotIndex === i)?.url;
      if (!url) return; // wait for the next poll to sign everything
      photos[i] = url;
    }
    composing.current = true;
    void (async () => {
      try {
        const blob = await composeBoothImage({ template, photos });
        setStrip({ blob, url: URL.createObjectURL(blob) });
      } catch {
        setError("Gagal menyusun stripnya. Muat ulang halaman ini ya.");
      } finally {
        composing.current = false;
      }
    })();
  }, [snap, strip, template]);

  // ---- actions -------------------------------------------------------------------
  function run(fn: () => Promise<{ ok?: boolean; error?: string }>) {
    startBusy(async () => {
      setError(null);
      const res = await fn();
      if (res.error) setError(res.error);
      await refresh();
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Gagal menyalin — salin dari address bar ya.");
    }
  }

  async function keepPhoto(slot: number, blob: Blob, dataUrl: string) {
    const path = `${spaceId}/${selfId}/photobooth/${snap.id}/shot-${slot}-${crypto.randomUUID()}.jpg`;
    const { error: upErr } = await createClient()
      .storage.from("media")
      .upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (upErr) {
      setError("Gagal mengunggah fotonya. Coba lagi ya. ♡");
      return;
    }
    const res = await saveBoothPhoto(snap.id, slot, path);
    if (res.error) {
      setError(res.error);
      return;
    }
    setLocalShots((p) => ({ ...p, [slot]: dataUrl }));
    setRetakeSlot(null);
    setError(null);
    await refresh();
  }

  function retake(slot: number) {
    if (!myIdx.includes(slot)) return;
    setLocalShots((p) => {
      const n = { ...p };
      delete n[slot];
      return n;
    });
    setRetakeSlot(slot);
    run(() => clearBoothPhoto(snap.id, slot));
  }

  // Photos visible to ME on the stage: my own (local first, then signed).
  const stagePhotos: Record<number, string> = {};
  for (const i of myIdx) {
    const src = localShots[i] ?? photoAt(i)?.url ?? null;
    if (src) stagePhotos[i] = src;
  }

  // ---- phases ---------------------------------------------------------------------

  if (snap.expired) {
    return (
      <BoothShell>
        <p className="text-3xl">🌙</p>
        <p className="mt-3 font-display text-xl font-medium text-ink">
          This little booth has closed.
        </p>
        <p className="mt-1 text-sm text-ink-soft">Undangannya tidak sempat terpakai — tidak apa-apa.</p>
        <Link href="/photobooth" className="mt-4 inline-block text-sm text-accent-ink hover:underline">
          Buka photobooth baru →
        </Link>
      </BoothShell>
    );
  }

  if (snap.status === "waiting" && !isCreator) {
    return (
      <BoothShell>
        <p className="text-4xl">♡</p>
        <p className="mt-3 font-display text-2xl font-medium text-ink text-balance">
          {snap.creatorName} invited you to a photobooth.
        </p>
        <p className="mt-2 text-sm text-ink-soft">One little frame, the two of you.</p>
        {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-6">
          <Button type="button" onClick={() => run(() => joinBoothSession(snap.id))} disabled={busy}>
            {busy ? "Masuk…" : "Join"}
          </Button>
        </div>
      </BoothShell>
    );
  }

  if (snap.status === "waiting") {
    return (
      <BoothShell>
        <p className="text-4xl">📸</p>
        <p className="mt-3 font-display text-2xl font-medium text-ink">Your photobooth is ready</p>
        <p className="mt-2 text-sm text-ink-soft">
          Waiting for someone to join
          <WaitingDots />
        </p>
        {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-6 flex flex-col items-center gap-2">
          <Button type="button" onClick={copyLink}>
            {copied ? "Copied ♡" : "Copy Invite Link"}
          </Button>
          <p className="text-xs text-ink-faint">Share this link with your person. ♡</p>
        </div>
      </BoothShell>
    );
  }

  if (snap.status === "joined") {
    // Lobby: both here — pick the shared frame with the camera already live.
    return (
      <div className="flex flex-col gap-4">
        <div className="text-center">
          <p className="font-display text-2xl font-medium text-ink">You&apos;re both here ♡</p>
          <div className="mt-2 flex items-center justify-center gap-3 text-sm">
            <NameChip name={snap.creatorName} />
            <NameChip name={snap.participantName ?? "…"} />
          </div>
          <p className="mt-2 font-hand text-lg text-accent-ink">
            Pilih frame bersama — kotak yang kosong nanti diisi {otherName}.
          </p>
        </div>

        <BoothStage
          template={template}
          templates={DUO_TEMPLATES}
          onTemplateChange={(id) => {
            setSnap((s) => ({ ...s, frameId: id }));
            run(() => setBoothTemplate(snap.id, id));
          }}
          photos={{}}
          placeholderSlots={theirIdx}
          currentSlot={myIdx[0] ?? null}
          previewOnly
          onKeep={() => undefined}
          footer={
            <div className="flex flex-col items-center gap-2">
              {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
              <Button type="button" onClick={() => run(() => startBoothShooting(snap.id))} disabled={busy}>
                Now let&apos;s make a memory →
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  if (snap.status === "shooting") {
    const firstEmpty = myIdx.find((i) => !stagePhotos[i]);
    const currentSlot = retakeSlot ?? (firstEmpty === undefined ? null : firstEmpty);
    const myOrder = currentSlot !== null ? myIdx.indexOf(currentSlot) : -1;
    const prompt =
      currentSlot !== null ? DUO_SHOT_PROMPTS[myOrder % DUO_SHOT_PROMPTS.length] : null;

    return (
      <div className="flex flex-col gap-4">
        <div className="text-center">
          <p className="font-mono text-xs tracking-wide text-ink-faint">
            ♡ BOTH OF US · kamu {mineDone.length}/{myIdx.length} · {otherName}{" "}
            {theirsDone.length}/{theirIdx.length}
          </p>
        </div>

        <BoothStage
          template={template}
          photos={stagePhotos}
          placeholderSlots={theirIdx.filter((i) => !theirsDone.includes(i))}
          placeholderDone={theirsDone}
          currentSlot={currentSlot}
          cameraOff={currentSlot === null}
          prompt={prompt}
          onKeep={keepPhoto}
          onRetakeSlot={retake}
          footer={
            <div className="flex flex-col items-center gap-2 text-center">
              {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
              {currentSlot === null ? (
                allDone ? (
                  <>
                    <motion.p
                      initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-2xl"
                    >
                      ✨
                    </motion.p>
                    <p className="font-display text-lg font-medium text-ink">Your photos are ready.</p>
                    <Button type="button" onClick={() => run(() => completeBooth(snap.id))} disabled={busy}>
                      Show me
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-ink-soft">
                      Punyamu lengkap ✓ — tinggal menunggu {otherName}
                      <WaitingDots />
                    </p>
                    <p className="text-xs text-ink-faint">
                      Fotonya dia tetap rahasia sampai reveal 🤫 · tap fotomu untuk mengulang
                    </p>
                  </>
                )
              ) : (
                <p className="text-xs text-ink-faint">Kotak 🤫 dan ♡ diisi {otherName} dari HP-nya sendiri.</p>
              )}
            </div>
          }
        />
      </div>
    );
  }

  // ---- completed: the reveal --------------------------------------------------
  return (
    <div className="flex flex-col items-center gap-6">
      {strip ? (
        <>
          <motion.div
            initial={reduce ? false : { y: -90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 80, damping: 15 }}
            className="w-full max-w-xs"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={strip.url}
              alt="Hasil photobooth berdua"
              className="w-full rounded-2xl border border-rule shadow-[var(--shadow-soft)]"
            />
          </motion.div>

          <p className="text-center font-hand text-xl text-accent-ink">
            {snap.creatorName} × {snap.participantName ?? "Dia"} ♡
          </p>

          <BoothResultActions
            blob={strip.blob}
            filename={`our-little-photobooth-${dateISO}.png`}
            albumTitle={DUO_ALBUM_TITLE}
            spaceId={spaceId}
            userId={selfId}
          />

          <Link href="/photobooth" className="text-sm text-ink-faint hover:underline">
            ← Photobooth
          </Link>
        </>
      ) : (
        <BoothShell>
          <p className="text-3xl">✨</p>
          <p className="mt-3 font-display text-xl font-medium text-ink">Menyusun strip kalian…</p>
          {error ? <p role="alert" className="mt-2 text-sm text-danger">{error}</p> : null}
        </BoothShell>
      )}
    </div>
  );
}

// ---- little pieces ------------------------------------------------------------

function BoothShell({ children }: { children: React.ReactNode }) {
  return (
    <PaperCard lift className="bg-gradient-to-br from-blush/30 to-paper py-10 text-center">
      {children}
    </PaperCard>
  );
}

function NameChip({ name }: { name: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1",
        "border-accent-ink/40 bg-blush/30 text-accent-ink",
      )}
    >
      {name} ✓
    </span>
  );
}

function WaitingDots() {
  return (
    <span aria-hidden className="inline-flex w-5">
      <motion.span animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.6, repeat: Infinity }}>
        …
      </motion.span>
    </span>
  );
}
