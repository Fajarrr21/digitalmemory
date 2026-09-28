import Link from "next/link";
import { notFound } from "next/navigation";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { formatDateLabel, formatInstant, localDateISO } from "@/lib/date";
import { getTask } from "@/lib/tasks/queries";
import { dueLabel, isFullyComplete, taskStatus } from "@/lib/tasks/logic";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { TaskActions } from "./task-detail";

const STATUS_LINE = {
  upcoming: { mark: "○", label: "Not started" },
  "in-progress": { mark: "◐", label: "In progress" },
  completed: { mark: "✓", label: "Completed" },
  overdue: { mark: "⚠️", label: "Still waiting" },
} as const;

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const { id } = await params;
  const task = await getTask(id);
  if (!task) notFound();

  const today = localDateISO(ctx.profile.timezone);
  const partner = await getPartner(ctx.spaceId, ctx.userId);
  const memberIds = [ctx.userId, ...(partner ? [partner.id] : [])];

  const status = taskStatus(task, memberIds, today);
  const done = isFullyComplete(task, memberIds);
  const shared = task.assignedTo === null;
  const mineDone = task.completedBy.includes(ctx.userId);
  const partnerDone = !!partner && task.completedBy.includes(partner.id);
  const canComplete = shared || task.assignedTo === ctx.userId;
  const fromPartner = task.createdBy !== ctx.userId && task.assignedTo === ctx.userId;

  const forLabel = shared
    ? "Both of us"
    : task.assignedTo === ctx.userId
      ? (ctx.profile.nickname ?? ctx.profile.display_name)
      : (partner?.name ?? "Dia");

  return (
    <div className="flex flex-col gap-6">
      <Link href="/tasks" className="text-sm text-ink-faint hover:text-accent-ink">
        ← Little Things
      </Link>

      {fromPartner ? (
        <p className="font-hand text-xl text-accent-ink">♡ From {partner?.name}</p>
      ) : null}

      <header>
        <h1 className="font-display text-3xl font-medium text-ink text-balance">
          <span aria-hidden className="mr-2">
            {task.emoji ?? "📝"}
          </span>
          {task.title}
        </h1>
        <p className="mt-2 text-ink-soft">
          {STATUS_LINE[status].mark} {STATUS_LINE[status].label}
          {status === "overdue" ? ` · ${dueLabel(task.dueDate, today)}` : ""}
        </p>
      </header>

      {done ? (
        <PaperCard className="bg-gradient-to-br from-blush/40 to-paper">
          <Eyebrow>done ✓</Eyebrow>
          <p className="mt-2 font-display text-lg text-ink">
            {task.completedAt
              ? formatDateLabel(task.completedAt.slice(0, 10))
              : "Selesai"}
          </p>
          <p className="mt-1 font-hand text-xl text-accent-ink">
            Nice. One less thing to worry about. ♡
          </p>
        </PaperCard>
      ) : status === "overdue" ? (
        <PaperCard className="border-accent-ink/30 bg-blush/20">
          <p className="text-ink">
            This one&apos;s still waiting — it was due {dueLabel(task.dueDate, today).toLowerCase()}.
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Nggak apa-apa. Kasih hari baru aja. ♡
          </p>
        </PaperCard>
      ) : null}

      <dl className="grid gap-4 sm:grid-cols-2">
        <Field label="Due">
          {formatDateLabel(task.dueDate)}
          {task.dueTime ? ` · ${task.dueTime}` : ""}
          <span className="block font-mono text-[11px] text-ink-faint">
            {dueLabel(task.dueDate, today)}
          </span>
        </Field>

        <Field label="Reminder">
          {task.reminders.length === 0 ? (
            <span className="text-ink-faint">Nggak ada pengingat</span>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {task.reminders.map((r) => (
                <li key={r.id}>
                  {formatInstant(r.remindAt, ctx.profile.timezone)}
                  {r.sentAt ? (
                    <span className="ml-1.5 font-mono text-[11px] text-ink-faint">
                      terkirim
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {task.notifyWhatsapp ? (
            <span className="mt-1 block font-mono text-[11px] text-ink-faint">
              juga lewat WhatsApp
            </span>
          ) : null}
        </Field>

        <Field label="For">
          {forLabel}
          {shared ? (
            <span className="mt-1 block text-sm text-ink-soft">
              {ctx.profile.nickname ?? ctx.profile.display_name} {mineDone ? "✓" : "○"}
              {" · "}
              {partner?.name ?? "Dia"} {partnerDone ? "✓" : "○"}
            </span>
          ) : null}
        </Field>

        {task.repeatKind !== "none" ? (
          <Field label="Repeat">
            {
              {
                daily: "Setiap hari",
                weekly: "Setiap minggu",
                monthly: "Setiap bulan",
                none: "",
              }[task.repeatKind]
            }
            <span className="mt-1 block font-mono text-[11px] text-ink-faint">
              yang berikutnya muncul setelah ini selesai
            </span>
          </Field>
        ) : null}
      </dl>

      {task.note ? (
        <div>
          <Eyebrow>note</Eyebrow>
          <p className="mt-2 whitespace-pre-wrap text-ink-soft">{task.note}</p>
        </div>
      ) : null}

      <TaskActions
        taskId={task.id}
        mineDone={mineDone}
        started={!!task.startedAt}
        canComplete={canComplete}
        shared={shared}
        dueDate={task.dueDate}
        dueTime={task.dueTime}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-rule-soft bg-paper p-4">
      <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
        {label}
      </dt>
      <dd className="mt-1.5 text-ink">{children}</dd>
    </div>
  );
}
