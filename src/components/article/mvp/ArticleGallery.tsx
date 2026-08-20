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
  // Three independent notions of "current photo" — kept separate on purpose:
  // - desktopGroupStart: which fixed group of DESKTOP_GROUP_SIZE the desktop grid shows.
  // - mobileIndex: the mobile slider's current photo (mobile behavior is unchanged).
  // - lightboxIndex: null when closed; otherwise the absolute index the lightbox is showing.
  const [desktopGroupStart, setDesktopGroupStart] = useState(0);
  const [mobileIndex, setMobileIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  if (total === 0) return null;

  // Lightbox always browses the full collection; opening it from either breakpoint also parks
  // the mobile slider at that photo, matching the mobile slider's own pre-existing behavior of
  // picking up wherever the lightbox was left — desktop's group state is never touched by this.
  const openLightbox = (index: number, trigger: HTMLElement | null) => {
    lastTriggerRef.current = trigger;
    setLightboxIndex(index);
    setMobileIndex(index);
  };
  const closeLightbox = () => {
    setLightboxIndex(null);
    lastTriggerRef.current?.focus();
  };
  const handleLightboxIndexChange = (index: number) => {
    setLightboxIndex(index);
    setMobileIndex(index);
  };
  const goMobilePrev = () => setMobileIndex((i) => Math.max(0, i - 1));
  const goMobileNext = () => setMobileIndex((i) => Math.min(total - 1, i + 1));

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
    if (dx < 0) goMobileNext();
    else goMobilePrev();
  }

  const groupImages = images.slice(desktopGroupStart, desktopGroupStart + DESKTOP_GROUP_SIZE);
  const groupSize = groupImages.length;
  const desktopImageWidthPx = Math.floor(ARTICLE_WIDTH_PX / groupSize);
  const mobileImage = images[mobileIndex];

  return (
    <div className="not-prose my-8 min-w-0 md:my-10">
      {/* Desktop / tablet: up to 3-wide row + thumbnails */}
      <div className="hidden md:block">
        <div
          className={cn(
            "grid gap-3",
            groupSize === 1 && "grid-cols-1",
            groupSize === 2 && "grid-cols-2",
            groupSize === 3 && "grid-cols-3",
          )}
        >
          {groupImages.map((image, i) => {
            const idx = desktopGroupStart + i;
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

        {total > DESKTOP_GROUP_SIZE ? (
          <div
            className="mt-3 flex gap-2 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="list"
            aria-label="Миниатюры изображений"
          >
            {images.map((image, idx) => {
              const isInCurrentGroup = idx >= desktopGroupStart && idx < desktopGroupStart + DESKTOP_GROUP_SIZE;
              return (
                <button
                  key={image.id}
                  type="button"
                  data-thumb-index={idx}
                  onClick={() => {
                    const nextGroupStart = desktopGroupStartForIndex(idx);
                    setDesktopGroupStart(nextGroupStart);
                  }}
                  aria-label={`Показать фото ${idx + 1} из ${total}`}
                  aria-current={isInCurrentGroup}
                  className={cn(
                    "relative h-16 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted/20 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isInCurrentGroup ? "opacity-100" : "opacity-50 hover:opacity-80",
                  )}
                  style={{ aspectRatio: "9 / 12" }}
                >
                  {isDesktop ? <GalleryImg image={image} sizes="64px" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Mobile: single-image slider */}
      {mobileImage ? (
        <div className="md:hidden">
          <div
            className="relative aspect-[9/12] w-full overflow-hidden rounded-xl bg-muted/20"
            onTouchStart={handleMobileTouchStart}
            onTouchEnd={handleMobileTouchEnd}
          >
            <button
              type="button"
              onClick={(e) => openLightbox(mobileIndex, e.currentTarget)}
              aria-label={`Открыть фото ${mobileIndex + 1} из ${total}`}
              className="absolute inset-0"
            >
              {!isDesktop ? <GalleryImg image={mobileImage} sizes="100vw" /> : null}
            </button>

            {total > 1 && mobileIndex > 0 ? (
              <button
                type="button"
                onClick={goMobilePrev}
                aria-label="Предыдущее изображение"
                className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : null}

            {total > 1 && mobileIndex < total - 1 ? (
              <button
                type="button"
                onClick={goMobileNext}
                aria-label="Следующее изображение"
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            ) : null}

            {total > 1 ? (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-2.5 py-1 text-xs text-white">
                {mobileIndex + 1} / {total}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {caption ? <p className="mt-3 px-1 text-center text-sm text-muted-foreground">{caption}</p> : null}

      {lightboxIndex !== null ? (
        <ArticleGalleryLightbox images={images} index={lightboxIndex} onIndexChange={handleLightboxIndexChange} onClose={closeLightbox} />
      ) : null}
    </div>
  );
}
