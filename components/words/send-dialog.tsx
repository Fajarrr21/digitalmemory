"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { OPEN_WHEN, WORDS_LIMITS } from "@/lib/words/options";
import type { OpenWhen } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { inputClass } from "./chips";
import { sendWork } from "@/app/(app)/words/actions";

/**
 * Give a work to the partner: a short intro, an optional "Open when…"
 * envelope, an optional date it unlocks. What's given is a snapshot — later
 * edits to the work never change it. Never guesses the recipient's mood:
 * "open when you miss me" is theirs to decide.
 */
export function SendDialog({
  workId,
  partnerName,
  partnerBirthday,
  today,
  replyTo,
  onClose,
  onSent,
}: {
  workId: string;
  partnerName: string;
  partnerBirthday: string | null;
  today: string;
  replyTo?: string | null;
  onClose: () => void;
  onSent?: (deliveryId: string) => void;
}) {
  const [intro, setIntro] = useState("");
  const [openWhen, setOpenWhen] = useState<OpenWhen | null>(null);
  const [customLabel, setCustomLabel] = useState("");
  const [scheduled, setScheduled] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("07:00");
  const [error, setError] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function pickOpenWhen(k: OpenWhen | null) {
    setOpenWhen(k);
    if (k === "birthday" && partnerBirthday) {
      setScheduled(true);
      setDate(partnerBirthday);
      setTime("00:00");
    }
  }

  function submit() {
    setError(null);
    if (scheduled && !date) {
      setError("Pilih tanggal kapan ini boleh dibuka.");
      return;
    }
    start(async () => {
      const res = await sendWork({
        workId,
        intro: intro.trim() || undefined,
        openWhen,
        openWhenLabel: openWhen === "custom" ? customLabel.trim() || null : null,
        unlockDate: scheduled ? date : null,
        unlockTime: scheduled ? time : null,
        replyTo: replyTo ?? null,
      });
      if (res.error || !res.id) setError(res.error ?? "Gagal mengirim.");
      else {
        setSentId(res.id);
        onSent?.(res.id);
      }
    });
  }

  if (sentId) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-accent/50 bg-blush/30 p-6 text-center">
        <p className="text-3xl" aria-hidden>
          💌
        </p>
        <p className="font-display text-xl text-ink">Terkirim untuk {partnerName}. ♡</p>
        <p className="text-sm text-ink-soft">
          {scheduled ? "Tersegel sampai waktunya tiba." : openWhen ? "Tersegel — dia yang memilih kapan membukanya." : "Menunggu dibuka."}
        </p>
        <div className="flex gap-2">
          <Link href="/words/to-you" className="text-sm text-accent-ink underline underline-offset-4">
            Lihat di To You
          </Link>
          <button type="button" onClick={onClose} className="text-sm text-ink-soft underline underline-offset-4">
            Tutup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-rule bg-paper-2/40 p-5">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-lg text-ink">{replyTo ? `Balas untuk ${partnerName}` : `Untuk ${partnerName}`}</p>
        <button type="button" onClick={onClose} className="text-sm text-ink-faint hover:text-ink-soft">
          batal
        </button>
      </div>

      <label className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">Pesan pengantar (opsional)</span>
        <textarea
          value={intro}
          onChange={(e) => setIntro(e.target.value.slice(0, WORDS_LIMITS.intro))}
          rows={2}
          placeholder="Aku menulis ini waktu…"
          className={cn(inputClass, "text-sm")}
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">Open when… (opsional)</span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => pickOpenWhen(null)}
            className={cn(
              "rounded-full border px-3 py-1 text-[13px]",
              openWhen === null ? "border-accent-ink/50 bg-blush/60 text-ink" : "border-rule text-ink-soft",
            )}
          >
            Buka kapan saja
          </button>
          {OPEN_WHEN.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => pickOpenWhen(o.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-[13px]",
                openWhen === o.key ? "border-accent-ink/50 bg-blush/60 text-ink" : "border-rule text-ink-soft",
              )}
            >
              {o.emoji} {o.key === "custom" ? "Tulis sendiri…" : o.label.replace(/^Open (when|on) /, "")}
            </button>
          ))}
        </div>
        {openWhen === "custom" ? (
          <input
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value.slice(0, 70))}
            placeholder="you can't sleep / hujan turun / kamu ragu sama dirimu"
            className={cn(inputClass, "py-2.5 text-sm")}
            aria-label="Open when…"
          />
        ) : null}
        {openWhen && openWhen !== "birthday" ? (
          <p className="text-xs text-ink-faint">Dia yang memilih kapan membukanya — tidak ada yang menebak perasaannya.</p>
        ) : null}
        {openWhen === "birthday" && !partnerBirthday ? (
          <p className="text-xs text-ink-faint">Tanggal ulang tahunnya belum diisi di profil — pilih tanggalnya sendiri di bawah.</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-3 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={scheduled}
            onChange={(e) => setScheduled(e.target.checked)}
            className="accent-[var(--accent-ink)]"
          />
          Kunci sampai tanggal tertentu
        </label>
        {scheduled ? (
          <div className="flex flex-wrap gap-2">
            <input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className={cn(inputClass, "w-auto py-2 text-sm")} />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={cn(inputClass, "w-auto py-2 text-sm")} />
            <p className="w-full text-xs text-ink-faint">Sampai saat itu, isinya benar-benar tidak bisa dibaca — hanya terlihat bahwa ada sesuatu yang menunggu.</p>
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div>
        <Button type="button" onClick={submit} disabled={pending || (openWhen === "custom" && !customLabel.trim())}>
          {pending ? "Mengirim…" : `💌 Kirim ke ${partnerName}`}
        </Button>
      </div>
    </div>
  );
}
