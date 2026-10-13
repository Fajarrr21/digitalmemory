"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MoonFlow, MoonMood } from "@/lib/supabase/database.types";
import type { MoonCheckin } from "@/lib/moon/queries";
import { isEmptyCheckin, needsCareNote } from "@/lib/moon/insights";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteCheckin, saveCheckin } from "./actions";
import { CARE_NOTE_TEXT, CRAMPS, ENERGY, FLOW, MOODS, SYMPTOM_LABEL } from "./moon-config";

/**
 * How Is Your Body Today? — chips and tiny scales, every one optional. A note
 * alone is a complete check-in. Strong cramps or vomiting shows a calm,
 * proportional suggestion — never a cause.
 */

type Draft = {
  cramps: number | null;
  headache: boolean;
  nausea: boolean;
  vomiting: boolean;
  fatigue: boolean;
  mood: MoonMood | null;
  energy: number | null;
  flow: MoonFlow | null;
  note: string;
};

function fromRow(r: MoonCheckin | null): Draft {
  return {
    cramps: r?.cramps ?? null,
    headache: r?.headache ?? false,
    nausea: r?.nausea ?? false,
    vomiting: r?.vomiting ?? false,
    fatigue: r?.fatigue ?? false,
    mood: r?.mood ?? null,
    energy: r?.energy ?? null,
    flow: r?.flow ?? null,
    note: r?.note ?? "",
  };
}

export function CheckinForm({
  day,
  existing,
  dayLabel,
  compact = false,
  onDone,
}: {
  day: string;
  existing: MoonCheckin | null;
  dayLabel: string;
  compact?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [d, setD] = useState<Draft>(() => fromRow(existing));
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const set = (patch: Partial<Draft>) => {
    setStatus(null);
    setD((x) => ({ ...x, ...patch }));
  };
  const empty = isEmptyCheckin({ ...d, note: d.note });

  function save() {
    start(async () => {
      try {
        const res = await saveCheckin({ day, ...d, note: d.note.trim() || null });
        if (res.ok) {
          setStatus({ kind: "ok", text: existing ? "Catatannya diperbarui. ♡" : "Tersimpan. Terima kasih sudah menyapa tubuhmu. ♡" });
          router.refresh();
          onDone?.();
        } else setStatus({ kind: "error", text: res.error ?? "Gagal menyimpan." });
      } catch {
        setStatus({ kind: "error", text: "Koneksinya terputus. Isianmu masih di sini — coba simpan lagi." });
      }
    });
  }

  function remove() {
    start(async () => {
      try {
        const res = await deleteCheckin(day);
        if (res.ok) {
          setD(fromRow(null));
          setConfirmDelete(false);
          setStatus({ kind: "ok", text: "Catatan hari itu dihapus." });
          router.refresh();
          onDone?.();
        } else setStatus({ kind: "error", text: res.error ?? "Gagal menghapus." });
      } catch {
        setStatus({ kind: "error", text: "Koneksinya terputus. Coba lagi ya." });
      }
    });
  }

  return (
    <section aria-label={`Check-in ${dayLabel}`} className="flex flex-col gap-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Apa yang terasa?</legend>
        <div className="flex flex-wrap gap-2">
          {(["headache", "nausea", "vomiting", "fatigue"] as const).map((k) => (
            <Chip key={k} on={d[k]} onClick={() => set({ [k]: !d[k] } as Partial<Draft>)}>
              {SYMPTOM_LABEL[k].emoji} {SYMPTOM_LABEL[k].label}
            </Chip>
          ))}
        </div>
      </fieldset>

      <Scale
        legend={`${SYMPTOM_LABEL.cramps.emoji} Kram / nyeri perut`}
        options={CRAMPS.map((c) => ({ value: c.value, label: c.label }))}
        value={d.cramps}
        onChange={(v) => set({ cramps: v })}
      />

      {needsCareNote(d) ? (
        <p role="note" className="rounded-2xl border border-[#e9a66b]/50 bg-[#f6c98d]/15 px-4 py-3 text-sm leading-relaxed text-ink">
          {CARE_NOTE_TEXT}
        </p>
      ) : null}

      {!compact ? (
        <>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">Suasana hati</legend>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <Chip key={m.key} on={d.mood === m.key} onClick={() => set({ mood: d.mood === m.key ? null : m.key })}>
                  {m.emoji} {m.label}
                </Chip>
              ))}
            </div>
          </fieldset>
          <Scale legend="Energi" options={ENERGY} value={d.energy} onChange={(v) => set({ energy: v })} />
          <Scale
            legend="Perdarahan"
            options={FLOW.map((f, i) => ({ value: i + 1, label: f.label }))}
            value={d.flow ? FLOW.findIndex((f) => f.key === d.flow) + 1 : null}
            onChange={(v) => set({ flow: v ? FLOW[v - 1].key : null })}
          />
          <div>
            <label htmlFor={`note-${day}`} className="mb-2 block text-sm font-medium text-ink">
              Catatan pribadi <span className="font-normal text-ink-faint">(hanya untukmu)</span>
            </label>
            <textarea
              id={`note-${day}`}
              value={d.note}
              onChange={(e) => set({ note: e.target.value.slice(0, 1000) })}
              rows={3}
              placeholder="Apa pun yang ingin kamu ingat tentang hari ini…"
              className="w-full resize-none rounded-2xl border border-rule bg-paper px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint focus:border-accent-ink/50 focus:outline-none"
            />
          </div>
        </>
      ) : null}

      {status ? (
        <p role={status.kind === "error" ? "alert" : "status"} className={cn("text-sm", status.kind === "error" ? "text-danger" : "text-accent-ink")}>
          {status.text}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {existing && !confirmDelete ? (
          <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm text-ink-faint hover:text-danger">
            hapus catatan hari ini
          </button>
        ) : (
          <span />
        )}
        <Button onClick={save} disabled={empty || pending} aria-busy={pending}>
          {pending ? "Menyimpan…" : existing ? "Perbarui" : "Simpan"}
        </Button>
      </div>
      {confirmDelete ? (
        <div role="group" aria-label="Konfirmasi hapus" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper-2 px-4 py-3">
          <p className="text-sm text-ink">Hapus check-in {dayLabel}? Tidak bisa dikembalikan.</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={pending}>
              Batal
            </Button>
            <Button variant="soft" size="sm" className="text-danger" onClick={remove} disabled={pending}>
              Ya, hapus
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "min-h-10 rounded-full border px-3.5 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink",
        on ? "border-accent bg-blush/50 text-ink" : "border-rule bg-paper text-ink-soft hover:border-accent-ink/40",
      )}
    >
      {children}
    </button>
  );
}

function Scale({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: { value: number; label: string }[];
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o.value} on={value === o.value} onClick={() => onChange(value === o.value ? null : o.value)}>
            {o.label}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}
