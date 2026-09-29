"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isAppMediaUrl } from "@/lib/media/isAppMediaUrl";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { ArticleGalleryPresentation } from "@/lib/publications/articleMvp";
import { uniqueMediaIdsPreserveOrder } from "@/lib/article/articleMainGallery";

/** Matches the `md:` breakpoint used to switch between the desktop grid and the mobile slider. */
const DESKTOP_MEDIA_QUERY = "(min-width: 768px)";

export type ArticleGalleryImage = {
  id: string;
  url: string | null;
  alt: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
};

/** Desktop shows fixed groups of this many photos at a time — 1-3, 4-6, 7-9, ... */
const DESKTOP_GROUP_SIZE = 3;

/** Which fixed group a photo belongs to — e.g. index 4 (photo 5) belongs to the 3-6 group. */
export function desktopGroupStartForIndex(index: number, groupSize: number = DESKTOP_GROUP_SIZE): number {
  return Math.floor(index / groupSize) * groupSize;
}
/** Article body width used elsewhere in this renderer to calibrate `sizes`. */
const ARTICLE_WIDTH_PX = 720;

/**
 * `.article-body img` (globals: width 100%, border-radius 1rem, margin 2em 0) is meant for the
 * single-image block and outranks our Tailwind classes on specificity — inline styles are the
 * only reliable way to opt this component's own images out of it.
 */
const RESET_ARTICLE_BODY_IMG_STYLE = { margin: 0, borderRadius: 0 } as const;

