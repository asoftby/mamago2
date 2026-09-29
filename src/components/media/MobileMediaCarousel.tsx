"use client";

import { useRef, useState } from "react";
import { Play } from "lucide-react";
import { MediaLightbox } from "@/components/media/MediaLightbox";
import type { MediaGalleryItem } from "@/lib/media/galleryTypes";
import { cn } from "@/lib/utils";

type MobileMediaCarouselProps = {
  items: MediaGalleryItem[];
  ariaLabel?: string;
  className?: string;
};

function slideBackground(item: MediaGalleryItem): string | undefined {
  return item.type === "image" ? item.src : item.thumbnailSrc;
}

export function MobileMediaCarousel({
  items,
  ariaLabel = "Галерея",
  className,
}: MobileMediaCarouselProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  function handleScroll() {
    const viewport = viewportRef.current;
    if (!viewport || viewport.clientWidth <= 0) return;
    const next = Math.round(viewport.scrollLeft / viewport.clientWidth);
    setActiveIndex(Math.max(0, Math.min(next, items.length - 1)));
  }

  return (
    <>
      <div className={cn("relative min-w-0", className)}>
        <div
          ref={viewportRef}
          data-mobile-media-carousel
          onScroll={handleScroll}
          className="flex w-full snap-x snap-mandatory overflow-x-auto scroll-smooth rounded-[18px] overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="list"
          aria-label={ariaLabel}
        >
          {items.map((item, index) => {
            const bgSrc = slideBackground(item);
            const isReels = item.type === "reels";
            const mediaLabel =
              isReels && /instagram\.com\/p\//i.test(item.url) ? "Post" : "Reels";

            return (
              <button
                key={item.id}
                type="button"
                role="listitem"
                onClick={() => setLightboxIndex(index)}
                aria-label={isReels ? `Открыть ${mediaLabel}` : `Открыть фото ${index + 1} из ${items.length}`}
                className="group relative aspect-[4/5] w-full shrink-0 snap-start overflow-hidden bg-[#E8E0D4] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF8759]"
              >
                {bgSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={bgSrc}
                    alt={item.type === "image" ? (item.alt ?? "") : ""}
                    className="absolute inset-0 h-full w-full object-cover"
                    draggable={false}
                    onError={(event) => {
                      const image = event.currentTarget;
                      if (image.dataset.fallbackApplied === "true") return;
                      image.dataset.fallbackApplied = "true";
                      image.src = "/og-default.jpg";
                    }}
                  />
                ) : null}
                {isReels ? (
                  <>
                    <div className="absolute inset-0 bg-black/25" />
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                        <Play className="h-5 w-5 translate-x-[1px] fill-white text-white" aria-hidden />
                      </span>
                    </span>
                    <span className="absolute bottom-3 left-3 rounded-full bg-black/45 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-white">
                      {mediaLabel}
                    </span>
                  </>
                ) : null}
              </button>
            );
          })}
        </div>

        {items.length > 1 ? (
          <div
            data-mobile-media-counter
            className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm"
          >
            {activeIndex + 1} / {items.length}
          </div>
        ) : null}
      </div>

      {lightboxIndex !== null ? (
        <MediaLightbox
          items={items}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </>
  );
}
