"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/moon", label: "Hari ini" },
  { href: "/moon/calendar", label: "Kalender" },
  { href: "/moon/checkin", label: "Check-in" },
  { href: "/moon/insights", label: "Insight" },
  { href: "/moon/settings", label: "Pengaturan" },
];

export function MoonTabs() {
  const path = usePathname();
  return (
    <nav aria-label="her little moon" className="-mx-1 overflow-x-auto">
      <ul className="flex min-w-max gap-1 px-1">
        {TABS.map((t) => {
          const active = t.href === "/moon" ? path === "/moon" : path.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full px-3.5 text-sm transition",
                  active ? "bg-blush/60 text-ink" : "text-ink-faint hover:text-ink-soft",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
