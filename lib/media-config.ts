/** Media limits & validation — plain module, shared by client and server. */

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB (before compression)
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // 20 MB (a very long voice note)
export const MAX_FILES_PER_ACTIVITY = 8;
export const MAX_VOICE_SECONDS = 300; // 5 min cap on a single voice note

export const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const VIDEO_MIME = ["video/mp4", "video/webm", "video/quicktime"];

/** For the file input's `accept` attribute. */
export const ACCEPT_ATTR = [...IMAGE_MIME, ...VIDEO_MIME].join(",");

export type MediaKind = "image" | "video";

export function classify(mime: string): MediaKind | null {
  if (IMAGE_MIME.includes(mime)) return "image";
  if (VIDEO_MIME.includes(mime)) return "video";
  return null;
}

export function validateFile(file: { type: string; size: number }): {
  ok: boolean;
  kind?: MediaKind;
  error?: string;
} {
  const kind = classify(file.type);
  if (!kind) return { ok: false, error: "Format ini belum didukung — coba JPG, PNG, WebP, atau MP4." };
  if (kind === "image" && file.size > MAX_IMAGE_BYTES)
    return { ok: false, error: "Fotonya kegedean (maks 10 MB)." };
  if (kind === "video" && file.size > MAX_VIDEO_BYTES)
    return { ok: false, error: "Videonya kegedean (maks 50 MB)." };
  return { ok: true, kind };
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

export function extFromMime(mime: string): string {
  // MediaRecorder mimes carry a codecs param, e.g. "audio/webm;codecs=opus".
  const base = mime.split(";")[0].trim();
  return EXT[base] ?? "bin";
}
