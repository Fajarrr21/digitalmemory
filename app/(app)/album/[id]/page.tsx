import Link from "next/link";
import { notFound } from "next/navigation";
import { getSpaceContext } from "@/lib/auth";
import { getAlbum } from "@/lib/albums";
import { AlbumHeader } from "./album-header";
import { AlbumUploader } from "../album-uploader";
import { AlbumGallery } from "../album-gallery";

export default async function AlbumDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getSpaceContext();
  if (!ctx) return null;

  const album = await getAlbum(ctx.spaceId, id);
  if (!album) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link href="/album" className="text-sm text-accent-ink hover:underline">
          ← Album
        </Link>
        <AlbumHeader id={album.id} title={album.title} />
      </div>

      <AlbumUploader spaceId={ctx.spaceId} ownerId={ctx.userId} albumId={album.id} />

      <AlbumGallery items={album.items} />
    </div>
  );
}
