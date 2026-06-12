"use client";

import { EventMediaStack } from "@/components/event-page/EventMediaStack";
import { MediaGalleryStrip } from "@/components/media/MediaGalleryStrip";
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
  const hasGallery = Boolean(galleryItems && galleryItems.length > 0);

  return (
    <div className={cn("space-y-2.5", className)}>
      <EventMediaStack media={media} />
      {hasGallery ? (
        <MediaGalleryStrip items={galleryItems!} maxVisible={galleryMaxVisible} />
      ) : null}
    </div>
  );
}
