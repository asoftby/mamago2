import type { MediaGalleryItem } from "@/lib/media/galleryTypes";
import { parseVideoUrl } from "@/lib/media/parseVideoUrl";

export type PlacePageMediaModel = {
  /** Первое GALLERY-фото — для og/JSON-LD. Лого сюда не попадает. */
  posterUrl?: string;
  posterAlt: string;
  /**
   * Единый формат strip-галереи (как у оффера/события): первая плитка — Reels
   * (если задан reelsUrl) с обложкой = первое фото, далее фото.
   */
  galleryItems: MediaGalleryItem[];
};

type PlaceMediaImageSource = {
  id: string;
  url: string;
  kind: string;
  sortOrder: number;
};

/**
 * Медиа публичной страницы Place в едином формате MediaGalleryStrip:
 * Reels (с обложкой-постером) + квадратные плитки фото.
 */
export function mapPlacePageMedia(
  images: PlaceMediaImageSource[],
  options: {
    reelsUrl?: string | null;
    /** Реальная обложка Reels (og:image из Instagram), полученная на сервере. */
    reelsThumbnailUrl?: string | null;
    title: string;
  },
): PlacePageMediaModel {
  const photos = images
    .filter((img) => img.kind === "GALLERY" && img.url?.trim())
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const posterUrl = photos[0]?.url?.trim() || undefined;
  const video = parseVideoUrl(options.reelsUrl);

  const galleryItems: MediaGalleryItem[] = [];

  // Reels — отдельная плитка с СОБСТВЕННОЙ обложкой (og:image самого рилса).
  // Фото к рилсу не привязаны и не «съедаются» им.
  if (video?.type === "instagram") {
    galleryItems.push({
      type: "instagram",
      id: "place-reels",
      url: video.url,
      embedId: video.embedId,
      posterSrc: options.reelsThumbnailUrl?.trim() || null,
      title: options.title,
    });
  }

  for (const photo of photos) {
    galleryItems.push({
      type: "image",
      id: photo.id,
      src: photo.url,
      alt: options.title,
    });
  }

  return {
    posterUrl,
    posterAlt: options.title,
    galleryItems,
  };
}
