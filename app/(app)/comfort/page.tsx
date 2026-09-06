import { Eyebrow } from "@/components/ui/eyebrow";
import { ComfortRoom } from "./comfort-room";

export default function ComfortPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>it&apos;s okay, you&apos;re here</Eyebrow>
        <h1 className="mt-2 font-display text-3xl font-medium text-ink text-balance">
          Kamu nggak sendirian
        </h1>
      </div>
      <ComfortRoom />
    </div>
  );
}
