"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MoonShare } from "@/lib/moon/queries";
import { Eyebrow } from "@/components/ui/eyebrow";
import { saveShare } from "../actions";
import { SHARE_OPTIONS } from "../moon-config";

/**
 * Privacy first: everything starts off. Each switch says exactly what he
 * would see. Turning one off takes effect on his very next page load — the
 * database function reads these settings live.
 */
export function ShareSettings({ initial, partnerName }: { initial: MoonShare; partnerName: string }) {
  const router = useRouter();
  const [share, setShare] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const none = !share.share_phase && !share.share_symptoms && !share.partner_heads_up;

  function toggle(key: keyof MoonShare, value: boolean) {
    const next = { ...share, [key]: value };
    setShare(next);
    setMsg(null);
    start(async () => {
      try {
        const r = await saveShare(next);
        if (r.ok) {
          setMsg({ ok: true, text: value ? "Disimpan." : `Dicabut — ${partnerName} tidak bisa melihatnya lagi.` });
          router.refresh();
        } else {
          setShare(share);
          setMsg({ ok: false, text: r.error ?? "Gagal menyimpan." });
        }
      } catch {
        setShare(share);
        setMsg({ ok: false, text: "Koneksinya terputus. Pengaturanmu tidak berubah." });
      }
    });
  }

  return (
    <section aria-labelledby="share-title" className="rounded-2xl border border-rule bg-paper px-5 py-5">
      <Eyebrow>privacy first</Eyebrow>
      <h2 id="share-title" className="mt-1.5 font-display text-xl text-ink">
        Apa yang boleh {partnerName} lihat?
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Semua catatanmu privat. Catatan pribadi, mood, dan perdarahan tidak pernah bisa dibagikan dari sini.
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {SHARE_OPTIONS.map((o) => (
          <li key={o.key}>
            <label className="flex cursor-pointer items-start justify-between gap-4">
              <span>
                <span className="block text-[15px] text-ink">{o.label}</span>
                <span className="block text-xs text-ink-faint">{partnerName}: {o.sees}</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={share[o.key]}
                disabled={pending}
                onChange={(e) => toggle(o.key, e.target.checked)}
                className="mt-1 h-5 w-5 flex-none accent-[var(--accent-ink)]"
              />
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-4 rounded-xl bg-paper-2 px-4 py-3 text-sm text-ink-soft">
        {none
          ? `Sekarang ${partnerName} tidak melihat apa pun dari sini — bahkan tidak ada tanda kalau kamu mencatat. Permintaan perhatian tetap bisa kamu kirim kapan saja dari halaman “Hari ini”.`
          : `Hanya yang menyala di atas yang terlihat oleh ${partnerName}. Matikan kapan saja.`}
      </p>
      {msg ? (
        <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "mt-2 text-sm text-accent-ink" : "mt-2 text-sm text-danger"}>
          {msg.text}
        </p>
      ) : null}
    </section>
  );
}
