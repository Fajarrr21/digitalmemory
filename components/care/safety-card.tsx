import type { SafetyLevel } from "@/lib/care/logic";
import { cn } from "@/lib/utils";
import { EMERGENCY } from "@/app/(app)/care/care-config";

/**
 * The medical-help card. Shown instead of — never behind — the comforting
 * animations whenever the reported condition calls for it. It doesn't
 * diagnose and never says "you're fine"; it says "please get checked", and
 * gives a real way to do that right now.
 *
 *   urgent — warning signs: seek medical help now
 *   check  — severe: please get it looked at soon
 *   gentle — the always-there footer: "if it gets worse…"
 */
export function SafetyCard({
  level,
  viewer = "sender",
  partnerName,
  className,
}: {
  level: SafetyLevel | "gentle";
  viewer?: "sender" | "carer";
  partnerName?: string;
  className?: string;
}) {
  if (level === "none") return null;

  if (level === "gentle") {
    return (
      <p className={cn("text-center text-sm leading-relaxed text-ink-faint", className)}>
        Kalau sakitnya makin parah, terus muntah, susah minum, atau pingsan — jangan tunggu di sini.
        Hubungi orang terdekat atau{" "}
        {EMERGENCY.map((e, i) => (
          <span key={e.tel}>
            {i > 0 ? " / " : ""}
            <a href={`tel:${e.tel}`} className="text-accent-ink underline underline-offset-2">
              {e.tel}
            </a>
          </span>
        ))}
        .
      </p>
    );
  }

  const urgent = level === "urgent";
  const them = partnerName ?? "dia";

  return (
    <section
      role="alert"
      className={cn(
        "rounded-2xl border px-5 py-5",
        urgent ? "border-danger/50 bg-danger/10" : "border-[#e9a66b]/50 bg-[#f6c98d]/15",
        className,
      )}
    >
      <p className={cn("font-mono text-[11px] uppercase tracking-[0.18em]", urgent ? "text-danger" : "text-accent-ink")}>
        {urgent ? "tolong jangan ditunggu" : "sebaiknya diperiksa"}
      </p>
      <h2 className="mt-1.5 font-display text-xl font-medium text-ink text-balance">
        {viewer === "carer"
          ? urgent
            ? `${them} mungkin perlu pertolongan medis sekarang.`
            : `${them} merasa sakitnya berat.`
          : urgent
            ? "Ini perlu diperiksa sekarang — bukan ditunggu."
            : "Sakit yang berat sebaiknya diperiksa."}
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
        {viewer === "carer"
          ? urgent
            ? `Hubungi ${them} sekarang. Tanyakan apakah masih muntah dan seberapa sakit rasanya, lalu bantu ${them} mendapat pemeriksaan — ke klinik/IGD terdekat, atau minta orang di dekatnya menemani. Pelukan virtual bisa menyusul.`
            : `Tanyakan kabarnya, dan bantu ${them} mendapat pemeriksaan kalau sakitnya nggak membaik atau bertambah.`
          : urgent
            ? "Minta orang di dekatmu menemanimu ke klinik atau IGD terdekat, atau telepon layanan darurat. Kamu nggak sedang merepotkan siapa pun."
            : "Kalau nggak membaik, bertambah, atau disertai muntah berulang, segera ke klinik atau IGD. Aplikasi ini nggak bisa memastikan kondisimu aman."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {EMERGENCY.map((e) => (
          <a
            key={e.tel}
            href={`tel:${e.tel}`}
            className={cn(
              "inline-flex h-11 items-center rounded-full px-5 text-[15px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink",
              urgent ? "bg-danger text-white hover:brightness-110" : "border border-rule bg-paper text-ink hover:border-accent-ink/40",
            )}
          >
            📞 {e.label}
          </a>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-faint">
        Nggak ada diagnosis di sini, dan nggak ada saran obat. Tenaga kesehatan yang bisa memastikannya.
      </p>
    </section>
  );
}