function GalleryImg({
  image,
  sizes,
  className,
}: {
  image: ArticleGalleryImage;
  sizes: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  if (!image.url) {
    return (
      <div className={cn("absolute inset-0 flex items-center justify-center bg-muted/30 text-xs text-muted-foreground", className)} aria-hidden>
        Фото недоступно
      </div>
    );
  }
  return (
    <>
      <div
        data-gallery-skeleton={image.id}
        className={cn("absolute inset-0 bg-muted/60 transition-opacity duration-300", loaded ? "opacity-0" : "animate-pulse opacity-100")}
        aria-hidden
      />
      <Image
        src={image.url}
        alt={image.alt ?? ""}
        fill
        sizes={sizes}
        className={cn("object-cover transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0", className)}
        style={RESET_ARTICLE_BODY_IMG_STYLE}
        unoptimized={isAppMediaUrl(image.url)}
        onLoad={() => setLoaded(true)}
      />
    </>
  );
}

function ArticleGalleryLightbox({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: ArticleGalleryImage[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const total = images.length;
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const touchStartXRef = useRef<number | null>(null);

  const goPrev = useCallback(() => {
    onIndexChange(Math.max(0, index - 1));
  }, [index, onIndexChange]);

  const goNext = useCallback(() => {
    onIndexChange(Math.min(total - 1, index + 1));
  }, [index, onIndexChange, total]);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, goPrev, goNext]);

  // Prepare only the current + immediate neighbours — never the whole set.
  useEffect(() => {
    for (const neighbourIndex of [index - 1, index + 1]) {
      const url = images[neighbourIndex]?.url;
      if (!url) continue;
      const preload = new window.Image();
      preload.src = url;
    }
  }, [index, images]);

  const current = images[index];
  if (!current) return null;

  function handleTouchStart(e: React.TouchEvent) {
    touchStartXRef.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) goNext();
    else goPrev();
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр изображения"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white sm:left-4 sm:top-4">
        {index + 1} / {total}
      </div>

      <button
        ref={closeButtonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Закрыть галерею"
        className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-4 sm:top-4 sm:h-9 sm:w-9"
      >
        <X className="h-5 w-5" />
      </button>

      {total > 1 && index > 0 ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          aria-label="Предыдущее изображение"
          className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-3 sm:h-10 sm:w-10"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      ) : null}

      {total > 1 && index < total - 1 ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          aria-label="Следующее изображение"
          className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-3 sm:h-10 sm:w-10"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      ) : null}

      <div
        className="flex max-h-[90dvh] max-w-[94vw] flex-col items-center justify-center gap-2 sm:max-w-[92vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {current.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.url}
            alt={current.alt ?? ""}
            aria-describedby={current.caption ? "article-gallery-lightbox-caption" : undefined}
            className="max-h-[80dvh] w-auto max-w-[94vw] object-contain sm:max-w-[92vw]"
            style={{ ...RESET_ARTICLE_BODY_IMG_STYLE, width: "auto" }}
          />
        ) : (
          <div className="flex h-64 w-64 items-center justify-center rounded-xl bg-white/10 text-sm text-white/70">
            Изображение недоступно
          </div>
        )}
        {current.caption ? (
          <p id="article-gallery-lightbox-caption" className="max-w-[92vw] px-2 text-center text-sm text-white/80">
            {current.caption}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ArticleGallery({
  images,
  caption,
}: {
  images: ArticleGalleryImage[];
  /** @deprecated Storage-only — kept for prop compatibility, no longer changes rendering. */
  presentation?: ArticleGalleryPresentation;
  caption?: string;
}) {
  const deduplicatedImages = uniqueMediaIdsPreserveOrder(images.map((image) => image.id))
    .map((id) => images.find((image) => image.id.trim() === id)!)
    .filter(Boolean);
  const total = deduplicatedImages.length;
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);
  const visibleCount = isDesktop ? DESKTOP_GROUP_SIZE : 1;
  const maxStart = Math.max(0, total - visibleCount);
  const [activeIndex, setActiveIndex] = useState(0);
  const boundedActiveIndex = Math.min(activeIndex, maxStart);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const openLightbox = (index: number, trigger: HTMLElement | null) => {
    lastTriggerRef.current = trigger;
    setLightboxIndex(index);
  };
  const closeLightbox = () => {
    setLightboxIndex(null);
    lastTriggerRef.current?.focus();
  };
  const handleLightboxIndexChange = (index: number) => {
    setLightboxIndex(index);
    scrollToIndex(Math.min(index, maxStart));
  };

  function scrollToIndex(index: number) {
    const next = Math.max(0, Math.min(index, maxStart));
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollTo({ left: (viewport.clientWidth / visibleCount) * next, behavior: "smooth" });
    setActiveIndex(next);
  }

  function handleScroll() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const slideWidth = viewport.clientWidth / visibleCount;
    if (slideWidth > 0) setActiveIndex(Math.max(0, Math.min(Math.round(viewport.scrollLeft / slideWidth), maxStart)));
  }

  if (total === 0) return null;

  const preloadStart = Math.max(0, boundedActiveIndex - 1);
  const preloadEnd = Math.min(total - 1, boundedActiveIndex + visibleCount);

  return (
    <div className="not-prose my-8 min-w-0 md:my-10">
      <div className="relative">
        <div
          ref={viewportRef}
          data-article-gallery-track
          onScroll={handleScroll}
          className="flex snap-x snap-mandatory gap-0 overflow-x-auto scroll-smooth rounded-xl [scrollbar-width:none] [touch-action:pan-y_pinch-zoom] [&::-webkit-scrollbar]:hidden md:rounded-none"
        >
          {deduplicatedImages.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={(e) => openLightbox(index, e.currentTarget)}
              aria-label={`Открыть фото ${index + 1} из ${total}`}
              className="relative aspect-[9/12] w-full shrink-0 snap-start overflow-hidden border-border/60 bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-1/3 md:border-r md:last:border-r-0"
            >
              {index >= preloadStart && index <= preloadEnd ? (
                <GalleryImg image={image} sizes={isDesktop ? `${Math.floor(ARTICLE_WIDTH_PX / 3)}px` : "100vw"} />
              ) : (
                <div className="absolute inset-0 bg-muted/30" aria-hidden />
              )}
            </button>
          ))}
        </div>

        {boundedActiveIndex > 0 ? (
          <button type="button" onClick={() => scrollToIndex(boundedActiveIndex - visibleCount)} aria-label="Предыдущее изображение" className="absolute left-2 top-1/2 flex h-11 w-11 z-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm sm:h-10 sm:w-10"><ChevronLeft className="h-5 w-5" /></button>
        ) : null}
        {boundedActiveIndex < maxStart ? (
          <button type="button" onClick={() => scrollToIndex(boundedActiveIndex + visibleCount)} aria-label="Следующее изображение" className="absolute right-2 top-1/2 flex h-11 w-11 z-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm sm:h-10 sm:w-10"><ChevronRight className="h-5 w-5" /></button>
        ) : null}
        {total > 1 ? <div className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/45 px-2.5 py-1 text-xs text-white md:hidden">{boundedActiveIndex + 1} / {total}</div> : null}
      </div>

      {caption ? <p className="mt-3 px-1 text-center text-sm text-muted-foreground">{caption}</p> : null}

      {lightboxIndex !== null ? (
        <ArticleGalleryLightbox images={deduplicatedImages} index={lightboxIndex} onIndexChange={handleLightboxIndexChange} onClose={closeLightbox} />
      ) : null}
    </div>
  );
}
