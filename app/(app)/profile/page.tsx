import { getSpaceContext } from "@/lib/auth";
import { PaperCard } from "@/components/ui/paper-card";
import { Eyebrow } from "@/components/ui/eyebrow";

export default async function ProfilePage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const p = ctx.profile;
  const rows: [string, string][] = [
    ["Name", p.display_name],
    ["Nickname", p.nickname ?? "—"],
    ["Birthday", p.birthday ?? "—"],
    ["Timezone", p.timezone],
    ["Role in your space", ctx.role],
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Eyebrow>a little about you</Eyebrow>
        <h1 className="mt-2 font-display text-3xl font-medium text-ink">
          Profile
        </h1>
      </div>

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

      <p className="text-sm text-ink-faint">
        Editing your details, theme, and reminders arrives with Settings (Phase 7).
        Theme can be changed any time from the toggle up top.
      </p>

      <form action="/auth/sign-out" method="post">
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
