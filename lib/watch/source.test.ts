import { describe, expect, it } from "vitest";
import {
  classifySource,
  extractOgImage,
  extractPageTitle,
  framingVerdict,
  isStreamPlaylist,
  kindFromContentType,
  looksLikeVideoFile,
  normalizeUrl,
  parseYouTubeId,
  tidyTitle,
  titleFromUrl,
} from "./source";

const SELF = "https://digitalmemory-two.vercel.app";

describe("normalizeUrl", () => {
  it("accepts a plain https link", () => {
    expect(normalizeUrl(" https://example.com/watch/12 ")).toBe("https://example.com/watch/12");
  });

  it("assumes https when someone pastes a bare host", () => {
    expect(normalizeUrl("example.com/watch/12")).toBe("https://example.com/watch/12");
  });

  it("refuses anything that isn't http(s)", () => {
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("ftp://example.com/a.mp4")).toBeNull();
  });

  it("refuses empty input and bare words", () => {
    expect(normalizeUrl("   ")).toBeNull();
    expect(normalizeUrl("jujutsu kaisen")).toBeNull();
  });
});

describe("parseYouTubeId", () => {
  it("reads every share form", () => {
    const id = "dQw4w9WgXcQ";
    expect(parseYouTubeId(`https://www.youtube.com/watch?v=${id}`)).toBe(id);
    expect(parseYouTubeId(`https://www.youtube.com/watch?list=x&v=${id}&t=30s`)).toBe(id);
    expect(parseYouTubeId(`https://youtu.be/${id}?si=abc`)).toBe(id);
    expect(parseYouTubeId(`https://www.youtube.com/embed/${id}`)).toBe(id);
    expect(parseYouTubeId(`https://www.youtube.com/shorts/${id}`)).toBe(id);
    expect(parseYouTubeId(`https://www.youtube.com/live/${id}`)).toBe(id);
  });

  it("is null for anything else", () => {
    expect(parseYouTubeId("https://example.com/watch/12")).toBeNull();
  });
});

describe("looksLikeVideoFile", () => {
  it("recognises a direct file, query string and all", () => {
    expect(looksLikeVideoFile("https://cdn.example.com/a/ep12.mp4")).toBe(true);
    expect(looksLikeVideoFile("https://cdn.example.com/a/ep12.webm?token=xyz")).toBe(true);
    expect(looksLikeVideoFile("https://cdn.example.com/hls/master.m3u8")).toBe(true);
  });

  it("does not mistake a page for a file", () => {
    expect(looksLikeVideoFile("https://example.com/watch/episode-12")).toBe(false);
  });
});

describe("isStreamPlaylist", () => {
  it("flags HLS/DASH, which only some browsers play natively", () => {
    expect(isStreamPlaylist("https://x.com/a.m3u8")).toBe(true);
    expect(isStreamPlaylist("https://x.com/a.mpd")).toBe(true);
    expect(isStreamPlaylist("https://x.com/a.mp4")).toBe(false);
  });
});

describe("classifySource", () => {
  it("routes a YouTube link to the player API", () => {
    expect(classifySource("youtu.be/dQw4w9WgXcQ")).toEqual({
      kind: "youtube",
      videoId: "dQw4w9WgXcQ",
      url: "https://youtu.be/dQw4w9WgXcQ",
    });
  });

  it("routes a direct file to <video>", () => {
    expect(classifySource("https://cdn.example.com/ep12.mp4")).toEqual({
      kind: "file",
      url: "https://cdn.example.com/ep12.mp4",
    });
  });

  it("sends anything else off to be asked about framing", () => {
    expect(classifySource("https://example.com/watch/episode-12")).toEqual({
      kind: "page",
      url: "https://example.com/watch/episode-12",
    });
  });

  it("is null for input that isn't a link at all", () => {
    expect(classifySource("nonton bareng dong")).toBeNull();
  });
});

describe("kindFromContentType", () => {
  it("reads video and HTML", () => {
    expect(kindFromContentType("video/mp4")).toBe("file");
    expect(kindFromContentType("application/x-mpegURL")).toBe("file");
    expect(kindFromContentType("text/html; charset=utf-8")).toBe("page");
  });

  it("has no opinion about anything else", () => {
    expect(kindFromContentType("application/json")).toBeNull();
    expect(kindFromContentType(null)).toBeNull();
  });
});

