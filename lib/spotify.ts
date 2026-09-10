/**
 * Lightweight Spotify link helpers — no API key needed. We only ever render the
 * official embed player (which shows cover/title/artist and plays a preview), so
 * all we need from a shared link is the track id.
 */

// Matches the common share forms:
//   https://open.spotify.com/track/<id>        (optionally ?si=…)
//   https://open.spotify.com/intl-id/track/<id> (localized path)
//   spotify:track:<id>
// A Spotify track id is 22 base62 characters.
const TRACK_RE = /(?:open\.spotify\.com\/(?:intl-[a-z]{2}\/)?track\/|spotify:track:)([A-Za-z0-9]{22})/;

/** Extract the track id from any Spotify track link/URI, or null if it isn't one. */
export function parseSpotifyTrackId(input: string): string | null {
  const m = input.trim().match(TRACK_RE);
  return m ? m[1] : null;
}

/** The embeddable player URL for a track id. */
export function spotifyEmbedUrl(trackId: string): string {
  return `https://open.spotify.com/embed/track/${trackId}`;
}
