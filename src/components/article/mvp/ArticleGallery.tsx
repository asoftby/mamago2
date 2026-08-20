"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isAppMediaUrl } from "@/lib/media/isAppMediaUrl";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { ArticleGalleryPresentation } from "@/lib/publications/articleMvp";

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

/** Максимум фотографий, видимых одновременно в основном ряду на desktop. */
const WINDOW_SIZE = 3;
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
  if (!image.url) {
    return (
      <div className={cn("absolute inset-0 flex items-center justify-center bg-muted/30 text-xs text-muted-foreground", className)} aria-hidden>
        Фото недоступно
      </div>
    );
  }
  return (
    <Image
      src={image.url}
      alt={image.alt ?? ""}
      fill
      sizes={sizes}
      className={cn("object-cover", className)}
      style={RESET_ARTICLE_BODY_IMG_STYLE}
      unoptimized={isAppMediaUrl(image.url)}
    />
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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр изображения"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="absolute left-4 top-4 z-10 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white">
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
        className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
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
          className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
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
          className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      ) : null}

      <div
        className="flex max-h-[90vh] max-w-[92vw] flex-col items-center justify-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {current.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.url}
            alt={current.alt ?? ""}
            aria-describedby={current.caption ? "article-gallery-lightbox-caption" : undefined}
            className="max-h-[80vh] w-auto max-w-[92vw] object-contain"
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
  const total = images.length;
  // Gates which breakpoint's <Image> actually mounts (and fetches) — the CSS `hidden md:block` /
  // `md:hidden` pair alone doesn't stop the browser from loading `display:none` images, so both
  // variants would otherwise download regardless of which one is visible.
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);
  const [activeIndex, setActiveIndex] = useState(0);
  const [windowStart, setWindowStart] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const thumbRailRef = useRef<HTMLDivElement>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const windowSize = Math.min(WINDOW_SIZE, total);

  // Keep the visible 3-wide window covering activeIndex, adjusted during render
  // (not in an effect) per https://react.dev/learn/you-might-not-need-an-effect.
  const [prevActiveIndexForWindow, setPrevActiveIndexForWindow] = useState(activeIndex);
  if (activeIndex !== prevActiveIndexForWindow) {
    setPrevActiveIndexForWindow(activeIndex);
    setWindowStart((prev) => {
      if (activeIndex < prev) return activeIndex;
      if (activeIndex > prev + windowSize - 1) return activeIndex - windowSize + 1;
      return prev;
    });
  }

  useEffect(() => {
    const rail = thumbRailRef.current;
    if (!rail) return;
    const activeThumb = rail.querySelector<HTMLElement>(`[data-thumb-index="${activeIndex}"]`);
    activeThumb?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [activeIndex]);

  if (total === 0) return null;

  const openLightbox = (index: number, trigger: HTMLElement | null) => {
    lastTriggerRef.current = trigger;
    setActiveIndex(index);
    setLightboxOpen(true);
  };
  const closeLightbox = () => {
    setLightboxOpen(false);
    lastTriggerRef.current?.focus();
  };
  const goPrev = () => setActiveIndex((i) => Math.max(0, i - 1));
  const goNext = () => setActiveIndex((i) => Math.min(total - 1, i + 1));

  function handleMobileTouchStart(e: React.TouchEvent) {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  }
  function handleMobileTouchEnd(e: React.TouchEvent) {
    const startX = touchStartXRef.current;
    const startY = touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    if (startX === null || startY === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) goNext();
    else goPrev();
  }

  const windowImages = images.slice(windowStart, windowStart + windowSize);
  const desktopImageWidthPx = Math.floor(ARTICLE_WIDTH_PX / windowSize);
  const activeImage = images[activeIndex];

  return (
    <div className="not-prose my-8 min-w-0 md:my-10">
      {/* Desktop / tablet: up to 3-wide row + thumbnails */}
      <div className="hidden md:block">
        <div
          className={cn(
            "grid gap-3",
            windowSize === 1 && "grid-cols-1",
            windowSize === 2 && "grid-cols-2",
            windowSize === 3 && "grid-cols-3",
          )}
        >
          {windowImages.map((image, i) => {
            const idx = windowStart + i;
            return (
              <button
                key={image.id}
                type="button"
                onClick={(e) => openLightbox(idx, e.currentTarget)}
                aria-label={`Открыть фото ${idx + 1} из ${total}`}
                className="relative aspect-[9/12] w-full overflow-hidden rounded-xl border border-border/60 bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {isDesktop ? (
                  <GalleryImg image={image} sizes={`(max-width: 767px) 100vw, ${desktopImageWidthPx}px`} />
                ) : null}
              </button>
            );
          })}
        </div>

        {total > WINDOW_SIZE ? (
          <div
            ref={thumbRailRef}
            className="mt-3 flex gap-2 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="list"
            aria-label="Миниатюры изображений"
          >
            {images.map((image, idx) => (
              <button
                key={image.id}
                type="button"
                data-thumb-index={idx}
                onClick={() => setActiveIndex(idx)}
                aria-label={`Показать фото ${idx + 1} из ${total}`}
                aria-current={idx === activeIndex}
                className={cn(
                  "relative h-16 shrink-0 overflow-hidden rounded-md border-2 bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  idx === activeIndex ? "border-primary" : "border-transparent",
                )}
                style={{ aspectRatio: "9 / 12" }}
              >
                {isDesktop ? <GalleryImg image={image} sizes="64px" /> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Mobile: single-image slider */}
      {activeImage ? (
        <div className="md:hidden">
          <div
            className="relative aspect-[9/12] w-full overflow-hidden rounded-xl bg-muted/20"
            onTouchStart={handleMobileTouchStart}
            onTouchEnd={handleMobileTouchEnd}
          >
            <button
              type="button"
              onClick={(e) => openLightbox(activeIndex, e.currentTarget)}
              aria-label={`Открыть фото ${activeIndex + 1} из ${total}`}
              className="absolute inset-0"
            >
              {!isDesktop ? <GalleryImg image={activeImage} sizes="100vw" /> : null}
            </button>

            {total > 1 && activeIndex > 0 ? (
              <button
                type="button"
                onClick={goPrev}
                aria-label="Предыдущее изображение"
                className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : null}

            {total > 1 && activeIndex < total - 1 ? (
              <button
                type="button"
                onClick={goNext}
                aria-label="Следующее изображение"
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            ) : null}

            {total > 1 ? (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-2.5 py-1 text-xs text-white">
                {activeIndex + 1} / {total}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {caption ? <p className="mt-3 px-1 text-center text-sm text-muted-foreground">{caption}</p> : null}

      {lightboxOpen ? (
        <ArticleGalleryLightbox images={images} index={activeIndex} onIndexChange={setActiveIndex} onClose={closeLightbox} />
      ) : null}
    </div>
  );
}
