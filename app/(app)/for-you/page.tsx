import { getSpaceContext } from "@/lib/auth";
import { getForYouMessages } from "@/lib/for-you";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ForYouList } from "./for-you-list";
import { MessageComposer } from "./message-composer";

export default async function ForYouPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const messages = await getForYouMessages(ctx.spaceId);
  const isAuthor = ctx.role === "author";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>whenever you need it</Eyebrow>
        <h1 className="mt-2 font-display text-3xl font-medium text-ink text-balance">For You</h1>
        <p className="mt-1 text-ink-soft">
          Pesan-pesan kecil yang bisa kamu buka kapan aja. ♡
        </p>
      </div>

      <ForYouList messages={messages} isRecipient={!isAuthor} canDelete={isAuthor} />

      {isAuthor ? (
        <div className="border-t border-rule-soft pt-6">
          <MessageComposer />
        </div>
      ) : null}
    </div>
  );
}
