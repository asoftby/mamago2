/**
 * Unified media item for gallery strips and lightbox viewers.
 * Used by both the event page and breaking-news article gallery.
 */
export type MediaGalleryItem =
  | {
      type: "image";
      id: string;
      src: string;
      alt?: string;
    }
  | {
      type: "reels";
      id: string;
      /** Original Instagram / Reels URL (shown as fallback "Открыть в Instagram"). */
      url: string;
      /** Thumbnail image shown in the strip tile. Falls back to a branded placeholder. */
      thumbnailSrc?: string;
      title?: string;
    };
