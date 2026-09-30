/**
 * What did you bring to watch? — pure URL/header reasoning, no network.
 *
 * YouTube is only one of the doors. Anything else is either a direct video
 * file (which a <video> element can play, and therefore the room can
 * synchronise) or somebody else's page, which we may only show if that site
 * *allows* being shown in a frame. We read their headers and take no for an
 * answer: nothing here bypasses a site's protection.
 */

export type SourceGuess =
  /** The IFrame Player API drives it — fully synchronised. */
  | { kind: "youtube"; videoId: string; url: string }
  /** A direct video file in a <video> element — fully synchronised. */
  | { kind: "file"; url: string }
  /** A page that must be asked (over the network) whether it can be framed. */
  | { kind: "page"; url: string };

// watch?v=…, youtu.be/…, /embed/…, /shorts/…, /live/… — an id is 11 chars.
const YT_RE =
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

const VIDEO_EXT_RE = /\.(mp4|webm|ogv|ogg|m4v|mov|mkv|m3u8|mpd)(?:$|[?#])/i;

/** Only http(s) links may enter a room. Returns a tidied absolute URL, or null. */
export function normalizeUrl(input: string): string | null {
  const raw = input.trim();
  if (raw.length === 0 || raw.length > 2000) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null; // "localhost", typos, bare words
    return u.toString();
  } catch {
    return null;
  }
}

/** The YouTube video id in any of its share forms, or null. */
export function parseYouTubeId(input: string): string | null {
  const m = input.trim().match(YT_RE);
  return m ? m[1] : null;
}

/** Does this look like a file a <video> element can open directly? */
export function looksLikeVideoFile(url: string): boolean {
  try {
    const u = new URL(url);
    return VIDEO_EXT_RE.test(u.pathname) || VIDEO_EXT_RE.test(u.pathname + u.search);
  } catch {
    return VIDEO_EXT_RE.test(url);
  }
}

/** HLS/DASH play natively only in some browsers — worth saying out loud. */
export function isStreamPlaylist(url: string): boolean {
  return /\.(m3u8|mpd)(?:$|[?#])/i.test(url);
}

/**
 * First pass, offline: which door is this? A `page` verdict still has to clear
 * `framingVerdict` before it may be shown.
 */
export function classifySource(input: string): SourceGuess | null {
  const url = normalizeUrl(input);
  if (!url) return null;

  const videoId = parseYouTubeId(url);
  if (videoId) return { kind: "youtube", videoId, url };
  if (looksLikeVideoFile(url)) return { kind: "file", url };
  return { kind: "page", url };
}

/** What a server-side content-type says the thing really is. */
export function kindFromContentType(contentType: string | null): "file" | "page" | null {
  if (!contentType) return null;
  const ct = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (ct.startsWith("video/") || ct === "application/vnd.apple.mpegurl" || ct === "application/x-mpegurl")
    return "file";
  if (ct.startsWith("text/html") || ct === "application/xhtml+xml") return "page";
  return null;
}

/**
 * A readable name for the thing, out of the first chunk of a page's HTML.
 * Prefers og:title (which is what the site itself wants shown) over <title>.
 */
export function extractPageTitle(html: string): string | null {
  const og =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  const title = html.match(/<title[^>]*>([\s\S]{1,300}?)<\/title>/i);
  const raw = og?.[1] ?? title?.[1] ?? null;
  return raw ? tidyTitle(raw) : null;
}

/** The site's own poster image, if it offers one. */
export function extractOgImage(html: string, baseUrl: string): string | null {
  const m =
    html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (!m) return null;
  try {
    const u = new URL(m[1], baseUrl);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Collapse whitespace, decode the handful of entities titles actually use. */
export function tidyTitle(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .trim()
    .slice(0, 200);
}

/** Last resort when nothing tells us a name: the file or page's own slug. */
export function titleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop();
    if (!last) return u.hostname;
    const cleaned = decodeURIComponent(last)
      .replace(/\.[a-z0-9]{2,5}$/i, "")
      .replace(/[-_+]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned.length > 0 ? cleaned.slice(0, 200) : u.hostname;
  } catch {
    return "Something to watch";
  }
}

export type FramingVerdict = { allowed: boolean; reason?: string };

/**
 * May we show this page inside our room? Reads the two headers browsers
 * actually enforce. Absence of both means "nothing forbids it" — which is the
 * honest answer, not a guarantee: a site can still refuse in its own script,
 * and the room says so if the frame comes up empty.
 */
export function framingVerdict(
  headers: { xFrameOptions?: string | null; contentSecurityPolicy?: string | null },
  selfOrigin: string,
): FramingVerdict {
  const csp = (headers.contentSecurityPolicy ?? "").toLowerCase();
  const ancestors = readFrameAncestors(csp);
  if (ancestors !== null) {
    // frame-ancestors wins: it supersedes X-Frame-Options where both appear.
    return ancestors.some((src) => originMatches(src, selfOrigin))
      ? { allowed: true }
      : { allowed: false, reason: "Situs ini hanya mengizinkan dirinya dibuka di halamannya sendiri." };
  }

  const xfo = (headers.xFrameOptions ?? "").trim().toLowerCase();
  if (xfo.length === 0) return { allowed: true };
  if (xfo.startsWith("deny")) {
    return { allowed: false, reason: "Situs ini melarang videonya dibuka di dalam aplikasi lain." };
  }
  if (xfo.startsWith("sameorigin")) {
    return { allowed: false, reason: "Situs ini hanya mengizinkan dirinya dibuka di halamannya sendiri." };
  }
  if (xfo.startsWith("allow-from")) {
    const target = xfo.slice("allow-from".length).trim();
    return originMatches(target, selfOrigin)
      ? { allowed: true }
      : { allowed: false, reason: "Situs ini hanya mengizinkan satu situs tertentu membukanya." };
  }
  return { allowed: true };
}

/** The `frame-ancestors` source list, or null when the directive is absent. */
function readFrameAncestors(csp: string): string[] | null {
  if (!csp) return null;
  for (const directive of csp.split(";")) {
    const parts = directive.trim().split(/\s+/);
    if (parts[0] === "frame-ancestors") return parts.slice(1);
  }
  return null;
}

/** One CSP/XFO source expression vs our own origin. */
function originMatches(source: string, selfOrigin: string): boolean {
  const src = source.trim().replace(/^['"]|['"]$/g, "").toLowerCase();
  if (src.length === 0) return false;
  if (src === "none") return false;
  if (src === "*") return true;
  if (src === "self") return false; // "self" means *their* origin, never ours

  let self: URL;
  try {
    self = new URL(selfOrigin);
  } catch {
    return false;
  }

  const withScheme = src.includes("://") ? src : `https://${src}`;
  let allowed: URL;
  try {
    allowed = new URL(withScheme);
  } catch {
    return false;
  }

  if (allowed.protocol !== self.protocol && src.includes("://")) return false;
  if (allowed.port && allowed.port !== self.port) return false;

  const host = allowed.hostname;
  if (host === "*") return true;
  if (host.startsWith("*.")) return self.hostname.endsWith(host.slice(1));
  return host === self.hostname;
}
