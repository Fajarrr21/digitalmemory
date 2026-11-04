import { describe, expect, it } from "vitest";
import { checkAlternatives, checkPiece, clicheCounts, jaccard, needsRepair, wordCount } from "./quality";

const POEM = `Kau datang seperti hujan pertama
yang tak sempat kuberi nama,
membasahi jendela
yang lama kubiarkan berdebu.

Aku belajar membaca cuaca
dari caramu tertawa —
cerah yang tak pernah meminta
apa pun kembali.`;

const codes = (t: string, ctx: Parameters<typeof checkPiece>[1]) => checkPiece(t, ctx).map((i) => i.code);

describe("clichés", () => {
  it("counts stems and phrases", () => {
    const c = clicheCounts("Senja itu, semestaku runtuh. Senjanya jingga. Kau belahan jiwa.");
    expect(c.senja).toBe(2);
    expect(c.semesta).toBe(1);
    expect(c.jingga).toBe(1);
  });

  it("flags overuse for repair, a single one only as a note", () => {
    const heavy = checkPiece("Di bawah senja, semesta diam.\nSamudra memanggil.\nRembulan pun ikut.", {
      workType: "poetry",
      language: "id",
    });
    expect(heavy.find((i) => i.code === "cliche")?.severity).toBe("repair");
    const light = checkPiece(POEM.replace("hujan pertama", "senja pertama"), { workType: "poetry", language: "id" });
    expect(light.find((i) => i.code === "cliche")?.severity).toBe("note");
  });

  it("in a rewrite, only flags clichés the rewrite introduced", () => {
    const original = "Aku suka senja bersamamu.";
    const kept = checkPiece("Aku menyukai senja yang kita bagi.", { workType: "prose", language: "id", original });
    expect(kept.some((i) => i.code === "cliche")).toBe(false);
    const added = checkPiece("Aku menyukai senja dan semesta kita.", { workType: "prose", language: "id", original });
    expect(added.find((i) => i.code === "cliche")?.severity).toBe("repair");
  });
});

describe("shape & openers", () => {
  it("passes a real poem", () => {
    const issues = checkPiece(POEM, { workType: "poetry", language: "id", pov: "first" });
    expect(needsRepair(issues)).toBe(false);
  });

  it("flags a paragraph pretending to be a poem", () => {
    const para =
      "Aku senang mengenalmu karena hal-hal kecil yang kamu lakukan selalu berhasil membuat hariku lebih baik dan aku berharap kita bisa terus bersama untuk waktu yang sangat lama sekali.";
    expect(codes(para, { workType: "poetry", language: "id" })).toContain("shape");
  });

  it("flags prose chopped one sentence per line", () => {
    const chopped = ["Aku rindu.", "Kamu jauh.", "Hari ini hujan.", "Aku menunggu.", "Kopi dingin.", "Kamu belum datang."].join("\n");
    expect(codes(chopped, { workType: "prose", language: "id" })).toContain("shape");
  });

  it("flags stock openers", () => {
    expect(codes("Barangkali kau tak tahu\nbahwa aku menunggu\ndi tepi pagi\nyang dingin", { workType: "poetry", language: "id" })).toContain(
      "opener",
    );
  });
});

describe("point of view & language", () => {
  it("flags aku/saya mixed", () => {
    expect(codes("Aku menunggumu. Saya tidak tahu harus bagaimana.", { workType: "prose", language: "id" })).toContain("pov");
  });

  it("flags a third-person request written as aku/kamu", () => {
    const t = "Aku menatapmu. Kamu tersenyum padaku. Aku tahu kamu lelah. Kamu tetap di sini.";
    expect(codes(t, { workType: "prose", language: "id", pov: "third" })).toContain("pov");
  });

  it("does not take buku/ilmu for pronouns", () => {
    const t = "Dia membuka buku tua itu.\nIlmu yang dia cari\nada di halaman terakhir,\ndi antara debu dan cahaya.";
    expect(codes(t, { workType: "poetry", language: "id", pov: "third" })).not.toContain("pov");
  });

  it("flags English mixed into Indonesian", () => {
    const t = "Aku tahu the way you look at me is the only thing that I need, dan aku ingin kamu tahu that it is true.";
    expect(codes(t, { workType: "prose", language: "id" })).toContain("language");
  });
});

describe("alternatives", () => {
  it("flags near-identical alternatives", () => {
    const a = "Hujan turun di jendela kamar, aku menulis namamu di kaca yang berembun pelan-pelan.";
    const b = "Hujan turun di jendela kamar, aku menulis namamu pada kaca yang berembun perlahan.";
    expect(jaccard(a, b)).toBeGreaterThan(0.45);
    const res = checkAlternatives([a, b], { workType: "prose", language: "id" });
    expect(res[0].some((i) => i.code === "sameness")).toBe(false);
    expect(res[1].some((i) => i.code === "sameness")).toBe(true);
  });

  it("flags every alternative ending in a love declaration except the first", () => {
    const t1 = "Pagi ini kopi terlalu manis\ndan aku tahu sebabnya.\nAku mencintaimu.";
    const t2 = "Jalan pulang terasa pendek\nkarena kamu di ujungnya.\nAku mencintaimu.";
    const t3 = "Lampu kamar masih menyala\nseperti menunggu suaramu\npulang dari jauh.";
    const res = checkAlternatives([t1, t2, t3], { workType: "poetry", language: "id" });
    expect(res[0].some((i) => i.code === "closing")).toBe(false);
    expect(res[1].some((i) => i.code === "closing")).toBe(true);
    expect(res[2].some((i) => i.code === "closing")).toBe(false);
  });
});

describe("length", () => {
  it("flags a piece far shorter than asked", () => {
    expect(wordCount("Kamu.")).toBe(1);
    const res = checkPiece("Kamu rumahku.", { workType: "prose", language: "id", length: "long" });
    expect(res.find((i) => i.code === "length")?.severity).toBe("repair");
  });
});
