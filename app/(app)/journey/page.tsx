import { getPartner, getSpaceContext } from "@/lib/auth";
import { getJourney } from "@/lib/journey/queries";
import { Journey } from "./journey";
import { STARTED_ON } from "./journey-config";

// 🌙 Sejauh Ini, Kita — a story of how two people became "us". Full-screen and
// cinematic like /road and /someday, but alive: every footprint on the road is
// read from the rest of the app, so the road gets longer by itself whenever
// either of you lives a little inside it. Entry is the Home card.
export default async function JourneyPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null; // layout handles the pre-setup state

  const partner = await getPartner(ctx.spaceId, ctx.userId);
  const data = await getJourney(
    {
      spaceId: ctx.spaceId,
      userId: ctx.userId,
      partnerId: partner?.id ?? null,
      timezone: ctx.profile.timezone,
    },
    STARTED_ON,
  );

  return (
    <Journey
      data={data}
      me={{ id: ctx.userId, name: ctx.profile.nickname || ctx.profile.display_name }}
      partner={partner}
    />
  );
}
