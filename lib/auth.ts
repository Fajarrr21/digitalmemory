import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database, MemberRole } from "@/lib/supabase/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type SpaceContext = {
  userId: string;
  profile: Profile;
  spaceId: string;
  role: MemberRole;
};

/** The authenticated user, or null. Always verifies the token with Supabase. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Full context for an authed page: profile + which space they belong to and
 * their role. Returns null when the user has no space yet (pre-setup).
 */
export async function getSpaceContext(): Promise<SpaceContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("space_members")
      .select("space_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
  ]);

  if (!profile || !membership) return null;

  return {
    userId: user.id,
    profile,
    spaceId: membership.space_id,
    role: membership.role,
  };
}
