import type { EventPageMedia } from "@/lib/event/eventPageTypes";
import type { MediaGalleryItem } from "@/lib/media/galleryTypes";
import type { OfferPageData } from "@/lib/offer/offerPageTypes";
import { extractYouTubeId } from "@/lib/offer/offerPageFormat";

const FALLBACK_POSTER = "/og-default.jpg";

function isInstagramReelUrl(url: string): boolean {
  return /instagram\.com\/(?:reel|p)\//i.test(url);
}

export type PublicationMediaColumnModel = {
  media: EventPageMedia;
  galleryItems: MediaGalleryItem[];
};

/**
 * Единая модель левой медиа-колонки (постер + трейлер + strip) для страницы оффера.
 */
export function mapOfferPageMedia(
  media: OfferPageData["media"],
  title: string,
): PublicationMediaColumnModel {
  const posterUrl = media.posterUrl?.trim() || FALLBACK_POSTER;
  const posterAlt = media.posterAlt?.trim() || title;

  const galleryItems: MediaGalleryItem[] = [];
  let trailerYoutubeId: string | undefined;
  let trailerLabel = media.videoLabel?.trim() || undefined;

  if (media.videoUrl?.trim()) {
    const videoUrl = media.videoUrl.trim();
    if (isInstagramReelUrl(videoUrl)) {
      galleryItems.push({
        type: "reels",
        id: "offer-reels",
        url: videoUrl,
        thumbnailSrc: media.videoThumbnail || (posterUrl !== FALLBACK_POSTER ? posterUrl : undefined),
        title: trailerLabel || "Reels",
      });
    } else {
      const youtubeId = extractYouTubeId(videoUrl);
      if (youtubeId) {
        trailerYoutubeId = youtubeId;
        trailerLabel = trailerLabel || "Трейлер";
      }
    }
  }

  for (const img of media.gallery) {
    const src = img.url?.trim();
    if (!src || src === posterUrl) continue;
    galleryItems.push({
      type: "image",
      id: img.id,
      src,
      alt: img.alt || title,
    });
  }

  return {
    media: {
      posterUrl,
      posterAlt,
      trailerYoutubeId,
      trailerLabel,
    },
    galleryItems,
  };
}
