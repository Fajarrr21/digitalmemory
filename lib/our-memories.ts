import "server-only";
import { createClient } from "@/lib/supabase/server";
import { signPaths } from "@/lib/media";
import type { MemoryMedia } from "@/components/memory/memory-card";

export type OurMemory = {
  id: string;
  title: string;
  description: string | null;
  memory_date: string | null;
  is_featured: boolean;
  media: MemoryMedia[];
};

/** The relationship trail, chronological (dated first in order, undated last). */
export async function getOurMemories(spaceId: string): Promise<OurMemory[]> {
  const supabase = await createClient();

  const { data: memories } = await supabase
    .from("our_memories")
    .select("id, title, description, memory_date, is_featured")
    .eq("space_id", spaceId)
    .order("memory_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (!memories || memories.length === 0) return [];

  const ids = memories.map((m) => m.id);
  const { data: media } = await supabase
    .from("media")
    .select("id, memory_id, type, storage_path, alt_text")
    .in("memory_id", ids);

  const urls = await signPaths((media ?? []).map((m) => m.storage_path));
  const byMemory = new Map<string, MemoryMedia[]>();
  for (const m of media ?? []) {
    if (!m.memory_id) continue;
    const list = byMemory.get(m.memory_id) ?? [];
    list.push({ id: m.id, type: m.type, url: urls[m.storage_path] ?? null, alt: m.alt_text });
    byMemory.set(m.memory_id, list);
  }

  return memories.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    memory_date: m.memory_date,
    is_featured: m.is_featured,
    media: byMemory.get(m.id) ?? [],
  }));
}
