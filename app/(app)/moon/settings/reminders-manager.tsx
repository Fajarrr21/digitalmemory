"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MoonReminderKind } from "@/lib/supabase/database.types";
import type { MoonReminder } from "@/lib/moon/queries";
import { reminderTitle } from "@/lib/moon/reminders";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { deleteReminder, saveReminder } from "../actions";
import { REMINDER_KINDS } from "../moon-config";

/**
 * Her own reminders. In-app (the 🔔 bell) always works. WhatsApp is offered
 * honestly: generic text, and "around" the time — it goes out when the app's
 * dispatch runs (someone opening the app, or the once-a-day check).
 */
export function RemindersManager({ reminders, hasWhatsApp }: { reminders: MoonReminder[]; hasWhatsApp: boolean }) {
  const [adding, setAdding] = useState(reminders.length === 0);
  return (
    <section aria-labelledby="rem-title" className="rounded-2xl border border-rule bg-paper px-5 py-5">
      <Eyebrow>pengingat untukmu</Eyebrow>
      <h2 id="rem-title" className="mt-1.5 font-display text-xl text-ink">
        Pengingat kecil
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Muncul di 🔔 aplikasi mulai jam yang kamu pilih. Hanya untukmu — pasanganmu tidak melihatnya.
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {reminders.map((r) => (
          <ReminderRow key={r.id} r={r} hasWhatsApp={hasWhatsApp} />
        ))}
      </ul>
      {adding ? (
        <ReminderForm hasWhatsApp={hasWhatsApp} onDone={() => setAdding(false)} />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="mt-3 text-sm text-accent-ink hover:underline">
          + tambah pengingat
        </button>
      )}
    </section>
  );
}

function ReminderRow({ r, hasWhatsApp }: { r: MoonReminder; hasWhatsApp: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (editing) return <ReminderForm existing={r} hasWhatsApp={hasWhatsApp} onDone={() => setEditing(false)} />;

  const run = (fn: () => Promise<{ ok?: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      try {
        const res = await fn();
        if (res.ok) router.refresh();
        else setError(res.error ?? "Gagal.");
      } catch {
        setError("Koneksinya terputus. Coba lagi ya.");
      }
    });

  return (
    <li className="rounded-xl border border-rule px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={r.enabled ? "text-[15px] text-ink" : "text-[15px] text-ink-faint line-through"}>{reminderTitle(r)}</p>
          <p className="font-mono text-[11px] text-ink-faint">
            {r.at_time.slice(0, 5)} setiap hari{r.whatsapp ? " · + WhatsApp" : ""}
          </p>
        </div>
        <input
          type="checkbox"
          role="switch"
          aria-label={r.enabled ? "Matikan pengingat" : "Nyalakan pengingat"}
          checked={r.enabled}
          disabled={pending}
          onChange={(e) =>
            run(() =>
              saveReminder({ id: r.id, kind: r.kind, label: r.label, at_time: r.at_time.slice(0, 5), enabled: e.target.checked, whatsapp: r.whatsapp }),
            )
          }
          className="h-5 w-5 flex-none accent-[var(--accent-ink)]"
        />
      </div>
      {confirm ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-paper-2 px-3 py-2">
          <p className="text-sm text-ink">Hapus pengingat ini?</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirm(false)} disabled={pending}>
              Batal
            </Button>
            <Button variant="soft" size="sm" className="text-danger" disabled={pending} onClick={() => run(() => deleteReminder(r.id))}>
              Ya, hapus
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-1 flex gap-1">
          <button type="button" onClick={() => setEditing(true)} className="rounded-full px-2 py-0.5 text-xs text-ink-faint hover:text-accent-ink">
            ubah
          </button>
          <button type="button" onClick={() => setConfirm(true)} className="rounded-full px-2 py-0.5 text-xs text-ink-faint hover:text-danger">
            hapus
          </button>
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function ReminderForm({ existing, hasWhatsApp, onDone }: { existing?: MoonReminder; hasWhatsApp: boolean; onDone: () => void }) {
  const router = useRouter();
  const [kind, setKind] = useState<MoonReminderKind>(existing?.kind ?? "checkin");
  const [label, setLabel] = useState(existing?.label ?? "");
  const [time, setTime] = useState(existing?.at_time.slice(0, 5) ?? "20:00");
  const [whatsapp, setWhatsapp] = useState(existing?.whatsapp ?? false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl border border-dashed border-rule px-4 py-4">
      <label className="flex flex-col gap-1 text-sm text-ink-soft">
        Untuk
        <select value={kind} onChange={(e) => setKind(e.target.value as MoonReminderKind)} className="h-10 rounded-xl border border-rule bg-ground px-3 text-sm text-ink">
          {REMINDER_KINDS.map((k) => (
            <option key={k.key} value={k.key}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      {kind === "custom" ? (
        <label className="flex flex-col gap-1 text-sm text-ink-soft">
          Pengingatnya bilang
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value.slice(0, 80))}
            placeholder="minum air hangat, ya"
            className="h-10 rounded-xl border border-rule bg-ground px-3 text-sm text-ink"
          />
        </label>
      ) : null}
      <label className="flex flex-col gap-1 text-sm text-ink-soft">
        Jam
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-10 w-36 rounded-xl border border-rule bg-ground px-3 text-sm text-ink" />
      </label>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={whatsapp}
          disabled={!hasWhatsApp}
          onChange={(e) => setWhatsapp(e.target.checked)}
          className="mt-1 h-4 w-4 accent-[var(--accent-ink)]"
        />
        <span className="text-sm text-ink-soft">
          <span className="block text-ink">Juga kirim lewat WhatsApp</span>
          {hasWhatsApp
            ? "Isinya selalu umum (“Pengingat kecil yang kamu buat untuk dirimu sendiri”). Terkirim sekitar jam itu — saat aplikasi dibuka atau lewat pengecekan harian — jadi bisa sedikit telat; lewat 6 jam dilewati."
            : "Belum ada nomor WhatsApp di profilmu."}
        </span>
      </label>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone} disabled={pending}>
          Batal
        </Button>
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              try {
                const r = await saveReminder({
                  id: existing?.id,
                  kind,
                  label: kind === "custom" ? label.trim() || null : null,
                  at_time: time,
                  enabled: existing?.enabled ?? true,
                  whatsapp,
                });
                if (r.ok) {
                  onDone();
                  router.refresh();
                } else setError(r.error ?? "Gagal menyimpan.");
              } catch {
                setError("Koneksinya terputus. Coba lagi ya.");
              }
            })
          }
        >
          Simpan
        </Button>
      </div>
    </div>
  );
}
