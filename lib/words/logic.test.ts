import { describe, expect, it } from "vitest";
import {
  deliveryState,
  diffWords,
  excerpt,
  expandToWords,
  fallbackTitle,
  filterLibrary,
  keptRatio,
  nextBirthdayISO,
  spliceSelection,
  type LibraryItem,
} from "./logic";

describe("diffWords", () => {
  it("rebuilds both sides exactly", () => {
    const a = "Aku senang mengenalmu.\nHal kecil darimu membuat hariku baik.";
    const b = "Aku bersyukur mengenalmu.\nHal-hal kecil darimu membuat hariku lebih terang.";
    const parts = diffWords(a, b);
    expect(parts.filter((p) => p.type !== "add").map((p) => p.text).join("")).toBe(a);
    expect(parts.filter((p) => p.type !== "del").map((p) => p.text).join("")).toBe(b);
    expect(parts.some((p) => p.type === "add" && p.text.includes("bersyukur"))).toBe(true);
    expect(parts.some((p) => p.type === "del" && p.text.includes("senang"))).toBe(true);
  });

  it("identical text is all same", () => {
    expect(diffWords("sama saja", "sama saja")).toEqual([{ type: "same", text: "sama saja" }]);
  });

  it("keptRatio", () => {
    expect(keptRatio("satu dua tiga empat", "satu dua tiga empat")).toBe(1);
    expect(keptRatio("satu dua tiga empat", "lima enam")).toBe(0);
  });
});

describe("selection", () => {
  it("splices a replacement into place", () => {
    const t = "Kalimat pertama. Kalimat kedua. Kalimat ketiga.";
    const s = t.indexOf("Kalimat kedua.");
    expect(spliceSelection(t, s, s + "Kalimat kedua.".length, "Baris yang baru.")).toBe(
      "Kalimat pertama. Baris yang baru. Kalimat ketiga.",
    );
  });

  it("widens a partial selection to whole words and trims spaces", () => {
    const t = "hari ini indah sekali ya";
    const r = expandToWords(t, t.indexOf("ndah"), t.indexOf("sek") + 3);
    expect(t.slice(r.start, r.end)).toBe("indah sekali");
    const r2 = expandToWords(t, 4, 9); // " ini " with spaces
    expect(t.slice(r2.start, r2.end)).toBe("ini");
  });
});

describe("deliveryState", () => {
  const now = new Date("2026-11-04T10:00:00Z");
  it("locked until unlock_at", () => {
    expect(deliveryState({ unlock_at: "2026-11-05T00:00:00Z", opened_at: null, open_when: "birthday" }, now)).toBe("locked");
  });
  it("sealed when open-when and unopened", () => {
    expect(deliveryState({ unlock_at: null, opened_at: null, open_when: "miss_me" }, now)).toBe("sealed");
    expect(deliveryState({ unlock_at: "2026-11-01T00:00:00Z", opened_at: null, open_when: "birthday" }, now)).toBe("sealed");
  });
  it("new / opened", () => {
    expect(deliveryState({ unlock_at: null, opened_at: null, open_when: null }, now)).toBe("new");
    expect(deliveryState({ unlock_at: null, opened_at: "2026-11-02T00:00:00Z", open_when: "tired" }, now)).toBe("opened");
  });
});

describe("nextBirthdayISO", () => {
  it("this year if still ahead, next year if passed", () => {
    expect(nextBirthdayISO("2003-12-20", "2026-11-04")).toBe("2026-12-20");
    expect(nextBirthdayISO("2003-03-01", "2026-11-04")).toBe("2027-03-01");
    expect(nextBirthdayISO("2003-11-04", "2026-11-04")).toBe("2026-11-04");
  });
  it("Feb 29 falls back to Feb 28 in a common year", () => {
    expect(nextBirthdayISO("2004-02-29", "2026-11-04")).toBe("2027-02-28");
  });
  it("null without a birthday", () => {
    expect(nextBirthdayISO(null, "2026-11-04")).toBeNull();
  });
});

describe("filterLibrary", () => {
  const base: Omit<LibraryItem, "id" | "title" | "content" | "work_type" | "date"> = {
    source: "work",
    genre: null,
    mood: null,
    status: "finished",
    favorite: false,
    author: "me",
    mine: true,
    updated: "2026-11-01",
    sentCount: 0,
    href: "#",
  };
  const items: LibraryItem[] = [
    { ...base, id: "1", title: "Hujan Pertama", content: "kau datang seperti hujan", work_type: "poetry", date: "2026-10-01", genre: "longing" },
    { ...base, id: "2", title: "Surat Pagi", content: "selamat pagi", work_type: "letter", date: "2026-11-02", status: "draft" },
    { ...base, id: "3", title: "Kopi", content: "kopi dan rindú", work_type: "prose", date: "2026-09-12", favorite: true },
    {
      ...base,
      id: "4",
      source: "received",
      title: "Untukmu",
      content: "dari jauh",
      work_type: "poetry",
      date: "2026-11-03",
      status: "received",
      mine: false,
      author: "Gita",
    },
  ];
  const ids = (xs: LibraryItem[]) => xs.map((x) => x.id);

  it("categories", () => {
    expect(ids(filterLibrary(items, { category: "all" }))).toEqual(["4", "2", "1", "3"]);
    expect(ids(filterLibrary(items, { category: "poetry" }))).toEqual(["1"]); // mine only
    expect(ids(filterLibrary(items, { category: "for_you" }))).toEqual(["4"]);
    expect(ids(filterLibrary(items, { category: "drafts" }))).toEqual(["2"]);
    expect(ids(filterLibrary(items, { category: "favorites" }))).toEqual(["3"]);
  });

  it("search ignores case and accents, across title/content/author", () => {
    expect(ids(filterLibrary(items, { category: "all", query: "RINDU" }))).toEqual(["3"]);
    expect(ids(filterLibrary(items, { category: "all", query: "gita" }))).toEqual(["4"]);
    expect(ids(filterLibrary(items, { category: "all", query: "hujan pertama" }))).toEqual(["1"]);
  });

  it("filters + sorts", () => {
    expect(ids(filterLibrary(items, { category: "all", genre: "longing" }))).toEqual(["1"]);
    expect(ids(filterLibrary(items, { category: "all", author: "partner" }))).toEqual(["4"]);
    expect(ids(filterLibrary(items, { category: "all", month: "2026-11" }))).toEqual(["4", "2"]);
    expect(ids(filterLibrary(items, { category: "all", sort: "oldest" }))).toEqual(["3", "1", "2", "4"]);
    expect(ids(filterLibrary(items, { category: "all", sort: "favorites" }))[0]).toBe("3");
  });
});

describe("bits", () => {
  it("excerpt flattens lines and cuts on a word", () => {
    expect(excerpt("baris satu\nbaris dua")).toBe("baris satu / baris dua");
    expect(excerpt("a ".repeat(200), 20).endsWith("…")).toBe(true);
  });
  it("fallbackTitle", () => {
    expect(fallbackTitle("Kau datang seperti hujan pertama yang tak sempat,\nlagi")).toBe("Kau datang seperti hujan pertama yang");
    expect(fallbackTitle("   ")).toBe("Tanpa judul");
  });
});
