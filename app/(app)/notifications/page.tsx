import Link from "next/link";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { formatInstant } from "@/lib/date";
import { getNotifications, type Notice } from "@/lib/notifications";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { DismissNudge } from "./dismiss-nudge";

export const metadata = { title: "Notifications" };

/**
 * 🔔 — everything quietly waiting, in one place. Nothing here is louder than
 * it needs to be: a reminder, a letter, a flame that needs one more person.
 */
export default async function NotificationsPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const partner = await getPartner(ctx.spaceId, ctx.userId);
  const feed = await getNotifications(
    ctx.spaceId,
    ctx.userId,
    partner?.id ?? null,
    ctx.profile.timezone,
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Eyebrow>🔔 notifications</Eyebrow>
        <h1 className="mt-2 font-display text-3xl font-medium text-ink">
          Little things waiting for you.
        </h1>
      </header>

      <section className="flex flex-col gap-3">
        <Eyebrow>today</Eyebrow>
        {feed.now.length === 0 ? (
          <PaperCard className="border-dashed text-center">
            <p className="font-hand text-xl text-accent-ink">all quiet ♡</p>
            <p className="mt-1 text-sm text-ink-soft">
              Nggak ada yang nunggu kamu sekarang.
            </p>
          </PaperCard>
        ) : (
          feed.now.map((notice) => (
            <NoticeRow key={notice.id} notice={notice} timezone={ctx.profile.timezone} />
          ))
        )}
      </section>

      {feed.earlier.length > 0 ? (
        <section className="flex flex-col gap-3 border-t border-rule-soft pt-5">
          <Eyebrow className="text-ink-faint">earlier</Eyebrow>
          {feed.earlier.map((notice) => (
            <NoticeRow
              key={notice.id}
              notice={notice}
              timezone={ctx.profile.timezone}
              muted
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function NoticeRow({
  notice,
  timezone,
  muted = false,
}: {
  notice: Notice;
  timezone: string;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${
        muted ? "border-rule-soft bg-transparent" : "border-rule bg-paper"
      }`}
    >
      <span aria-hidden className="mt-0.5 text-lg">
        {notice.emoji}
      </span>
      <Link href={notice.href} className="min-w-0 flex-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
          {notice.label}
        </p>
        <p className={`mt-0.5 ${muted ? "text-ink-soft" : "text-ink"}`}>{notice.title}</p>
        <p className="mt-0.5 text-sm text-ink-faint">
          {notice.detail}
          {notice.detail ? " · " : ""}
          {formatInstant(notice.at, timezone)}
        </p>
      </Link>
      {notice.reminderId ? <DismissNudge reminderId={notice.reminderId} /> : null}
    </div>
  );
}
