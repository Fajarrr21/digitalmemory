import Link from "next/link";
import { redirect } from "next/navigation";
import { getSpaceContext, getUser } from "@/lib/auth";
import { greeting } from "@/lib/greeting";
import { localHour } from "@/lib/date";
import { SideRail } from "@/components/nav/side-rail";
import { BottomNav } from "@/components/nav/bottom-nav";
import { ComfortButton } from "@/components/nav/comfort-button";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getSpaceContext();

  // Middleware guarantees a signed-in user here; a missing context means the
  // space hasn't been provisioned yet (setup_space.sql not run).
  if (!ctx) {
    if (!(await getUser())) redirect("/sign-in");
    return <NeedsSetup />;
  }

  const name = ctx.profile.nickname ?? ctx.profile.display_name;
  const hello = greeting(localHour(ctx.profile.timezone), name);

  return (
    <div className="relative z-10 flex min-h-dvh">
      <SideRail />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 px-5 pt-6 pb-2 md:px-10 md:pt-8">
          <p className="font-display text-xl font-medium text-ink text-balance md:text-2xl">
            {hello}
          </p>
          <div className="flex flex-none items-center gap-2">
            <ThemeToggle />
            <Link
              href="/profile"
              className="inline-flex h-9 items-center rounded-full border border-rule px-3 text-sm text-ink-soft transition hover:text-accent-ink hover:border-accent-ink/40"
            >
              Profile
            </Link>
            <form action="/auth/sign-out" method="post">
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-full px-3 text-sm text-ink-faint transition hover:text-ink-soft"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>

        <main className="mx-auto w-full max-w-2xl flex-1 px-5 pt-4 pb-28 md:px-10 md:pb-16">
          {children}
        </main>
      </div>

      <BottomNav />
      <ComfortButton />
    </div>
  );
}

function NeedsSetup() {
  return (
    <main className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="font-hand text-2xl text-accent-ink">almost ready…</p>
      <h1 className="mt-3 font-display text-2xl font-medium text-ink text-balance">
        This little place is being prepared for you
      </h1>
      <p className="mt-3 text-ink-soft">
        Your space hasn&apos;t been set up yet. Run{" "}
        <code className="rounded bg-paper-2 px-1.5 py-0.5 font-mono text-sm">
          supabase/setup_space.sql
        </code>{" "}
        once, then come back. ♡
      </p>
      <form action="/auth/sign-out" method="post" className="mt-8">
        <button
          type="submit"
          className="text-sm text-ink-faint underline underline-offset-4 hover:text-ink-soft"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
