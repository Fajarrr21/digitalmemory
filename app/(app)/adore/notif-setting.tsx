"use client";

import { useState, useTransition } from "react";
import { NOTIF_FREQ } from "./adore-config";
import { setAdoreWhatsApp } from "./actions";

/** Her opt-in: whether his little notifications may also arrive on WhatsApp, and how often. */
export function NotifSetting({ perDay, hasNumber }: { perDay: number; hasNumber: boolean }) {
  const [value, setValue] = useState(perDay);
  const [pending, start] = useTransition();

  return (
    <div className="rounded-2xl border border-rule-soft p-4 text-sm">
      <label className="flex flex-wrap items-center gap-2 text-ink">
        Kirim juga ke WhatsApp
        <select
          value={value}
          disabled={pending || !hasNumber}
          onChange={(e) => {
            const next = Number(e.target.value);
            setValue(next);
            start(() => void setAdoreWhatsApp(next));
          }}
          className="rounded-xl border border-rule bg-ground px-2 py-1.5 text-ink"
        >
          {NOTIF_FREQ.map((n) => (
            <option key={n} value={n}>{n === 0 ? "nggak usah" : `maks ${n}× sehari`}</option>
          ))}
        </select>
      </label>
      <p className="mt-1 text-xs text-ink-faint">
        {hasNumber
          ? "Selalu ada di 🔔 juga. Kamu bisa matikan kapan aja."
          : "Isi nomor WhatsApp di profil dulu kalau mau. Di 🔔 tetap muncul."}
      </p>
    </div>
  );
}
