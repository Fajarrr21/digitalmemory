import Link from "next/link";
import { getSpaceContext, getPartner } from "@/lib/auth";
import { getFlameData } from "@/lib/flame";
import { signPaths } from "@/lib/media";
import { createClient } from "@/lib/supabase/server";
import { FlameView } from "./flame-view";

export const metadata = { title: "Our Little Flame" };

export default async function FlamePage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const partner = await getPartner(ctx.spaceId, ctx.userId);
  const data = await getFlameData(
    ctx.spaceId,
    ctx.userId,
    partner?.id ?? null,
    ctx.profile.timezone,
  );

  // Avatars for the milestone share card (signed, long enough to draw with).
  const supabase = await createClient();
  const { data: partnerProfile } = partner
    ? await supabase.from("profiles").select("avatar_path").eq("id", partner.id).maybeSingle()
    : { data: null };
  const paths = [ctx.profile.avatar_path, partnerProfile?.avatar_path].filter(
    (p): p is string => !!p,
  );
  const signed = await signPaths(paths, 3600);

  const youName = ctx.profile.nickname || ctx.profile.display_name;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/profile" className="text-sm text-accent-ink hover:underline">
          ← Profile
        </Link>
        <h1 className="mt-2 font-display text-3xl font-medium text-ink">
          🔥 Our Little Flame
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Two people. One little flame. We just have to keep showing up.
        </p>
      </div>

      <FlameView
        state={data.state}
        today={data.today}
        flameDays={data.flameDays}
        bridgedDays={data.bridgedDays}
        recoveriesLeft={data.recoveriesLeft}
        youName={youName}
        partnerName={partner?.name ?? "Dia"}
        youAvatarUrl={ctx.profile.avatar_path ? (signed[ctx.profile.avatar_path] ?? null) : null}
        partnerAvatarUrl={
          partnerProfile?.avatar_path ? (signed[partnerProfile.avatar_path] ?? null) : null
        }
      />
    </div>
  );
}
