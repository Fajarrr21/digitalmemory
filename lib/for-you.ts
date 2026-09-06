import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ForYouMessage = {
  id: string;
  title: string;
  body: string;
  opened_at: string | null;
  author_id: string;
};

export async function getForYouMessages(spaceId: string): Promise<ForYouMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("special_messages")
    .select("id, title, body, opened_at, author_id")
    .eq("space_id", spaceId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getKeeperId(spaceId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("space_members")
    .select("user_id")
    .eq("space_id", spaceId)
    .eq("role", "keeper")
    .maybeSingle();
  return data?.user_id ?? null;
}
