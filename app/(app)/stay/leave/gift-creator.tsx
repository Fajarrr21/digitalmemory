"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { StayGiftKind, StayObjectKind } from "@/lib/supabase/database.types";
import type { StayGift } from "@/lib/stay/queries";
import { LIMITS, giftProblem } from "@/lib/stay/logic";
import { extFromMime, MAX_AUDIO_BYTES } from "@/lib/media-config";
import { createClient } from "@/lib/supabase/client";
import { GiftArt } from "@/components/stay/gift-art";
import { VoiceRecorder, type VoiceState } from "@/components/media/voice-recorder";
import { VoicePlayer } from "@/components/stay/voice-player";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { discardUpload, editGift, leaveGift, takeBackGift } from "../actions";
import { useStayChannel } from "../use-stay-channel";
import { GIFT_KIND, OBJECTS, objectName } from "../stay-config";

/**
 * "I left this for you." — preparing a little gift for the other's room.
 *
 * Feels like wrapping something, not filling in a form: pick what kind of
 * gift, make it, see it as they will, leave it. Words are drafted in
 * localStorage so nothing written is ever lost to a refresh; a recording is
 * guarded by a "leave the page?" prompt until it's sent or thrown away.
 */

type Draft = { note: string; comfort: string; objectLine: string; voiceLine: string; objectKind: StayObjectKind };
const STORE = "stay:draft";
const EMPTY: Draft = { note: "", comfort: "", objectLine: "", voiceLine: "", objectKind: "flower" };

const ORDER: StayGiftKind[] = ["note", "voice", "object", "comfort"];

