"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/utils";
import { formatDateLabel } from "@/lib/date";
import { DEFAULT_REMINDER_TIME, REMINDER_PRESETS, dueLabel } from "@/lib/tasks/logic";
import { DEFAULT_EMOJI, parseQuickAdd } from "@/lib/tasks/parse";
import { createTask, type TaskState } from "./actions";

const EMOJI_CHOICES = [
  "\u{1F4DD}", "\u{1F4DA}", "\u{1F4BC}", "\u{1F6CD}️", "\u{1F48C}",
  "\u{1F382}", "\u{1F4C5}", "\u{1F48A}", "\u{1F9F3}", "\u{1F4B3}", "\u{1F4F8}", "\u{1F331}",
];

type Reminder = { key: string; offsetDays: number | null; date: string; time: string };

/**
 * Add a little thing. Two ways in, same form underneath:
 *  - Quick Add — type it the way you'd say it ("PR matematika besok jam 8")
 *    and the parsed date/time drop into the form for you to confirm (§13);
 *  - the full form, if you'd rather fill it in yourself.
 * Nothing is ever saved from the parse alone.
 */
export function TaskComposer({
  partnerName,
  today,
  defaultDate,
  startOpen = false,
}: {
  partnerName: string | null;
  today: string;
  defaultDate?: string;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [quick, setQuick] = useState("");
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState(DEFAULT_EMOJI);
  const [dueDate, setDueDate] = useState(defaultDate ?? today);
  const [dueTime, setDueTime] = useState("");
  const [assignee, setAssignee] = useState<"me" | "partner" | "both">("me");
  const [repeat, setRepeat] = useState("none");
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>(() => [
    { key: "d0", offsetDays: 0, date: defaultDate ?? today, time: "08:00" },
  ]);
  const titleRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<TaskState>({});
  const [pending, startSaving] = useTransition();

  /** Save, then — only once it lands — empty the form and step out of the way. */
  function act(formData: FormData) {
    startSaving(async () => {
      const result = await createTask({}, formData);
      setState(result);
      if (!result.ok) return;
      setQuick("");
      setTitle("");
      setNote("");
      setDueTime("");
      setEmoji(DEFAULT_EMOJI);
      setOpen(false);
    });
  }

  const guess = useMemo(
    () => (quick.trim().length > 1 ? parseQuickAdd(quick, today) : null),
    [quick, today],
  );

  function adopt(fill: ReturnType<typeof parseQuickAdd>) {
    setTitle(fill.title);
    setEmoji(fill.emoji);
    setDueDate(fill.dueDate);
    setDueTime(fill.dueTime ?? "");
    setReminders((prev) =>
      prev.map((r) => (r.offsetDays === null ? r : { ...r, date: fill.dueDate })),
    );
  }

  function openWith(fill: ReturnType<typeof parseQuickAdd>) {
    adopt(fill);
    setOpen(true);
    requestAnimationFrame(() => titleRef.current?.focus());
  }

  const reminderPayload = JSON.stringify(
    reminders.map((r) => ({
      offsetDays: r.offsetDays,
      ...(r.offsetDays === null ? { date: r.date } : {}),
      time: r.time,
    })),
  );

  function togglePreset(offsetDays: number) {
    setReminders((prev) => {
      const found = prev.find((r) => r.offsetDays === offsetDays);
      if (found) return prev.filter((r) => r !== found);
      return [
        ...prev,
        {
          key: `d${offsetDays}`,
          offsetDays,
          date: dueDate,
          time: offsetDays === 0 ? "08:00" : DEFAULT_REMINDER_TIME,
        },
      ];
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Quick Add — the lowest-effort way in. */}
      <div className="rounded-2xl border border-rule bg-paper p-4">
        <label className="flex items-center gap-3">
          <span aria-hidden className="text-lg text-ink-faint">
            ＋
          </span>
          <input
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && guess) {
                e.preventDefault();
                openWith(guess);
              }
            }}
            placeholder="What's on your mind?"
            maxLength={200}
            className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-faint"
          />
        </label>

        {guess ? (
          <div className="mt-3 border-t border-rule-soft pt-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
              I think you mean
            </p>
            <p className="mt-2 font-display text-lg text-ink">
              {guess.emoji} {guess.title}
            </p>
            <p className="mt-0.5 text-sm text-ink-soft">
              {guess.matched.date
                ? `${dueLabel(guess.dueDate, today)} · ${formatDateLabel(guess.dueDate)}`
                : "No date yet — today for now"}
              {guess.dueTime ? ` · ${guess.dueTime}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <form
                action={(fd) => {
                  adopt(guess);
                  act(fd);
                }}
              >
                <input type="hidden" name="title" value={guess.title} />
                <input type="hidden" name="emoji" value={guess.emoji} />
                <input type="hidden" name="due_date" value={guess.dueDate} />
                {guess.dueTime ? (
                  <input type="hidden" name="due_time" value={guess.dueTime} />
                ) : null}
                <input type="hidden" name="assignee" value="me" />
                <input type="hidden" name="repeat" value="none" />
                <input
                  type="hidden"
                  name="reminders"
                  value={JSON.stringify([
                    { offsetDays: 0, time: guess.dueTime ?? "08:00" },
                  ])}
                />
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? "Menyimpan…" : "Add"}
                </Button>
              </form>
              <Button
                type="button"
                variant="soft"
                size="sm"
                onClick={() => openWith(guess)}
              >
                Edit
              </Button>
            </div>
          </div>
        ) : !open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-2 text-sm text-accent-ink hover:underline"
          >
            …or fill it in properly →
          </button>
        ) : null}
      </div>

      {/* The full form */}
      {open ? (
        <form action={act} className="flex flex-col gap-4 rounded-2xl border border-rule bg-paper p-5">
          <Eyebrow>what do you need to remember?</Eyebrow>

          <div className="flex items-center gap-2">
            <span aria-hidden className="text-2xl">
              {emoji}
            </span>
            <input
              ref={titleRef}
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={160}
              placeholder="Finish Math homework"
              className="min-w-0 flex-1 rounded-xl border border-rule bg-ground px-3 py-2 text-ink outline-none placeholder:text-ink-faint focus:border-accent-ink/50"
            />
          </div>
          <input type="hidden" name="emoji" value={emoji} />

          <div className="flex flex-wrap gap-1.5">
            {EMOJI_CHOICES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                aria-label={`Pilih ikon ${e}`}
                aria-pressed={emoji === e}
                className={cn(
                  "h-9 w-9 rounded-full border text-lg transition",
                  emoji === e
                    ? "border-accent-ink/50 bg-blush/40"
                    : "border-rule-soft hover:border-accent-ink/30",
                )}
              >
                {e}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-soft">📅 When?</span>
              <input
                type="date"
                name="due_date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="rounded-xl border border-rule bg-ground px-3 py-2 text-ink outline-none focus:border-accent-ink/50"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-soft">⏰ Jam (boleh kosong)</span>
              <input
                type="time"
                name="due_time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="rounded-xl border border-rule bg-ground px-3 py-2 text-ink outline-none focus:border-accent-ink/50"
              />
            </label>
          </div>

          {/* Reminders — several per thing, each with its own moment. */}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm text-ink-soft">🔔 Reminder</legend>
            {REMINDER_PRESETS.map((preset) => {
              const chosen = reminders.find((r) => r.offsetDays === preset.offsetDays);
              return (
                <div key={preset.offsetDays} className="flex items-center gap-3">
                  <label className="flex flex-1 items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={!!chosen}
                      onChange={() => togglePreset(preset.offsetDays)}
                      className="h-4 w-4 accent-[var(--accent-ink)]"
                    />
                    {preset.label}
                  </label>
                  {chosen ? (
                    <input
                      type="time"
                      value={chosen.time}
                      onChange={(e) =>
                        setReminders((prev) =>
                          prev.map((r) =>
                            r === chosen ? { ...r, time: e.target.value } : r,
                          ),
                        )
                      }
                      className="rounded-lg border border-rule bg-ground px-2 py-1 text-sm text-ink outline-none focus:border-accent-ink/50"
                    />
                  ) : null}
                </div>
              );
            })}

            {reminders
              .filter((r) => r.offsetDays === null)
              .map((custom) => (
                <div key={custom.key} className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={custom.date}
                    onChange={(e) =>
                      setReminders((prev) =>
                        prev.map((r) =>
                          r === custom ? { ...r, date: e.target.value } : r,
                        ),
                      )
                    }
                    className="rounded-lg border border-rule bg-ground px-2 py-1 text-sm text-ink outline-none focus:border-accent-ink/50"
                  />
                  <input
                    type="time"
                    value={custom.time}
                    onChange={(e) =>
                      setReminders((prev) =>
                        prev.map((r) =>
                          r === custom ? { ...r, time: e.target.value } : r,
                        ),
                      )
                    }
                    className="rounded-lg border border-rule bg-ground px-2 py-1 text-sm text-ink outline-none focus:border-accent-ink/50"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setReminders((prev) => prev.filter((r) => r !== custom))
                    }
                    className="text-sm text-ink-faint hover:text-danger"
                  >
                    hapus
                  </button>
                </div>
              ))}

            {reminders.length < 6 ? (
              <button
                type="button"
                onClick={() =>
                  setReminders((prev) => [
                    ...prev,
                    {
                      key: `c${Date.now()}`,
                      offsetDays: null,
                      date: dueDate,
                      time: DEFAULT_REMINDER_TIME,
                    },
                  ])
                }
                className="self-start text-sm text-accent-ink hover:underline"
              >
                + Custom
              </button>
            ) : null}
            <input type="hidden" name="reminders" value={reminderPayload} />
          </fieldset>

          {/* For whom */}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm text-ink-soft">👤 For</legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["me", "Me"],
                  ["partner", partnerName ?? "Dia"],
                  ["both", "Both of us"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAssignee(value)}
                  aria-pressed={assignee === value}
                  disabled={value === "partner" && !partnerName}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm transition disabled:opacity-40",
                    assignee === value
                      ? "border-accent-ink/50 bg-blush/40 text-ink"
                      : "border-rule-soft text-ink-soft hover:border-accent-ink/30",
                  )}
                >
                  {value === "partner" ? `♡ ${label}` : label}
                </button>
              ))}
            </div>
            <input type="hidden" name="assignee" value={assignee} />
          </fieldset>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">📝 Note</span>
            <textarea
              name="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Chapter 4–6"
              className="resize-none rounded-xl border border-rule bg-ground px-3 py-2 text-ink outline-none placeholder:text-ink-faint focus:border-accent-ink/50"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-soft">🔁 Repeat</span>
              <select
                name="repeat"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                className="rounded-xl border border-rule bg-ground px-3 py-2 text-ink outline-none focus:border-accent-ink/50"
              >
                <option value="none">Sekali saja</option>
                <option value="daily">Setiap hari</option>
                <option value="weekly">Setiap minggu</option>
                <option value="monthly">Setiap bulan</option>
              </select>
            </label>
          </div>

          {/* Opt-in, never assumed (§3). */}
          <label className="flex items-start gap-2 rounded-xl border border-rule-soft bg-ground/60 p-3 text-sm">
            <input
              type="checkbox"
              name="notify_whatsapp"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--accent-ink)]"
            />
            <span>
              <span className="text-ink">Ingetin lewat WhatsApp juga</span>
              <span className="mt-0.5 block text-xs text-ink-faint">
                Pelan aja, sekali per pengingat. Kalau nggak dicentang, pengingatnya
                cuma muncul di dalam app.
              </span>
            </span>
          </label>

          {state.error ? (
            <p role="alert" className="text-sm text-danger">
              {state.error}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan…" : "Add reminder"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Nanti aja
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
