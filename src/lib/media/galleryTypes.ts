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
      type: "instagram";
      id: string;
      url: string;
      embedId: string;
      posterSrc: string | null;
      title?: string;
    }
  | {
      type: "youtube";
      id: string;
      url: string;
      embedId: string;
      posterSrc: string | null;
      title?: string;
    };
