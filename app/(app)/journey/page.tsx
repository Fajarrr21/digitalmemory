import { getPartner, getSpaceContext } from "@/lib/auth";
import { getJourney } from "@/lib/journey/queries";
import { signPaths } from "@/lib/media";
import { Journey } from "./journey";
import { STARTED_ON } from "./journey-config";
import { STORY_MEDIA_KEYS } from "./story-config";

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

  // Foto & video cerita awal kita ada di Storage privat ({space_id}/journey-story/…),
  // jadi cuma anggota space yang bisa membukanya. Yang belum di-upload dilewati.
  const prefix = `${ctx.spaceId}/`;
  const signed = await signPaths(STORY_MEDIA_KEYS.map((k) => prefix + k), 6 * 3600);
  const storyMedia = Object.fromEntries(
    Object.entries(signed).map(([path, url]) => [path.slice(prefix.length), url]),
  );

  return (
    <Journey
      data={data}
      me={{ id: ctx.userId, name: ctx.profile.nickname || ctx.profile.display_name }}
      partner={partner}
      storyMedia={storyMedia}
    />
  );
}
