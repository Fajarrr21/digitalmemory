import type { Metadata } from "next";
import { getSpaceContext } from "@/lib/auth";
import { aiConfigured } from "@/lib/words/ai";
import { getWork } from "@/lib/words/queries";
import { Rewrite } from "./rewrite";

export const metadata: Metadata = { title: "The Rewrite · little words." };

export default async function RewritePage({ searchParams }: { searchParams: Promise<{ work?: string }> }) {
  const ctx = await getSpaceContext();
  if (!ctx) return null;
  const { work: workId } = await searchParams;
  const detail = workId && /^[0-9a-f-]{36}$/i.test(workId) ? await getWork(workId, ctx.userId) : null;
  const w = detail?.work;
  return (
    <Rewrite
      aiReady={aiConfigured()}
      source={
        w
          ? {
              id: w.id,
              title: w.title,
              content: w.content,
              workType: w.work_type,
              language: w.language,
              depth: w.literary_depth,
              genre: w.genre,
              mood: w.mood,
              style: w.style,
              theme: w.theme,
            }
          : null
      }
    />
  );
}
