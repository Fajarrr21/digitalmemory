import Link from "next/link";
import { getSpaceContext, getPartner } from "@/lib/auth";
import { getFlameData } from "@/lib/flame";
import { signPaths } from "@/lib/media";
import { PaperCard } from "@/components/ui/paper-card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Flame } from "@/components/flame/flame";
import { ProfilePhoto } from "./profile-photo";
import { EditProfile } from "./edit-profile";

export default async function ProfilePage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const p = ctx.profile;
  const partner = await getPartner(ctx.spaceId, ctx.userId);
  const flame = await getFlameData(
    ctx.spaceId,
    ctx.userId,
    partner?.id ?? null,
    p.timezone,
  );

  const avatarUrl = p.avatar_path
    ? ((await signPaths([p.avatar_path]))[p.avatar_path] ?? null)
    : null;

  const rows: [string, string][] = [
    ["Name", p.display_name],
    ["Nickname", p.nickname ?? "—"],
    ["Birthday", p.birthday ?? "—"],
    ["Timezone", p.timezone],
    ["Role in your space", ctx.role],
  ];

  const { state } = flame;
  const flameLine =
    state.status === "lit"
      ? "We've been showing up for each other."
      : state.status === "waiting"
        ? "🕯️ Waiting for one more today…"
        : state.status === "quiet"
          ? "The flame went quiet — it can still be lit again."
          : "A new flame can always be lit.";

  return (
    <div className="flex flex-col gap-6">
      {/* who you are */}
      <div className="flex flex-col items-center gap-2 text-center">
        <ProfilePhoto
          spaceId={ctx.spaceId}
          userId={ctx.userId}
          avatarUrl={avatarUrl}
          name={p.nickname || p.display_name}
        />
        <h1 className="font-display text-3xl font-medium text-ink">{p.display_name}</h1>
        {p.nickname ? (
          <p className="font-hand text-xl text-accent-ink">“{p.nickname}”</p>
        ) : null}
      </div>

      {/* Our Little Flame */}
      <Link href="/flame" className="group block">
        <PaperCard
          lift
          className="relative overflow-hidden bg-gradient-to-br from-blush/30 to-paper text-center transition group-hover:-translate-y-0.5"
        >
          <Eyebrow>🔥 our little flame</Eyebrow>
          <div className="mt-2 flex items-center justify-center">
            <Flame streak={state.streak} quiet={state.streak === 0} size={92} />
          </div>
          <p className="mt-1 font-display text-4xl font-medium text-ink">
            {state.streak}
            <span className="ml-2 align-middle font-mono text-sm text-ink-faint">
              {state.streak === 1 ? "day" : "days"}
            </span>
          </p>
          <p className="mt-2 text-sm text-ink-soft">{flameLine}</p>
          <p className="mt-3 flex items-center justify-center gap-4 text-sm">
            <span className={state.todayYou ? "text-accent-ink" : "text-ink-faint"}>
              {p.nickname || p.display_name} {state.todayYou ? "✓" : "·"}
            </span>
            <span className={state.todayPartner ? "text-accent-ink" : "text-ink-faint"}>
              {partner?.name ?? "Dia"} {state.todayPartner ? "✓" : "·"}
            </span>
          </p>
          <p className="mt-4 text-sm text-accent-ink group-hover:underline">View Streak →</p>
        </PaperCard>
      </Link>

      {/* about */}
      <section className="flex flex-col gap-2">
        <Eyebrow>a little about you</Eyebrow>
        <PaperCard>
          <dl className="divide-y divide-rule-soft">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 py-3">
                <dt className="text-sm text-ink-soft">{k}</dt>
                <dd className="text-right text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </PaperCard>
        <div className="mt-2 flex justify-center">
          <EditProfile
            displayName={p.display_name}
            nickname={p.nickname}
            birthday={p.birthday}
          />
        </div>
      </section>

      <form action="/auth/sign-out" method="post" className="text-center">
        <button
          type="submit"
          className="text-sm text-danger underline underline-offset-4"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
