/**
 * The official YouTube IFrame Player API, loaded once per page.
 *
 * Two places drive a real YouTube player: Our Soundtrack (a hidden audio-only
 * player behind the now-playing card) and a Watch Room (where both people's
 * players are kept on the same second). They share these types and this loader
 * so the `window.YT` global is declared in exactly one place.
 */

export type YTPlayer = {
  loadVideoById: (o: { videoId: string; startSeconds?: number }) => void;
  cueVideoById?: (o: { videoId: string; startSeconds?: number }) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState?: () => number;
  mute?: () => void;
  unMute?: () => void;
  setVolume?: (volume: number) => void;
  destroy: () => void;
};

export type YTPlayerOptions = {
  videoId?: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: () => void;
    onStateChange?: (e: { data: number }) => void;
    onError?: (e: { data: number }) => void;
  };
};

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement, opts: YTPlayerOptions) => YTPlayer;
      PlayerState: {
        UNSTARTED?: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING?: number;
        CUED?: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

const SCRIPT_ID = "yt-iframe-api";

/** Inject the API script at most once, then call back when it's usable. */
export function whenYouTubeApiReady(cb: () => void): void {
  if (typeof window === "undefined") return;
  if (window.YT?.Player) {
    cb();
    return;
  }
  // Chain onto any listener already waiting — several players may load at once.
  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    prev?.();
    cb();
  };
  if (!document.getElementById(SCRIPT_ID)) {
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(s);
  }
}
