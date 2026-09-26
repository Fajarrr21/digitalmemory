"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { Flame } from "@/components/flame/flame";
import { cn } from "@/lib/utils";
import type { FlameState } from "@/lib/flame-logic";
import { MILESTONES, milestoneToday, tierFor, type Milestone } from "./flame-config";
import { shareFlameCard } from "./share-flame-card";
import { restoreFlame } from "./actions";

export function FlameView({
  state,
  today,
  flameDays,
  bridgedDays,
  recoveriesLeft,
  youName,
  partnerName,
  youAvatarUrl,
  partnerAvatarUrl,
}: {
  state: FlameState;
  today: string;
  flameDays: string[];
  bridgedDays: string[];
  recoveriesLeft: number;
  youName: string;
  partnerName: string;
  youAvatarUrl: string | null;
  partnerAvatarUrl: string | null;
}) {
  const reduce = useReducedMotion();
  const router = useRouter();
  const [restoring, startRestore] = useTransition();
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [rested, setRested] = useState(false);

  const gapDay = state.restorable?.gapDay ?? null;
  useEffect(() => {
    if (!gapDay) return;
    try {
      setRested(localStorage.getItem(`flame:rest:${gapDay}`) === "1");
    } catch {
      // fine
    }
  }, [gapDay]);

  function letItRest() {
    if (gapDay) {
      try {
        localStorage.setItem(`flame:rest:${gapDay}`, "1");
      } catch {
        // fine
      }
    }
    setRested(true);
  }

  function doRestore() {
    startRestore(async () => {
      setRestoreError(null);
      const res = await restoreFlame();
      if (res.error) setRestoreError(res.error);
      else router.refresh();
    });
  }

  const tier = tierFor(Math.max(1, state.streak));
  const celebration = state.status === "lit" ? milestoneToday(state.streak) : null;
  const bestEver = Math.max(state.streak, ...state.runs.map((r) => r.length), 0);
  const quietVisual = state.streak === 0;
  const showRestore =
    !!state.restorable && !rested && recoveriesLeft > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* hero */}
      <div className="relative overflow-hidden rounded-3xl border border-rule bg-gradient-to-b from-paper to-blush/20 px-5 py-10 text-center">
        <Flame streak={state.streak} quiet={quietVisual} size={170} />

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {state.streak > 0 ? (
            <>
              <p className="mt-4 font-display text-5xl font-medium text-ink">
                {state.streak}
              </p>
              <p className="font-mono text-sm text-ink-faint">
                {state.streak === 1 ? "day" : "days"} · {tier.name}
              </p>
            </>
          ) : (
            <p className="mt-4 font-hand text-2xl text-accent-ink">
              {state.status === "quiet" ? "The flame went quiet." : "A new flame can always be lit."}
            </p>
          )}

          {/* presence today */}
          <div className="mt-4 flex items-center justify-center gap-4 text-sm">
            <PresenceChip name={youName} present={state.todayYou} />
            <PresenceChip name={partnerName} present={state.todayPartner} />
          </div>

          <p className="mt-3 text-ink-soft">
            {state.status === "lit"
              ? "You both showed up today. ♡"
              : state.status === "waiting"
                ? "🕯️ Waiting for one more…"
                : state.status === "quiet"
                  ? "Yesterday, one of us didn't make it here. And that's okay."
                  : state.todayYou || state.todayPartner
                    ? "🕯️ Waiting for one more…"
                    : "We just have to keep showing up."}
          </p>
        </motion.div>
      </div>

      {/* milestone celebration */}
      {celebration ? (
        <PaperCard lift className="bg-gradient-to-br from-blush/40 to-paper text-center">
          <p className="text-3xl">🔥</p>
          <p className="mt-2 font-display text-2xl font-medium text-ink">
            DAY {celebration.day}
          </p>
          <p className="mt-2 font-hand text-xl text-accent-ink">{celebration.line}</p>
          <div className="mt-4 flex justify-center">
            <ShareMilestoneButton
              milestone={celebration}
              youName={youName}
              partnerName={partnerName}
              youAvatarUrl={youAvatarUrl}
              partnerAvatarUrl={partnerAvatarUrl}
            />
          </div>
        </PaperCard>
      ) : null}

      {/* restore */}
      {state.restorable && (showRestore || recoveriesLeft === 0) ? (
        <PaperCard className={cn(recoveriesLeft === 0 && "border-dashed")}>
          {recoveriesLeft > 0 ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="font-hand text-xl text-accent-ink">
                But it doesn&apos;t have to stay that way.
              </p>
              <p className="text-sm text-ink-soft">
                Your <strong className="text-ink">{state.restorable.priorStreak}-day</strong> flame
                can still be lit again — {recoveriesLeft} of 5 chances left this month.
              </p>
              {restoreError ? (
                <p role="alert" className="text-sm text-danger">{restoreError}</p>
              ) : null}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button type="button" onClick={doRestore} disabled={restoring}>
                  {restoring ? "Menyalakan…" : "🔥 Restore Flame"}
                </Button>
                <Button type="button" variant="ghost" onClick={letItRest} disabled={restoring}>
                  Let it rest
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-center text-sm text-ink-soft">
              The flame has rested for now — kesempatan bulan ini sudah terpakai semua.
              <br />
              A new one can always be lit. ♡
            </p>
          )}
        </PaperCard>
      ) : null}

      {/* calendar */}
      <section className="flex flex-col gap-2">
        <Eyebrow>this month</Eyebrow>
        <PaperCard>
          <MonthGrid today={today} flameDays={flameDays} bridgedDays={bridgedDays} />
          <p className="mt-3 text-center font-mono text-xs text-ink-faint">
            Recovery · {recoveriesLeft}/5 left this month
          </p>
        </PaperCard>
      </section>

      {/* milestones */}
      <section className="flex flex-col gap-2">
        <Eyebrow>milestones</Eyebrow>
        <PaperCard>
          <ul className="divide-y divide-rule-soft">
            {MILESTONES.map((m) => {
              const achieved = bestEver >= m.day;
              return (
                <li key={m.day} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className={cn("font-display font-medium", achieved ? "text-ink" : "text-ink-faint")}>
                      {achieved ? "✓" : "○"} Day {m.day} · {m.title}
                    </p>
                    {achieved ? (
                      <p className="mt-0.5 text-xs text-ink-soft">{m.line}</p>
                    ) : null}
                  </div>
                  {achieved ? (
                    <ShareMilestoneButton
                      milestone={m}
                      youName={youName}
                      partnerName={partnerName}
                      youAvatarUrl={youAvatarUrl}
                      partnerAvatarUrl={partnerAvatarUrl}
                      small
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </PaperCard>
      </section>

      {/* history */}
      {state.runs.length > 0 ? (
        <section className="flex flex-col gap-2">
          <Eyebrow>every flame we&apos;ve lit</Eyebrow>
          <PaperCard>
            <ul className="divide-y divide-rule-soft">
              {state.runs.map((r, i) => {
                const isCurrent = i === 0 && state.streak > 0;
                return (
                  <li key={r.start} className="flex items-center justify-between gap-3 py-3">
                    <p className="text-ink">
                      {isCurrent ? "🔥" : "🕯️"} {r.length} {r.length === 1 ? "day" : "days"}
                      {isCurrent ? (
                        <span className="ml-2 rounded-full bg-blush/40 px-2 py-0.5 text-xs text-accent-ink">
                          burning
                        </span>
                      ) : null}
                    </p>
                    <p className="font-mono text-xs text-ink-faint">
                      {r.start} → {r.end}
                    </p>
                  </li>
                );
              })}
            </ul>
          </PaperCard>
        </section>
      ) : null}

      <p className="text-center font-hand text-lg text-accent-ink">
        We don&apos;t have to be together every moment. We just have to keep showing up. ♡
      </p>
    </div>
  );
}

function PresenceChip({ name, present }: { name: string; present: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1",
        present ? "border-accent-ink/40 bg-blush/30 text-accent-ink" : "border-rule text-ink-faint",
      )}
    >
      {name} {present ? "✓" : "·"}
    </span>
  );
}

function ShareMilestoneButton({
  milestone,
  youName,
  partnerName,
  youAvatarUrl,
  partnerAvatarUrl,
  small = false,
}: {
  milestone: Milestone;
  youName: string;
  partnerName: string;
  youAvatarUrl: string | null;
  partnerAvatarUrl: string | null;
  small?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function share() {
    setBusy(true);
    setNote(null);
    try {
      const outcome = await shareFlameCard({
        milestone,
        youName,
        partnerName,
        youAvatarUrl,
        partnerAvatarUrl,
      });
      if (outcome === "downloaded") setNote("Tersimpan ✓ tinggal upload ♡");
    } catch {
      setNote("Gagal menyiapkan kartunya.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-none flex-col items-end gap-1">
      <Button type="button" variant="soft" size={small ? "sm" : "md"} onClick={share} disabled={busy}>
        {busy ? "…" : "📤 Share"}
      </Button>
      {note ? <p className="text-xs text-ink-faint">{note}</p> : null}
    </div>
  );
}

// ---- month calendar ----------------------------------------------------------

function MonthGrid({
  today,
  flameDays,
  bridgedDays,
}: {
  today: string;
  flameDays: string[];
  bridgedDays: string[];
}) {
  const { label, weeks } = useMemo(() => buildMonth(today), [today]);
  const flames = useMemo(() => new Set(flameDays), [flameDays]);
  const bridges = useMemo(() => new Set(bridgedDays), [bridgedDays]);

  return (
    <div>
      <p className="text-center font-display font-medium text-ink">{label}</p>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={`${d}${i}`} className="font-mono text-[11px] text-ink-faint">
            {d}
          </span>
        ))}
        {weeks.flat().map((day, i) =>
          day === null ? (
            <span key={`e${i}`} />
          ) : (
            <span
              key={day}
              className={cn(
                "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm",
                day === today && "ring-1 ring-accent-ink/50",
                flames.has(day)
                  ? ""
                  : bridges.has(day)
                    ? "opacity-60"
                    : "text-ink-faint",
              )}
              title={day}
            >
              {flames.has(day) ? "🔥" : bridges.has(day) ? "🕯️" : day.slice(8).replace(/^0/, "")}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

function buildMonth(today: string): { label: string; weeks: (string | null)[][] } {
  const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const label = first.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  // Monday-first offset.
  const offset = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${today.slice(0, 8)}${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { label, weeks };
}
