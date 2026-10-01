import type { EventPageMedia } from "@/lib/event/eventPageTypes";
import type { MediaGalleryItem } from "@/lib/media/galleryTypes";
import type { OfferPageData } from "@/lib/offer/offerPageTypes";
import { parseVideoUrl } from "@/lib/media/parseVideoUrl";

const FALLBACK_POSTER = "/og-default.jpg";

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
  let instagramVideo: MediaGalleryItem | null = null;
  let trailerYoutubeId: string | undefined;
  let trailerLabel = media.videoLabel?.trim() || undefined;

  if (media.videoUrl?.trim()) {
    const video = parseVideoUrl(media.videoUrl);
    if (video?.type === "instagram") {
      instagramVideo = {
        type: "instagram",
        id: "offer-reels",
        url: video.url,
        embedId: video.embedId,
        posterSrc: media.videoThumbnail || (posterUrl !== FALLBACK_POSTER ? posterUrl : null),
        title: trailerLabel || "Reels",
      };
    } else if (video?.type === "youtube") {
      trailerYoutubeId = video.embedId;
      trailerLabel = trailerLabel || "Трейлер";
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

  if (instagramVideo) galleryItems.push(instagramVideo);

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
