"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { shareMoment, deleteMoment } from "../actions";

/** Tiny text actions under an archive entry the viewer owns. */
export function ItemActions({
  id,
  shared,
  partnerName,
}: {
  id: string;
  shared: boolean;
  partnerName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok?: boolean; error?: string }>) {
    start(async () => {
      setError(null);
      const res = await fn();
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="mt-2 flex items-center gap-3 text-xs">
      {shared ? (
        <span className="text-ink-faint">dibagikan ke {partnerName} ♡</span>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => shareMoment(id))}
          className="text-accent-ink hover:underline disabled:opacity-50"
        >
          kirim ke {partnerName}
        </button>
      )}
      {confirming ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => deleteMoment(id))}
          className="text-danger hover:underline disabled:opacity-50"
        >
          yakin hapus?
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(true)}
          className="text-ink-faint hover:text-danger disabled:opacity-50"
        >
          hapus
        </button>
      )}
      {error ? (
        <span role="alert" className="text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
