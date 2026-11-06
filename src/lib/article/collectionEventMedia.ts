import { parseVideoUrl } from "@/lib/media/parseVideoUrl";
import type { MediaGalleryItem } from "@/lib/media/galleryTypes";

/** The same public gallery ordering as event detail: cover, additional photos, then social/video. */
export function buildCollectionEventMedia(input: {
  title: string;
  coverImageUrl: string | null;
  coverImageId?: string | null;
  images?: Array<{ id: string; url: string; mediaAssetId?: string | null }>;
  scheduleJson?: unknown;
}): MediaGalleryItem[] {
  const items: MediaGalleryItem[] = [];
  const seen = new Set<string>();
  const cover = input.coverImageUrl?.trim();
  if (cover) {
    items.push({ type: "image", id: "cover", src: cover, alt: input.title });
    seen.add(cover);
  }
  for (const image of input.images ?? []) {
    const url = image.url.trim();
    if (!url || seen.has(url) || (cover && input.coverImageId && (image.id === input.coverImageId || image.mediaAssetId === input.coverImageId))) continue;
    items.push({ type: "image", id: image.id, src: url, alt: input.title });
    seen.add(url);
  }
  const schedule = input.scheduleJson && typeof input.scheduleJson === "object" && !Array.isArray(input.scheduleJson)
    ? input.scheduleJson as Record<string, unknown> : {};
  const video = parseVideoUrl(typeof schedule.reelsUrl === "string" ? schedule.reelsUrl : null);
  if (video) items.push({
    type: video.type,
    id: `${video.type}-${video.embedId}`,
    url: video.url,
    embedId: video.embedId,
    posterSrc: video.type === "youtube" ? `https://img.youtube.com/vi/${video.embedId}/hqdefault.jpg` : null,
    title: video.label,
  });
  return items;
}
