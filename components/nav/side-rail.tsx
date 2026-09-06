"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function SideRail() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="sticky top-0 hidden h-dvh w-56 flex-none flex-col gap-1 border-r border-rule px-4 py-8 md:flex"
    >
      <Link href="/" className="mb-8 px-3">
        <span className="block font-display text-lg font-medium leading-tight text-ink">
          our little
          <br />
          universe
        </span>
        <span className="mt-1 block font-hand text-base text-accent-ink">♡</span>
      </Link>

      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-colors",
              active
                ? "bg-blush/40 text-accent-ink"
                : "text-ink-soft hover:bg-paper hover:text-ink",
            )}
          >
            <Icon className={cn("h-5 w-5", active && "fill-accent/40")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
