import { getSpaceContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { localDateISO } from "@/lib/date";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { ReflectionForm, type ReflectionValues } from "./reflection-form";

export default async function ReflectPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const today = localDateISO(ctx.profile.timezone);
  const supabase = await createClient();
  const { data } = await supabase
    .from("night_reflections")
    .select("q_today, q_smile, q_hard, q_release, q_grateful")
    .eq("user_id", ctx.userId)
    .eq("reflection_date", today)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>before you sleep</Eyebrow>
        <h1 className="mt-2 font-display text-3xl font-medium text-ink text-balance">
          Refleksi malam
        </h1>
        <p className="mt-1 text-ink-soft">
          Pelan-pelan aja. Nggak harus semua diisi — seperlunya kamu. ♡
        </p>
      </div>

      <PaperCard>
        <ReflectionForm existing={(data ?? {}) as ReflectionValues} />
      </PaperCard>
    </div>
  );
}