describe("extractPageTitle", () => {
  it("prefers what the site itself wants shown", () => {
    const html = `<title>example.com</title><meta property="og:title" content="Jujutsu Kaisen &#8212; Episode 12">`;
    expect(extractPageTitle(html)).toBe("Jujutsu Kaisen &#8212; Episode 12");
  });

  it("falls back to <title>", () => {
    expect(extractPageTitle("<head><title>  Episode\n 12  </title></head>")).toBe("Episode 12");
  });

  it("decodes the entities titles actually use", () => {
    expect(extractPageTitle("<title>Tom &amp; Jerry &quot;S1&quot;</title>")).toBe(
      'Tom & Jerry "S1"',
    );
  });

  it("is null when the page names itself nowhere", () => {
    expect(extractPageTitle("<html><body>hi</body></html>")).toBeNull();
  });
});

describe("extractOgImage", () => {
  it("resolves a relative poster against the page", () => {
    expect(
      extractOgImage(`<meta property="og:image" content="/img/ep12.jpg">`, "https://example.com/a/b"),
    ).toBe("https://example.com/img/ep12.jpg");
  });

  it("ignores a poster that isn't http(s)", () => {
    expect(
      extractOgImage(`<meta property="og:image" content="data:image/png;base64,AAA">`, "https://e.com"),
    ).toBeNull();
  });

  it("is null when there is none", () => {
    expect(extractOgImage("<html></html>", "https://e.com")).toBeNull();
  });
});

describe("tidyTitle", () => {
  it("caps a runaway title", () => {
    expect(tidyTitle("x".repeat(400)).length).toBe(200);
  });
});

describe("titleFromUrl", () => {
  it("reads the slug when nothing else names the thing", () => {
    expect(titleFromUrl("https://example.com/watch/jujutsu-kaisen-ep-12")).toBe(
      "jujutsu kaisen ep 12",
    );
    expect(titleFromUrl("https://cdn.example.com/files/ep12.mp4")).toBe("ep12");
  });

  it("falls back to the host for a bare domain", () => {
    expect(titleFromUrl("https://example.com/")).toBe("example.com");
  });
});

describe("framingVerdict", () => {
  it("allows a page that says nothing about framing", () => {
    expect(framingVerdict({}, SELF).allowed).toBe(true);
  });

  it("takes X-Frame-Options for an answer", () => {
    expect(framingVerdict({ xFrameOptions: "DENY" }, SELF).allowed).toBe(false);
    expect(framingVerdict({ xFrameOptions: "SAMEORIGIN" }, SELF).allowed).toBe(false);
  });

  it("explains itself when it says no", () => {
    expect(framingVerdict({ xFrameOptions: "DENY" }, SELF).reason).toBeTruthy();
  });

  it("honours ALLOW-FROM only for the named site", () => {
    expect(
      framingVerdict({ xFrameOptions: "ALLOW-FROM https://digitalmemory-two.vercel.app" }, SELF)
        .allowed,
    ).toBe(true);
    expect(framingVerdict({ xFrameOptions: "ALLOW-FROM https://elsewhere.com" }, SELF).allowed).toBe(
      false,
    );
  });

  it("reads CSP frame-ancestors", () => {
    expect(
      framingVerdict({ contentSecurityPolicy: "frame-ancestors 'none'" }, SELF).allowed,
    ).toBe(false);
    expect(framingVerdict({ contentSecurityPolicy: "frame-ancestors *" }, SELF).allowed).toBe(true);
    expect(
      framingVerdict(
        { contentSecurityPolicy: "default-src 'self'; frame-ancestors 'self' https://*.vercel.app" },
        SELF,
      ).allowed,
    ).toBe(true);
  });

  it("does not read their 'self' as our origin", () => {
    expect(
      framingVerdict({ contentSecurityPolicy: "frame-ancestors 'self'" }, SELF).allowed,
    ).toBe(false);
  });

  it("lets frame-ancestors override a stricter X-Frame-Options, as browsers do", () => {
    expect(
      framingVerdict(
        { xFrameOptions: "DENY", contentSecurityPolicy: "frame-ancestors *" },
        SELF,
      ).allowed,
    ).toBe(true);
  });

  it("does not match a different host that merely ends the same way", () => {
    expect(
      framingVerdict(
        { contentSecurityPolicy: "frame-ancestors https://notdigitalmemory-two.vercel.app" },
        SELF,
      ).allowed,
    ).toBe(false);
  });
});
