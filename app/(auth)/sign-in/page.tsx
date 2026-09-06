import { PaperCard } from "@/components/ui/paper-card";
import { BrandMark } from "@/components/brand-mark";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <BrandMark className="mx-auto mb-4 h-14 w-14" />
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-accent-ink">
          welcome back
        </p>
        <h1 className="mt-3 font-display text-3xl font-medium tracking-tight text-ink text-balance">
          A little place made for you
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Sign in to your quiet corner. ♡
        </p>
      </div>

      <PaperCard lift>
        <SignInForm next={next} />
      </PaperCard>

      <p className="mt-6 text-center font-hand text-lg text-accent-ink">
        this space knows only you two
      </p>
    </div>
  );
}
