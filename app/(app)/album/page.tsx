import Link from "next/link";
import { getSpaceContext } from "@/lib/auth";
import { getAlbums } from "@/lib/albums";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PaperCard } from "@/components/ui/paper-card";
import { AlbumCreate } from "./album-create";

export default async function AlbumsPage() {
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const albums = await getAlbums(ctx.spaceId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>our photos & videos</Eyebrow>
          <h1 className="mt-2 font-display text-3xl font-medium text-ink">Album</h1>
          <p className="mt-1 text-sm text-ink-soft">Tempat foto & video kalian berdua. ♡</p>
        </div>
        <AlbumCreate />
      </div>

      {albums.length === 0 ? (
        <PaperCard className="border-dashed text-center">
          <p className="font-hand text-xl text-accent-ink">belum ada album</p>
          <p className="mt-1 text-sm text-ink-soft">Bikin album pertama kalian di atas, terus isi foto & video.</p>
        </PaperCard>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {albums.map((a) => (
            <Link key={a.id} href={`/album/${a.id}`} className="group flex flex-col gap-2">
              <div className="relative aspect-square overflow-hidden rounded-2xl border border-rule bg-paper-2">
                {a.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.coverUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition group-hover:brightness-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl text-ink-faint">🖼️</div>
                )}
                <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white">
                  {a.count} 📷
                </span>
              </div>
              <p className="font-display text-[1.05rem] font-medium text-ink group-hover:text-accent-ink">{a.title}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
