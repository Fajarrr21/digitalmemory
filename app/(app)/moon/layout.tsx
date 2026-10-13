import { getSpaceContext } from "@/lib/auth";
import { MoonTabs } from "./moon-tabs";
import { MOON_TAGLINE, MOON_TITLE } from "./moon-config";

/**
 * her little moon. — her tracker for the keeper; for the author /moon is only
 * the partner view (what she chose to share), so no tabs for him.
 */
export default async function MoonLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getSpaceContext();
  const isHers = ctx?.role === "keeper";
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="font-display text-3xl font-medium text-ink">{MOON_TITLE}</h1>
        {isHers ? <p className="mt-1 text-sm text-ink-soft">{MOON_TAGLINE}</p> : null}
      </header>
      {isHers ? <MoonTabs /> : null}
      {children}
    </div>
  );
}
