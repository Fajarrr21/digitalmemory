import type { Metadata } from "next";
import { getPartner, getSpaceContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDelivery, getWork } from "@/lib/words/queries";
import { fallbackTitle } from "@/lib/words/logic";
import { CanvasStudio, type CanvasSource } from "./canvas-studio";

export const metadata: Metadata = { title: "The Canvas · little words." };

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * The Canvas. Source: a work of mine (?work=), something given to/by me
 * (?delivery=), a kept line (?line=), optionally narrowed to an excerpt
 * (&text=). With none, a blank card to type on.
 */
export default async function CanvasPage({
  searchParams,
}: {
  searchParams: Promise<{ work?: string; delivery?: string; line?: string; text?: string }>;
}) {
  const ctx = await getSpaceContext();
  if (!ctx) return null;
  const sp = await searchParams;
  const selfName = ctx.profile.nickname || ctx.profile.display_name;
  let source: CanvasSource = { key: "blank", title: "", text: "", author: selfName, backHref: "/words" };

  if (sp.work && UUID.test(sp.work)) {
    const d = await getWork(sp.work, ctx.userId);
    if (d) {
      source = {
        key: `work:${d.work.id}`,
        title: d.work.title || fallbackTitle(d.work.content),
        text: d.work.content,
        author: selfName,
        backHref: `/words/w/${d.work.id}`,
      };
    }
  } else if (sp.delivery && UUID.test(sp.delivery)) {
    const d = await getDelivery(sp.delivery, ctx.userId);
    if (d) {
      const partner = await getPartner(ctx.spaceId, ctx.userId);
      source = {
        key: `delivery:${d.delivery.id}`,
        title: d.delivery.title,
        text: d.delivery.content,
        author: d.delivery.sender_id === ctx.userId ? selfName : (partner?.name ?? ""),
        backHref: `/words/to-you/${d.delivery.id}`,
      };
    }
  } else if (sp.line && UUID.test(sp.line)) {
    const supabase = await createClient();
    const { data } = await supabase.from("literary_lines").select("*").eq("id", sp.line).eq("user_id", ctx.userId).maybeSingle();
    if (data) {
      source = { key: `line:${data.id}`, title: data.source_title ?? "", text: data.text, author: "", backHref: "/words/lines" };
    }
  }

  // An excerpt chosen in the reader, only if it really comes from the source.
  if (sp.text && source.key !== "blank") {
    const excerpt = sp.text.slice(0, 600).trim();
    const flat = (s: string) => s.replace(/\s+/g, " ").trim();
    if (excerpt && flat(source.text).includes(flat(excerpt))) source = { ...source, key: `${source.key}:excerpt`, text: excerpt };
  }

  return <CanvasStudio source={source} selfName={selfName} />;
}
