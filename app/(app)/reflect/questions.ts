/** Plain module — the five night-reflection prompts (PLAN §14). */
export const REFLECTION_QUESTIONS = [
  { key: "q_today", label: "Gimana hari ini?" },
  { key: "q_smile", label: "Apa yang bikin kamu senyum?" },
  { key: "q_hard", label: "Apa yang terasa berat hari ini?" },
  { key: "q_release", label: "Apa yang mau kamu lepas dan tinggalkan?" },
  { key: "q_grateful", label: "Apa yang kamu syukuri?" },
] as const;

export type ReflectionKey = (typeof REFLECTION_QUESTIONS)[number]["key"];

export const CLOSING_MESSAGE = "Kamu udah cukup hari ini. Sekarang istirahat ya. ♡";
