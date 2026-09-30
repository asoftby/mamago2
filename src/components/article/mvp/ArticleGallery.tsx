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

const lightboxImageReadyCache = new Map<string, Promise<void>>();

function ensureLightboxImageReady(url: string): Promise<void> {
  const cached = lightboxImageReadyCache.get(url);
  if (cached) return cached;

  const promise = new Promise<void>((resolve) => {
    const image = new window.Image();
    image.decoding = "async";
    let finished = false;

    const finish = async () => {
      if (finished) return;
      finished = true;
      try {
        if (typeof image.decode === "function") {
          await image.decode();
        }
      } catch {
        // A decoded frame is an optimization only; onload is still enough to render.
      }
      resolve();
    };

    image.onload = () => {
      void finish();
    };
    image.onerror = () => {
      if (!finished) {
        finished = true;
        resolve();
      }
    };
    image.src = url;

    if (image.complete) {
      void finish();
    }
  });

  lightboxImageReadyCache.set(url, promise);
  return promise;
}

async function waitForLightboxImageReady(
  url: string,
  timeoutMs = 1500,
): Promise<boolean> {
  let timeoutId = 0;
  const ready = await Promise.race([
    ensureLightboxImageReady(url).then(() => true),
    new Promise<boolean>((resolve) => {
      timeoutId = window.setTimeout(() => resolve(false), timeoutMs);
    }),
  ]);

  if (timeoutId) window.clearTimeout(timeoutId);
  if (!ready) {
    // A stalled request must not poison the cache or lock all navigation.
    lightboxImageReadyCache.delete(url);
  }
  return ready;
}

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
  type SlideDirection = -1 | 1;

  const total = images.length;
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const navigationTokenRef = useRef(0);
  const preparingNavigationRef = useRef(false);
  const [transition, setTransition] = useState<{
    from: number;
    to: number;
    direction: SlideDirection;
    moving: boolean;
    settling: boolean;
  } | null>(null);

  const navigate = useCallback(
    (direction: SlideDirection) => {
      if (transition || preparingNavigationRef.current) return;
      const to = Math.max(0, Math.min(index + direction, total - 1));
      if (to === index) return;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        onIndexChange(to);
        return;
      }

      const token = ++navigationTokenRef.current;
      const targetUrl = images[to]?.url;
      preparingNavigationRef.current = true;

      void (targetUrl ? waitForLightboxImageReady(targetUrl) : Promise.resolve(true)).then(
        (ready) => {
          if (navigationTokenRef.current !== token) return;
          preparingNavigationRef.current = false;
          if (!ready) return;
          setTransition({ from: index, to, direction, moving: false, settling: false });
        },
      );
    },
    [images, index, onIndexChange, total, transition],
  );

  const goPrev = useCallback(() => navigate(-1), [navigate]);
  const goNext = useCallback(() => navigate(1), [navigate]);

  useEffect(() => {
    if (!transition || transition.moving) return;
    const frame = requestAnimationFrame(() => {
      setTransition((value) => (value ? { ...value, moving: true } : null));
    });
    return () => cancelAnimationFrame(frame);
  }, [transition]);

  useEffect(() => {
    if (!transition?.moving || transition.settling) return;
    const timer = window.setTimeout(() => {
      onIndexChange(transition.to);
      setTransition((value) => (value ? { ...value, settling: true } : null));
    }, 260);
    return () => window.clearTimeout(timer);
  }, [onIndexChange, transition]);

  useEffect(() => {
    if (!transition?.settling) return;
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        setTransition(null);
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, [transition?.settling]);

  useEffect(
    () => () => {
      navigationTokenRef.current += 1;
      preparingNavigationRef.current = false;
    },
    [],
  );

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

  // Decode only the current + immediate neighbours. Navigation also waits for
  // the target decode, so the first swipe never animates into an empty frame.
  useEffect(() => {
    for (const neighbourIndex of [index - 1, index, index + 1]) {
      const url = images[neighbourIndex]?.url;
      if (!url) continue;
      void ensureLightboxImageReady(url);
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

  function renderSlide(image: ArticleGalleryImage) {
    return (
      <div className="flex max-h-[90dvh] max-w-[94vw] flex-col items-center justify-center gap-2 sm:max-w-[92vw]" onClick={(e) => e.stopPropagation()}>
        {image.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.url}
            alt={image.alt ?? ""}
            aria-describedby={image.caption ? "article-gallery-lightbox-caption" : undefined}
            className="max-h-[80dvh] w-auto max-w-[94vw] object-contain sm:max-w-[92vw]"
            style={{ ...RESET_ARTICLE_BODY_IMG_STYLE, width: "auto" }}
          />
        ) : (
          <div className="flex h-64 w-64 items-center justify-center rounded-xl bg-white/10 text-sm text-white/70">
            Изображение недоступно
          </div>
        )}
        {image.caption ? (
          <p id="article-gallery-lightbox-caption" className="max-w-[92vw] px-2 text-center text-sm text-white/80">
            {image.caption}
          </p>
        ) : null}
      </div>
    );
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
          className="absolute left-2 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-3 sm:h-10 sm:w-10"
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
          className="absolute right-2 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-3 sm:h-10 sm:w-10"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      ) : null}

      <div
        className="relative flex h-[90dvh] w-[94vw] items-center justify-center overflow-hidden sm:w-[92vw]"
        data-article-lightbox-slide-viewport
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          data-article-lightbox-slide="current"
        >
          {renderSlide(current)}
        </div>

        {transition ? (
          <>
            <div
              data-article-lightbox-slide="outgoing"
              className="absolute inset-0 z-10 flex items-center justify-center transition-transform duration-[260ms] ease-out motion-reduce:transition-none"
              style={{
                transform: transition.moving
                  ? `translateX(${-transition.direction * 100}%)`
                  : "translateX(0)",
              }}
            >
              {renderSlide(images[transition.from])}
            </div>
            <div
              data-article-lightbox-slide="incoming"
              className="absolute inset-0 z-10 flex items-center justify-center transition-transform duration-[260ms] ease-out motion-reduce:transition-none"
              style={{
                transform: transition.moving
                  ? "translateX(0)"
                  : `translateX(${transition.direction * 100}%)`,
              }}
            >
              {renderSlide(images[transition.to])}
            </div>
          </>
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
  const [mobileTransition, setMobileTransition] = useState<{
    from: number;
    to: number;
    direction: -1 | 1;
    moving: boolean;
  } | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const didMobileSwipeRef = useRef(false);

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
    setMobileTransition(null);
    setMobileIndex(index);
  };

  const navigateMobile = useCallback(
    (direction: -1 | 1) => {
      if (mobileTransition) return;
      const to = Math.max(0, Math.min(mobileIndex + direction, total - 1));
      if (to === mobileIndex) return;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setMobileIndex(to);
        return;
      }

      setMobileTransition({ from: mobileIndex, to, direction, moving: false });
    },
    [mobileIndex, mobileTransition, total],
  );
  const goMobilePrev = useCallback(() => navigateMobile(-1), [navigateMobile]);
  const goMobileNext = useCallback(() => navigateMobile(1), [navigateMobile]);

  useEffect(() => {
    if (!mobileTransition || mobileTransition.moving) return;
    const frame = requestAnimationFrame(() => {
      setMobileTransition((value) => (value ? { ...value, moving: true } : null));
    });
    return () => cancelAnimationFrame(frame);
  }, [mobileTransition]);

  useEffect(() => {
    if (!mobileTransition?.moving) return;
    const timer = window.setTimeout(() => {
      setMobileIndex(mobileTransition.to);
      setMobileTransition(null);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [mobileTransition]);

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
    const direction: -1 | 1 = dx < 0 ? 1 : -1;
    const to = Math.max(0, Math.min(mobileIndex + direction, total - 1));
    if (to === mobileIndex) return;
    didMobileSwipeRef.current = true;
    navigateMobile(direction);
  }

  if (total === 0) return null;

  const groupImages = images.slice(desktopGroupStart, desktopGroupStart + DESKTOP_GROUP_SIZE);
  const groupSize = groupImages.length;
  const desktopImageWidthPx = Math.floor(ARTICLE_WIDTH_PX / groupSize);
  const mobileImage = images[mobileIndex];

  const renderMobileSlide = (image: ArticleGalleryImage, index: number) => (
    <button
      type="button"
      onClick={(e) => {
        if (didMobileSwipeRef.current) {
          didMobileSwipeRef.current = false;
          return;
        }
        openLightbox(index, e.currentTarget);
      }}
      aria-label={`Открыть фото ${index + 1} из ${total}`}
      className="absolute inset-0"
    >
      {!isDesktop ? <GalleryImg image={image} sizes="100vw" /> : null}
    </button>
  );

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
            data-article-mobile-gallery-slide-viewport
            onTouchStart={handleMobileTouchStart}
            onTouchEnd={handleMobileTouchEnd}
          >
            {mobileTransition ? (
              <>
                <div
                  data-article-mobile-gallery-slide="outgoing"
                  className="absolute inset-0 transition-transform duration-[260ms] ease-out motion-reduce:transition-none"
                  style={{
                    transform: mobileTransition.moving
                      ? `translateX(${-mobileTransition.direction * 100}%)`
                      : "translateX(0)",
                  }}
                >
                  {renderMobileSlide(images[mobileTransition.from], mobileTransition.from)}
                </div>
                <div
                  data-article-mobile-gallery-slide="incoming"
                  className="absolute inset-0 transition-transform duration-[260ms] ease-out motion-reduce:transition-none"
                  style={{
                    transform: mobileTransition.moving
                      ? "translateX(0)"
                      : `translateX(${mobileTransition.direction * 100}%)`,
                  }}
                >
                  {renderMobileSlide(images[mobileTransition.to], mobileTransition.to)}
                </div>
              </>
            ) : (
              <div className="absolute inset-0" data-article-mobile-gallery-slide="current">
                {renderMobileSlide(mobileImage, mobileIndex)}
              </div>
            )}

            {total > 1 && mobileIndex > 0 ? (
              <button
                type="button"
                onClick={goMobilePrev}
                aria-label="Предыдущее изображение"
                className="absolute left-2 top-1/2 flex h-11 w-11 z-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : null}

            {total > 1 && mobileIndex < total - 1 ? (
              <button
                type="button"
                onClick={goMobileNext}
                aria-label="Следующее изображение"
                className="absolute right-2 top-1/2 flex h-11 w-11 z-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            ) : null}

            {total > 1 ? (
              <div className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/45 px-2.5 py-1 text-xs text-white">
                {(mobileTransition?.to ?? mobileIndex) + 1} / {total}
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
