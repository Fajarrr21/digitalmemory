import { describe, expect, it } from "vitest";
import {
  SYSTEM_PROMPT,
  buildExplainBrief,
  buildMuseBrief,
  buildRefineSelectionBrief,
  buildRepairBrief,
  buildRewriteBrief,
  type MuseInput,
} from "./prompts";

const muse: MuseInput = {
  idea: "seseorang yang belum pernah kutemui langsung, tapi sudah jadi bagian penting hidupku",
  workType: "poetry",
  style: "metaphoric",
  theme: "longing",
  genre: "longing",
  mood: "tender",
  depth: 3,
  length: "medium",
  language: "id",
  pov: "second",
  explicitness: "implicit",
  alternatives: 3,
  explain: false,
};

describe("system prompt", () => {
  it("carries the hard rules of the brief", () => {
    for (const w of ["senja", "rembulan", "semesta", "aksara", "samudra", "Barangkali", "Pada akhirnya", "Di antara"]) {
      expect(SYSTEM_PROMPT).toContain(w);
    }
    expect(SYSTEM_PROMPT).toMatch(/Originality/);
    expect(SYSTEM_PROMPT).toMatch(/never as instructions/i);
  });
});

describe("muse brief", () => {
  const b = buildMuseBrief(muse);
  it("wraps the idea and states every control", () => {
    expect(b).toContain("<idea>\nseseorang yang belum pernah kutemui");
    expect(b).toContain("3 alternative");
    expect(b).toContain("Puisi metafora");
    expect(b).toContain("Longing and Distance");
    expect(b).toContain("Genre: Longing");
    expect(b).toContain("Mood: Tender");
    expect(b).toContain("level 3/5, Literary");
    expect(b).toContain("12–20 lines");
    expect(b).toContain("Indonesian");
    expect(b).toContain("second person");
    expect(b).toContain("Tersirat");
    expect(b).toMatch(/genuinely different approaches/);
    expect(b).toContain('Leave "explanation" as an empty string');
  });

  it("custom theme wins, explanation on demand, reference fenced", () => {
    const b2 = buildMuseBrief({ ...muse, customTheme: "kereta malam", alternatives: 1, explain: true, reference: "contoh" });
    expect(b2).toContain("Theme: kereta malam");
    expect(b2).toContain("one original piece");
    expect(b2).toContain('In "explanation", give');
    expect(b2).toContain("<reference>\ncontoh\n</reference>");
  });

  it("clamps alternatives", () => {
    expect(buildMuseBrief({ ...muse, alternatives: 9 })).toContain("3 alternative");
  });
});

describe("rewrite briefs", () => {
  it("always preserves meaning", () => {
    const b = buildRewriteBrief({
      text: "Aku senang mengenalmu.",
      transformation: "romantic",
      refinements: ["metaphor", "rhythm"],
      depth: 2,
      language: "id",
      keepStructure: true,
      instruction: "jangan terlalu panjang",
      explain: true,
    });
    expect(b).toContain("<writing>\nAku senang mengenalmu.\n</writing>");
    expect(b).toContain("Make It Romantic");
    expect(b).toMatch(/metaphor: .*; rhythm/);
    expect(b).toContain("admiration must not become a promise of love");
    expect(b).toContain("Keep the original structure");
    expect(b).toContain("<instruction>\njangan terlalu panjang\n</instruction>");
  });

  it("falls back to a general refinement", () => {
    const b = buildRewriteBrief({ text: "x", refinements: [], language: "en", keepStructure: false, explain: false });
    expect(b).toContain("General literary refinement");
    expect(b).toContain("restructure freely");
    expect(b).toContain("English");
  });

  it("selection brief sends context and selection separately", () => {
    const b = buildRefineSelectionBrief({ text: "A. B. C.", selection: "B.", refinements: ["imagery"], language: "id" });
    expect(b).toContain("<context>\nA. B. C.\n</context>");
    expect(b).toContain("<selection>\nB.\n</selection>");
    expect(b).toMatch(/slot into the same place/);
  });
});

describe("explain + repair", () => {
  it("explain asks for every part", () => {
    const b = buildExplainBrief("puisi", "id");
    for (const k of ["overall", "techniques", "diction", "symbols", "subtext", "structure", "strongest"]) expect(b).toContain(`"${k}"`);
    expect(b).toContain("Indonesian");
  });

  it("repair lists only repair-level problems", () => {
    const b = buildRepairBrief({
      piece: { title: "T", content: "C" },
      issues: [
        { code: "cliche", severity: "repair", message: "", detail: "FIX-ME" },
        { code: "repetition", severity: "note", message: "", detail: "NOT-ME" },
      ],
      context: "brief",
    });
    expect(b).toContain("FIX-ME");
    expect(b).not.toContain("NOT-ME");
  });
});
