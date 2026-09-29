"use client";

import { useMemo, useState } from "react";
import { EventMediaStack } from "@/components/event-page/EventMediaStack";
import { MediaGalleryStrip } from "@/components/media/MediaGalleryStrip";
import { MediaLightbox } from "@/components/media/MediaLightbox";
import { MobileMediaCarousel } from "@/components/media/MobileMediaCarousel";
import type { EventPageMedia } from "@/lib/event/eventPageTypes";
import type { MediaGalleryItem } from "@/lib/media/galleryTypes";
import { cn } from "@/lib/utils";

export type PublicationMediaColumnProps = {
  media: EventPageMedia;
  galleryItems?: MediaGalleryItem[];
  /** Сколько плиток в strip до «+N». Как на странице события. */
  galleryMaxVisible?: number;
  className?: string;
};

/**
 * Левая медиа-колонка публичных карточек (событие, оффер): постер + трейлер + strip.
 */
export function PublicationMediaColumn({
  media,
  galleryItems,
  galleryMaxVisible = 3,
  className,
}: PublicationMediaColumnProps) {
  const [posterLightboxOpen, setPosterLightboxOpen] = useState(false);
  const hasGallery = Boolean(galleryItems && galleryItems.length > 0);
  const lightboxItems = useMemo<MediaGalleryItem[]>(() => {
    const poster = media.posterUrl?.trim();
    const rest = (galleryItems ?? []).filter(
      (item) => item.type !== "image" || item.src.trim() !== poster,
    );
    if (!poster) return rest;
    return [
      {
        type: "image",
        id: "publication-poster",
        src: poster,
        alt: media.posterAlt,
      },
      ...rest,
    ];
  }, [galleryItems, media.posterAlt, media.posterUrl]);

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="lg:hidden">
        <MobileMediaCarousel items={lightboxItems} ariaLabel="Фото публикации" />
        <EventMediaStack media={media} showPoster={false} className="mt-2.5" />
      </div>

      <div className="hidden space-y-2.5 lg:block">
        <EventMediaStack
          media={media}
          onPosterClick={lightboxItems.length > 0 ? () => setPosterLightboxOpen(true) : undefined}
        />
        {hasGallery ? (
          <MediaGalleryStrip
            items={galleryItems!}
            maxVisible={galleryMaxVisible}
            lightboxItems={lightboxItems}
            lightboxIndexOffset={lightboxItems.length > (galleryItems?.length ?? 0) ? 1 : 0}
          />
        ) : null}
      </div>

      {posterLightboxOpen && lightboxItems.length > 0 ? (
        <MediaLightbox items={lightboxItems} startIndex={0} onClose={() => setPosterLightboxOpen(false)} />
      ) : null}
    </div>
  );
}
