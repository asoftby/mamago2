"use client";

import { useMemo } from "react";
import type { MediaGalleryItem } from "@/lib/media/galleryTypes";
import { MediaGalleryStrip } from "@/components/media/MediaGalleryStrip";

/**
 * Breaking-news hero gallery — shown above the article body.
 * Delegates strip rendering and lightbox to the shared MediaGalleryStrip component.
 */
export function BreakingNewsGalleryPreview({
  urls,
}: {
  /** All gallery image URLs (nulls filtered out before passing here). */
  urls: string[];
}) {
  const items = useMemo<MediaGalleryItem[]>(
    () =>
      urls.map((src, i) => ({
        type: "image" as const,
        id: `bn-img-${i}`,
        src,
        alt: `Фото ${i + 1}`,
      })),
    [urls],
  );

  if (items.length === 0) return null;

  return <MediaGalleryStrip items={items} maxVisible={3} className="mb-8 md:mb-10" />;
}
