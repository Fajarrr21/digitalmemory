import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * "Aku / <partner>" switcher for timeline views. Pure links so it works in a
 * server component; the page decides what each href points at.
 */
export function PersonToggle({
  selfHref,
  partnerHref,
  partnerName,
  viewingPartner,
}: {
  selfHref: string;
  partnerHref: string;
  partnerName: string;
  viewingPartner: boolean;
}) {
  const tab = "rounded-full px-4 py-1.5 transition";
  const active = "bg-accent text-[#4a2b30] shadow-[var(--shadow-lift)]";
  const idle = "text-ink-soft hover:text-ink";
  return (
    <div className="inline-flex items-center rounded-full border border-rule bg-paper p-1 text-sm">
      <Link href={selfHref} className={cn(tab, viewingPartner ? idle : active)}>
        Aku
      </Link>
      <Link href={partnerHref} className={cn(tab, viewingPartner ? active : idle)}>
        {partnerName}
      </Link>
    </div>
  );
}
