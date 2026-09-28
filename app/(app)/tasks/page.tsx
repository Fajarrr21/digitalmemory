import Link from "next/link";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { formatDateLabel, localDateISO } from "@/lib/date";
import { getTasks } from "@/lib/tasks/queries";
import { BUCKET_LABEL, groupTasks } from "@/lib/tasks/logic";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { TaskComposer } from "./task-composer";
import { TaskItem } from "./task-item";

export const metadata = { title: "Little Things" };

/** Completed things stay forever, but the page only shows the recent few. */
const COMPLETED_SHOWN = 12;

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; new?: string }>;
}) {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const { date, new: openNew } = await searchParams;
  const onlyDate = /^\d{4}-\d{2}-\d{2}$/.test(date ?? "") ? date! : null;

  const today = localDateISO(ctx.profile.timezone);
  const partner = await getPartner(ctx.spaceId, ctx.userId);
  const memberIds = [ctx.userId, ...(partner ? [partner.id] : [])];

  const all = await getTasks(ctx.spaceId);
  const tasks = onlyDate ? all.filter((t) => t.dueDate === onlyDate) : all;
  const groups = groupTasks(tasks, memberIds, today);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Eyebrow>📝 little things</Eyebrow>
        <h1 className="mt-2 font-display text-3xl font-medium text-ink">
          Things worth remembering.
        </h1>
        <p className="mt-1 text-ink-soft">
          So you don&apos;t have to keep everything in your head. ♡
        </p>
      </header>

      {onlyDate ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rule-soft bg-paper px-4 py-2 text-sm">
          <span className="text-ink-soft">
            Cuma yang tanggal{" "}
            <span className="text-ink">{formatDateLabel(onlyDate)}</span>
          </span>
          <Link href="/tasks" className="text-accent-ink hover:underline">
            lihat semua
          </Link>
        </div>
      ) : null}

      <TaskComposer
        partnerName={partner?.name ?? null}
        today={today}
        defaultDate={onlyDate ?? undefined}
        startOpen={openNew === "1"}
      />

      {groups.length === 0 ? (
        <PaperCard className="border-dashed text-center">
          <p className="font-hand text-xl text-accent-ink">
            nothing waiting for you
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {onlyDate
              ? "Hari itu kosong. Tenang aja. ♡"
              : "Kalau ada hal kecil yang takut kelupaan, taruh di sini. ♡"}
          </p>
        </PaperCard>
      ) : null}

      {groups.map((group) => {
        const shown =
          group.bucket === "completed" ? group.tasks.slice(0, COMPLETED_SHOWN) : group.tasks;
        const hidden = group.tasks.length - shown.length;
        return (
          <section key={group.bucket} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <Eyebrow
                className={group.bucket === "completed" ? "text-ink-faint" : undefined}
              >
                {BUCKET_LABEL[group.bucket]}
              </Eyebrow>
              <span className="font-mono text-[11px] text-ink-faint">
                {group.tasks.length}
              </span>
            </div>
            {shown.map((task) => (
              <TaskItem
                key={task.id}
                task={{
                  id: task.id,
                  title: task.title,
                  emoji: task.emoji,
                  note: task.note,
                  dueDate: task.dueDate,
                  dueTime: task.dueTime,
                  startedAt: task.startedAt,
                  assignedTo: task.assignedTo,
                  createdBy: task.createdBy,
                  completedBy: task.completedBy,
                  repeatKind: task.repeatKind,
                }}
                userId={ctx.userId}
                partnerName={partner?.name ?? "Dia"}
                memberIds={memberIds}
                today={today}
              />
            ))}
            {hidden > 0 ? (
              <p className="px-1 font-mono text-[11px] text-ink-faint">
                …dan {hidden} lagi yang sudah selesai. Semuanya tetap tersimpan. ♡
              </p>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
