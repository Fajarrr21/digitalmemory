"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MoonNeed } from "@/lib/supabase/database.types";
import type { MoonCare } from "@/lib/moon/queries";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/utils";
import { askForCare, closeCare, withdrawCare } from "./actions";
import { NEEDS, needInfo } from "./moon-config";

/**
 * Let Me Take Care of You — her side. Sending is the explicit choice: only
 * the need (and her words, if she adds any) reach him. Nothing about her
 * cycle or symptoms rides along. She can mark it done or withdraw it.
 */
export function CarePanel({ partnerName, active, past }: { partnerName: string; active: MoonCare[]; past: MoonCare[] }) {
  const router = useRouter();
  const [need, setNeed] = useState<MoonNeed | null>(null);
  const [message, setMessage] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok?: boolean; error?: string }>, done: string, after?: () => void) =>
    start(async () => {
      setMsg(null);
      try {
        const r = await fn();
        if (r.ok) {
          setMsg({ ok: true, text: done });
          after?.();
          router.refresh();
        } else setMsg({ ok: false, text: r.error ?? "Gagal." });
      } catch {
        setMsg({ ok: false, text: "Koneksinya terputus. Pilihanmu masih di sini — coba lagi." });
      }
    });

  return (
    <section aria-labelledby="care-title" className="flex flex-col gap-4 rounded-2xl border border-rule bg-paper px-5 py-5">
      <div>
        <Eyebrow>let me take care of you</Eyebrow>
        <h2 id="care-title" className="mt-1.5 font-display text-xl text-ink">
          Mau minta sesuatu dari {partnerName}?
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Hanya pilihan ini (dan kata-katamu, kalau ada) yang sampai ke dia — bukan siklus atau gejalamu.
        </p>
      </div>

      {active.map((c) => (
        <div key={c.id} className="rounded-xl bg-blush/35 px-4 py-3">
          <p className="text-[15px] text-ink">
            {needInfo(c.need).emoji} {needInfo(c.need).label}
          </p>
          {c.message ? <p className="mt-1 text-sm text-ink-soft">“{c.message}”</p> : null}
          <p className="mt-1 font-mono text-[11px] text-ink-faint">
            {c.acked_at ? `${partnerName} sudah melihatnya ♡` : `menunggu ${partnerName}`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="soft" disabled={pending} onClick={() => run(() => closeCare(c.id), "Ditandai sudah cukup. ♡")}>
              sudah cukup, makasih
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => withdrawCare(c.id), "Ditarik kembali.")}>
              tarik kembali
            </Button>
          </div>
        </div>
      ))}

      <fieldset>
        <legend className="sr-only">Apa yang kamu butuhkan</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {NEEDS.map((n) => (
            <label
              key={n.key}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-2.5 transition",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink",
                need === n.key ? "border-accent bg-blush/40" : "border-rule hover:border-accent-ink/40",
              )}
            >
              <input type="radio" name="need" value={n.key} checked={need === n.key} onChange={() => setNeed(n.key)} className="sr-only" />
              <span aria-hidden>{n.emoji}</span>
              <span>
                <span className="block text-sm font-medium text-ink">{n.label}</span>
                <span className="block text-xs text-ink-soft">{n.line}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {need ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="care-msg" className="text-sm text-ink-soft">
            Mau menambahkan sesuatu? (opsional)
          </label>
          <textarea
            id="care-msg"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 500))}
            rows={2}
            className="w-full resize-none rounded-xl border border-rule bg-ground px-3 py-2 text-[15px] text-ink focus:border-accent-ink/50 focus:outline-none"
          />
          <div className="flex justify-end">
            <Button
              disabled={pending}
              onClick={() =>
                run(() => askForCare({ need, message: message.trim() || null }), `Terkirim ke ${partnerName}. ♡`, () => {
                  setNeed(null);
                  setMessage("");
                })
              }
            >
              {pending ? "Mengirim…" : `Kirim ke ${partnerName}`}
            </Button>
          </div>
          <p className="text-xs text-ink-faint">Tidak ada WhatsApp untuk ini — {partnerName} akan melihatnya di aplikasi.</p>
        </div>
      ) : null}

      {msg ? (
        <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm text-accent-ink" : "text-sm text-danger"}>
          {msg.text}
        </p>
      ) : null}

      {past.length ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-ink-faint">sebelumnya · {past.length}</summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {past.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 text-ink-soft">
                <span>
                  {needInfo(c.need).emoji} {needInfo(c.need).label}
                </span>
                <span className="font-mono text-[11px] text-ink-faint">
                  {new Date(c.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
