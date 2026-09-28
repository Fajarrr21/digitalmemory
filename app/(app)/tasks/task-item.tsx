"use client";

import Link from "next/link";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { dueLabel } from "@/lib/tasks/logic";
import { toggleMine } from "./actions";

export type TaskItemView = {
  id: string;
  title: string;
  emoji: string | null;
  note: string | null;
  dueDate: string;
  dueTime: string | null;
  startedAt: string | null;
  assignedTo: string | null;
  createdBy: string;
  completedBy: string[];
  repeatKind: string;
};

/**
 * One line in the list. The circle is the whole interaction: tap it to tick
 * off *your* part, tap the line to open it. Nothing shouts — an overdue thing
 * is simply still here, waiting.
 */
export function TaskItem({
  task,
  userId,
  partnerName,
  memberIds,
  today,
}: {
  task: TaskItemView;
  userId: string;
  partnerName: string;
  memberIds: string[];
  today: string;
}) {
  const [pending, start] = useTransition();

  const shared = task.assignedTo === null;
  const mineDone = task.completedBy.includes(userId);
  const partnerId = memberIds.find((id) => id !== userId);
  const partnerDone = !!partnerId && task.completedBy.includes(partnerId);
  const fullyDone = shared
    ? memberIds.every((id) => task.completedBy.includes(id))
    : task.completedBy.includes(task.assignedTo!);

  const forMe = shared || task.assignedTo === userId;
  const fromPartner = task.createdBy !== userId && task.assignedTo === userId;
  const overdue = !fullyDone && task.dueDate < today;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3 transition",
        overdue ? "border-accent-ink/30 bg-blush/20" : "border-rule-soft bg-paper",
        pending && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={() => start(() => void toggleMine(task.id))}
        disabled={pending || !forMe}
        aria-label={mineDone ? "Batalkan selesai" : "Tandai selesai"}
        aria-pressed={mineDone}
        className={cn(
          "mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full border text-xs transition",
          mineDone
            ? "border-accent-ink bg-accent text-[#4a2b30]"
            : "border-rule text-transparent hover:border-accent-ink/60",
          !forMe && "cursor-default opacity-40",
        )}
      >
        ✓
      </button>

      <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1">
        <p
          className={cn(
            "text-ink transition",
            fullyDone && "text-ink-faint line-through decoration-ink-faint/50",
          )}
        >
          <span aria-hidden className="mr-1.5">
            {task.emoji ?? "📝"}
          </span>
          {task.title}
        </p>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-ink-faint">
          <span className={cn(overdue && "text-accent-ink")}>
            {dueLabel(task.dueDate, today)}
          </span>
          {task.dueTime ? <span>· {task.dueTime}</span> : null}
          {task.repeatKind !== "none" ? <span>· 🔁</span> : null}
          {shared ? (
            <span>
              · Both of us {mineDone ? "✓" : "○"}
              {partnerDone ? "✓" : "○"}
            </span>
          ) : !forMe ? (
            <span>· for {partnerName}</span>
          ) : fromPartner ? (
            <span className="text-accent-ink">· ♡ from {partnerName}</span>
          ) : null}
        </div>

        {task.note ? (
          <p className="mt-1 line-clamp-1 text-sm text-ink-soft">{task.note}</p>
        ) : null}
      </Link>
    </div>
  );
}
