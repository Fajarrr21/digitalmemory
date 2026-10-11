"use client";

import { useState, useTransition } from "react";
import { setHoldWhatsApp } from "./actions";

/** "Kabari aku lewat WhatsApp" — per person, generic messages only. */
export function WhatsAppToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="rounded-2xl border border-rule px-5 py-4">
      <label className="flex cursor-pointer items-start justify-between gap-4">
        <span>
          <span className="block text-[15px] text-ink">Kabari aku lewat WhatsApp</span>
          <span className="mt-0.5 block text-sm text-ink-faint">
            Pesannya selalu umum — &ldquo;Ada ruang kecil yang menunggumu di Hold.&rdquo; Tanpa isi
            perasaan, tanpa pengingat berulang.
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={on}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            setOn(next);
            setError(null);
            start(async () => {
              const res = await setHoldWhatsApp(next);
              if (res.error) {
                setOn(!next);
                setError(res.error);
              }
            });
          }}
          className="mt-1 h-5 w-5 flex-none accent-[var(--accent-ink)]"
        />
      </label>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