export function GiftCreator({
  spaceId,
  selfId,
  partnerName,
  initialKind,
  sent,
}: {
  spaceId: string;
  selfId: string;
  partnerName: string;
  initialKind: StayGiftKind | null;
  sent: StayGift[];
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [kind, setKind] = useState<StayGiftKind | null>(initialKind);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [voice, setVoice] = useState<VoiceState>({ kind: "unchanged" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<StayGiftKind | null>(null);
  const [pending, start] = useTransition();
  const [recorderKey, setRecorderKey] = useState(0);
  const { send } = useStayChannel({ spaceId, selfId, track: false });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setDraft({ ...EMPTY, ...(JSON.parse(raw) as Partial<Draft>) });
    } catch {
      /* blocked storage — start empty */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(draft));
    } catch {
      /* fine — the draft just won't survive a reload */
    }
  }, [draft]);

  // A recording that hasn't been sent is never thrown away silently.
  const hasUnsentVoice = voice.kind === "new";
  useEffect(() => {
    if (!hasUnsentVoice) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsentVoice]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const problem = !kind
    ? "empty"
    : kind === "note"
      ? giftProblem({ kind, body: draft.note })
      : kind === "comfort"
        ? giftProblem({ kind, body: draft.comfort })
        : kind === "object"
          ? giftProblem({ kind, objectKind: draft.objectKind, body: draft.objectLine })
          : giftProblem({ kind, body: draft.voiceLine, seconds: voice.kind === "new" ? voice.durationSec : 0 });

  function leave() {
    if (!kind || problem || pending) return;
    setError(null);
    start(async () => {
      let uploaded: string | null = null;
      try {
        let res;
        if (kind === "voice") {
          if (voice.kind !== "new") return;
          if (voice.blob.size > MAX_AUDIO_BYTES) {
            setError("Rekamannya terlalu besar. Coba yang lebih singkat ya.");
            return;
          }
          const supabase = createClient();
          const path = `${spaceId}/${selfId}/stay/${crypto.randomUUID()}.${extFromMime(voice.mime)}`;
          const { error: upErr } = await supabase.storage
            .from("media")
            .upload(path, voice.blob, { contentType: voice.mime, upsert: false });
          if (upErr) {
            setError("Suaranya gagal diunggah. Rekamannya masih ada — coba kirim lagi ya. ♡");
            return;
          }
          uploaded = path;
          res = await leaveGift({
            kind: "voice",
            body: draft.voiceLine,
            audioPath: path,
            audioMime: voice.mime,
            seconds: Math.min(300, Math.max(1, voice.durationSec)),
          });
        } else if (kind === "note") res = await leaveGift({ kind, body: draft.note });
        else if (kind === "comfort") res = await leaveGift({ kind, body: draft.comfort });
        else res = await leaveGift({ kind: "object", objectKind: draft.objectKind, body: draft.objectLine });

        if (!res.ok) {
          if (uploaded) void discardUpload(uploaded);
          setError(res.error ?? "Ada yang tersendat. Coba lagi ya. ♡");
          return;
        }
        // Clear only what was sent; other drafts stay.
        if (kind === "note") set({ note: "" });
        if (kind === "comfort") set({ comfort: "" });
        if (kind === "object") set({ objectLine: "" });
        if (kind === "voice") {
          set({ voiceLine: "" });
          setVoice({ kind: "unchanged" });
          setRecorderKey((k) => k + 1);
        }
        send({ type: "gift", by: selfId });
        setDone(kind);
        setKind(null);
        router.refresh();
      } catch {
        if (uploaded) void discardUpload(uploaded);
        setError("Koneksinya terputus. Yang kamu tulis masih di sini — coba lagi ya. ♡");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link href="/stay" className="text-sm text-ink-faint hover:text-ink-soft">
          ← kamarku
        </Link>
        <p className="font-display text-sm italic text-ink-soft">i left this for you.</p>
      </div>

      <div>
        <p className="font-mono text-[11px] tracking-[0.18em] text-accent-ink uppercase">untuk kamar {partnerName}</p>
        <h1 className="mt-1.5 font-display text-2xl font-medium text-ink text-balance md:text-3xl">
          Tinggalkan sesuatu di samping kasurnya.
        </h1>
        <p className="mt-1 text-[15px] text-ink-soft">
          Dia akan menemukannya saat masuk ke kamarnya — kapan pun itu. Nggak perlu dibalas.
        </p>
      </div>

      <AnimatePresence>
        {done ? (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="status"
            className="flex items-center gap-4 rounded-2xl border border-accent/40 bg-blush/35 px-5 py-4"
          >
            <GiftArt kind={done} objectKind={done === "object" ? draft.objectKind : null} className="h-12 w-12 flex-none" />
            <div>
              <p className="font-hand text-2xl text-accent-ink">left on the bedside table ♡</p>
              <p className="text-sm text-ink-soft">{partnerName} akan melihatnya saat masuk ke kamarnya.</p>
            </div>
            <button type="button" onClick={() => setDone(null)} aria-label="Tutup" className="ml-auto text-ink-faint hover:text-ink-soft">
              ✕
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* What to wrap */}
      <fieldset>
        <legend className="mb-3 text-sm text-ink-soft">Mau meninggalkan apa?</legend>
        <div className="grid grid-cols-2 gap-3">
          {ORDER.map((k) => (
            <label
              key={k}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border px-3 pt-4 pb-3 text-center transition",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink",
                kind === k ? "border-accent bg-blush/40" : "border-rule bg-paper hover:border-accent-ink/40",
              )}
            >
              <input
                type="radio"
                name="gift-kind"
                value={k}
                checked={kind === k}
                onChange={() => {
                  setKind(k);
                  setError(null);
                  setDone(null);
                }}
                className="sr-only"
              />
              <GiftArt kind={k} objectKind={k === "object" ? draft.objectKind : null} className="h-14 w-14" />
              <span className="text-[15px] font-medium text-ink">{GIFT_KIND[k].name}</span>
              <span className="text-xs text-ink-soft">{GIFT_KIND[k].line}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {kind ? (
        <motion.section
          key={kind}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4"
          aria-label={GIFT_KIND[kind].name}
        >
          {kind === "note" || kind === "comfort" ? (
            <div>
              <label htmlFor="stay-words" className="mb-2 block text-sm text-ink-soft">
                {kind === "note"
                  ? "Tulis seperti kamu menulis di kertas kecil. Pakai kata-katamu sendiri."
                  : `Ini kalimat terakhir yang dibisikkan kamar ke ${partnerName} di “you can rest here”. Pendek, pelan.`}
              </label>
              <div className="rounded-xl border border-[#e3cdb6] bg-[#fbf3e8] bg-[repeating-linear-gradient(transparent,transparent_31px,#eadccb_31px,#eadccb_32px)] px-5 pt-4 pb-3 shadow-[var(--shadow-lift)]">
                <textarea
                  id="stay-words"
                  value={kind === "note" ? draft.note : draft.comfort}
                  onChange={(e) =>
                    kind === "note"
                      ? set({ note: e.target.value.slice(0, LIMITS.note) })
                      : set({ comfort: e.target.value.slice(0, LIMITS.comfort) })
                  }
                  rows={kind === "note" ? 7 : 4}
                  placeholder={
                    kind === "note"
                      ? "hey, love…"
                      : "you don't have to be okay today. i'm still right here."
                  }
                  className="w-full resize-none bg-transparent font-hand text-[1.6rem] leading-[32px] text-[#4b3229] placeholder:text-[#b9a090] focus:outline-none"
                />
                <p className="text-right font-hand text-xl text-[#8a6b5e]">— kamu</p>
              </div>
              <p className="mt-1 text-right font-mono text-[11px] text-ink-faint">
                {(kind === "note" ? draft.note : draft.comfort).length}/{kind === "note" ? LIMITS.note : LIMITS.comfort}
              </p>
            </div>
          ) : null}

          {kind === "voice" ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-ink-soft">
                Mikrofon baru dinyalakan saat kamu menekan &ldquo;Rekam suara&rdquo;. Dengarkan dulu sebelum
                dikirim — boleh rekam ulang sebanyak yang kamu mau.
              </p>
              <VoiceRecorder key={recorderKey} onChange={setVoice} disabled={pending} />
              <label htmlFor="stay-voice-line" className="text-sm text-ink-soft">
                Sepatah kata di tokennya (opsional)
              </label>
              <input
                id="stay-voice-line"
                value={draft.voiceLine}
                onChange={(e) => set({ voiceLine: e.target.value.slice(0, LIMITS.line) })}
                placeholder="dengerin pas mau tidur ya"
                className="rounded-2xl border border-rule bg-paper px-4 py-2.5 text-[15px] text-ink placeholder:text-ink-faint focus:border-accent-ink/50 focus:outline-none"
              />
            </div>
          ) : null}

          {kind === "object" ? (
            <div className="flex flex-col gap-3">
              <fieldset>
                <legend className="mb-2 text-sm text-ink-soft">Pilih benda kecilnya</legend>
                <div className="grid grid-cols-5 gap-2">
                  {OBJECTS.map((o) => (
                    <label
                      key={o.key}
                      title={o.name}
                      className={cn(
                        "flex aspect-square cursor-pointer items-center justify-center rounded-2xl border transition",
                        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink",
                        draft.objectKind === o.key ? "border-accent bg-blush/40" : "border-rule bg-paper",
                      )}
                    >
                      <input
                        type="radio"
                        name="object-kind"
                        value={o.key}
                        checked={draft.objectKind === o.key}
                        onChange={() => set({ objectKind: o.key })}
                        className="sr-only"
                        aria-label={o.name}
                      />
                      <GiftArt kind="object" objectKind={o.key} className="h-10 w-10" />
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-center font-display text-ink">{objectName(draft.objectKind)}</p>
              </fieldset>
              <label htmlFor="stay-object-line" className="text-sm text-ink-soft">
                Satu kalimat kecil yang menempel (opsional)
              </label>
              <input
                id="stay-object-line"
                value={draft.objectLine}
                onChange={(e) => set({ objectLine: e.target.value.slice(0, LIMITS.line) })}
                placeholder="for your bedside. so it's not so empty."
                className="rounded-2xl border border-rule bg-paper px-4 py-2.5 text-[15px] text-ink placeholder:text-ink-faint focus:border-accent-ink/50 focus:outline-none"
              />
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-2xl border border-danger/40 px-4 py-3 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button size="lg" onClick={leave} disabled={!!problem || pending} aria-busy={pending}>
              {pending ? "Menaruh…" : `Taruh di kamar ${partnerName}`}
            </Button>
          </div>
        </motion.section>
      ) : null}

      <SentList gifts={sent} partnerName={partnerName} />
    </div>
  );
}

function SentList({ gifts, partnerName }: { gifts: StayGift[]; partnerName: string }) {
  if (!gifts.length) return null;
  return (
    <section aria-label={`Yang ada di kamar ${partnerName}`} className="flex flex-col gap-3 border-t border-rule-soft pt-6">
      <p className="font-mono text-[11px] tracking-[0.18em] text-ink-faint uppercase">sudah ada di kamar {partnerName}</p>
      <ul className="flex flex-col gap-2.5">
        {gifts.map((g) => (
          <SentItem key={g.id} gift={g} />
        ))}
      </ul>
    </section>
  );
}

function SentItem({ gift }: { gift: StayGift }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(gift.body ?? "");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const confirmRef = useRef<HTMLDivElement>(null);
  const limit = gift.kind === "note" ? LIMITS.note : gift.kind === "comfort" ? LIMITS.comfort : LIMITS.line;

  useEffect(() => {
    if (confirm) confirmRef.current?.focus();
  }, [confirm]);

  const status = gift.put_away_at
    ? "disimpan di kotak kecilnya"
    : gift.opened_at
      ? "sudah dibuka ♡"
      : "menunggu di meja";

  return (
    <li className="rounded-2xl border border-rule bg-paper px-4 py-3">
      <div className="flex items-center gap-3">
        <GiftArt kind={gift.kind} objectKind={gift.object_kind} className="h-10 w-10 flex-none" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] text-ink">
            {gift.kind === "object" ? objectName(gift.object_kind) : GIFT_KIND[gift.kind].name}
            {gift.body && !editing ? <span className="text-ink-soft"> — “{gift.body}”</span> : null}
          </p>
          <p className="font-mono text-[11px] text-ink-faint">
            {new Date(gift.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} · {status}
            {gift.edited_at ? " · diubah" : ""}
          </p>
        </div>
      </div>

      {gift.kind === "voice" && gift.audioUrl ? <VoicePlayer src={gift.audioUrl} knownSeconds={gift.audio_seconds} className="mt-3" /> : null}

      {editing ? (
        <div className="mt-3 flex flex-col gap-2">
          <label htmlFor={`edit-${gift.id}`} className="sr-only">
            Ubah kata-katanya
          </label>
          <textarea
            id={`edit-${gift.id}`}
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, limit))}
            rows={gift.kind === "note" ? 5 : 2}
            className="w-full resize-none rounded-xl border border-rule bg-ground px-3 py-2 font-hand text-xl text-ink focus:border-accent-ink/50 focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setBody(gift.body ?? ""); }} disabled={pending}>
              Batal
            </Button>
            <Button
              variant="soft"
              size="sm"
              disabled={pending || ((gift.kind === "note" || gift.kind === "comfort") && !body.trim())}
              onClick={() =>
                start(async () => {
                  setError(null);
                  try {
                    const r = await editGift({ id: gift.id, body });
                    if (r.ok) {
                      setEditing(false);
                      router.refresh();
                    } else setError(r.error ?? null);
                  } catch {
                    setError("Koneksinya terputus. Tulisanmu masih di sini — coba lagi ya.");
                  }
                })
              }
            >
              Simpan
            </Button>
          </div>
        </div>
      ) : null}

      {confirm ? (
        <div ref={confirmRef} tabIndex={-1} role="group" aria-label="Konfirmasi ambil kembali" className="mt-3 rounded-xl bg-paper-2 px-4 py-3 focus:outline-none">
          <p className="text-sm text-ink">Ambil kembali? Hadiah ini hilang dari kamarnya{gift.kind === "voice" ? ", rekamannya juga" : ""}.</p>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirm(false)} disabled={pending}>
              Batal
            </Button>
            <Button
              variant="soft"
              size="sm"
              className="text-danger"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  try {
                    const r = await takeBackGift(gift.id);
                    if (r.ok) router.refresh();
                    else setError(r.error ?? null);
                  } catch {
                    setError("Koneksinya terputus. Coba lagi ya.");
                  }
                })
              }
            >
              Ya, ambil kembali
            </Button>
          </div>
        </div>
      ) : null}

      {!editing && !confirm ? (
        <div className="mt-2 flex justify-end gap-1">
          {gift.kind !== "voice" ? (
            <button type="button" onClick={() => setEditing(true)} className="rounded-full px-3 py-1 text-sm text-ink-faint hover:text-accent-ink">
              ubah
            </button>
          ) : null}
          <button type="button" onClick={() => setConfirm(true)} className="rounded-full px-3 py-1 text-sm text-ink-faint hover:text-danger">
            ambil kembali
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </li>
  );
}
