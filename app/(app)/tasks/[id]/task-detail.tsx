"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  deleteTask,
  rescheduleTask,
  toggleMine,
  toggleStarted,
  type TaskState,
} from "../actions";

/**
 * The little row of things you can do to a task. Deliberately few: tick it,
 * say you've started, move it, or let it go. Nothing here nags — an overdue
 * thing is offered a new day, not a warning.
 */
export function TaskActions({
  taskId,
  mineDone,
  started,
  canComplete,
  shared,
  dueDate,
  dueTime,
}: {
  taskId: string;
  mineDone: boolean;
  started: boolean;
  canComplete: boolean;
  shared: boolean;
  dueDate: string;
  dueTime: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showMove, setShowMove] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [moveState, move, moving] = useActionState<TaskState, FormData>(
    rescheduleTask,
    {},
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {canComplete ? (
          <Button
            type="button"
            disabled={pending}
            onClick={() => start(() => void toggleMine(taskId))}
          >
            {mineDone
              ? "Belum selesai ternyata"
              : shared
                ? "Complete mine"
                : "Mark as done"}
          </Button>
        ) : null}

        {!mineDone && canComplete ? (
          <Button
            type="button"
            variant="soft"
            size="sm"
            disabled={pending}
            onClick={() => start(() => void toggleStarted(taskId))}
          >
            {started ? "◐ Lagi dikerjain" : "○ Mulai kerjain"}
          </Button>
        ) : null}

        <Button
          type="button"
          variant="soft"
          size="sm"
          onClick={() => setShowMove((v) => !v)}
        >
          Reschedule
        </Button>
      </div>

      {showMove ? (
        <form
          action={(fd) => {
            move(fd);
            setShowMove(false);
          }}
          className="flex flex-wrap items-end gap-3 rounded-xl border border-rule bg-paper p-4"
        >
          <input type="hidden" name="id" value={taskId} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">Hari baru</span>
            <input
              type="date"
              name="due_date"
              defaultValue={dueDate}
              required
              className="rounded-xl border border-rule bg-ground px-3 py-2 text-ink outline-none focus:border-accent-ink/50"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">Jam</span>
            <input
              type="time"
              name="due_time"
              defaultValue={dueTime ?? ""}
              className="rounded-xl border border-rule bg-ground px-3 py-2 text-ink outline-none focus:border-accent-ink/50"
            />
          </label>
          <Button type="submit" size="sm" disabled={moving}>
            {moving ? "Memindahkan…" : "Pindahkan"}
          </Button>
        </form>
      ) : null}

      {moveState.error ? (
        <p role="alert" className="text-sm text-danger">
          {moveState.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3 border-t border-rule-soft pt-4">
        {confirmDelete ? (
          <>
            <span className="text-sm text-ink-soft">Hapus hal kecil ini?</span>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await deleteTask(taskId);
                  router.push("/tasks");
                })
              }
              className="text-sm text-danger underline underline-offset-4"
            >
              Ya, hapus
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="text-sm text-ink-faint hover:text-ink-soft"
            >
              Batal
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className={cn("text-sm text-ink-faint transition hover:text-danger")}
          >
            Hapus
          </button>
        )}
      </div>
    </div>
  );
}
