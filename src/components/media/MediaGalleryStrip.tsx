"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaGalleryItem } from "@/lib/media/galleryTypes";
import { MediaLightbox } from "./MediaLightbox";

/* ─── Tile ──────────────────────────────────────────────────── */
function Tile({
  item,
  overflowCount,
  onClick,
}: {
  item: MediaGalleryItem;
  /** If > 0, this tile shows "+N" overlay instead of content. */
  overflowCount?: number;
  onClick: () => void;
}) {
  const isReels = item.type === "reels";
  const bgSrc = isReels
    ? (item as Extract<MediaGalleryItem, { type: "reels" }>).thumbnailSrc
    : (item as Extract<MediaGalleryItem, { type: "image" }>).src;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isReels ? "Смотреть Reels" : "Открыть фото"}
      className={cn(
        "group relative overflow-hidden rounded-[16px] bg-[#E8E0D4]",
        "aspect-square w-full shrink-0",
        "transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF8759]",
      )}
    >
      {/* Background image */}
      {bgSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bgSrc}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      )}

      {/* Dark scrim */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity",
          overflowCount
            ? "bg-black/35"
            : isReels
              ? "bg-black/30 group-hover:bg-black/40"
              : "bg-black/0 group-hover:bg-black/15",
        )}
      />

      {/* Overflow "+N" */}
      {overflowCount ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="select-none text-2xl font-semibold text-white drop-shadow">
            +{overflowCount}
          </span>
        </div>
      ) : isReels ? (
        /* Reels: play icon + label */
        <>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-transform group-hover:scale-110">
              <Play className="h-4 w-4 fill-white text-white translate-x-[1px]" aria-hidden />
            </span>
          </div>
          <span className="absolute bottom-2 left-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-white/80 select-none">
            Reels
          </span>
        </>
      ) : null}
    </button>
  );
}

/* ─── MediaGalleryStrip ─────────────────────────────────────── */
interface MediaGalleryStripProps {
  items: MediaGalleryItem[];
  /** Max tiles shown before "+N". Default: 4. */
  maxVisible?: number;
  className?: string;
}

export function MediaGalleryStrip({
  items,
  maxVisible = 4,
  className,
}: MediaGalleryStripProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  const visibleItems = items.slice(0, maxVisible);
  const overflowCount = Math.max(0, items.length - maxVisible);
  // The last visible tile shows "+N" when there's overflow
  const lastIdx = visibleItems.length - 1;

  // Map maxVisible → Tailwind grid-cols class (always fixed, regardless of item count)
  const gridColsClass =
    maxVisible <= 2
      ? "sm:grid-cols-2"
      : maxVisible === 3
        ? "sm:grid-cols-3"
        : "sm:grid-cols-4";

  return (
    <>
      {/* ── Strip ─────────────────────────────────────────────── */}
      <div
        className={cn(
          // Mobile: horizontal snap scroll
          "flex gap-2 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0",
          // Desktop: CSS grid, fixed columns — always maxVisible cols even for 1 item
          "sm:grid sm:overflow-visible",
          gridColsClass,
          "sm:gap-2",
          className,
        )}
        role="list"
        aria-label="Медиа события"
      >
        {visibleItems.map((item, i) => {
          const isLast = i === lastIdx;
          return (
            <div
              key={item.id}
              role="listitem"
              className={cn(
                // Mobile: fixed-width tiles that scroll
                "shrink-0 snap-center",
                "w-[min(32vw,148px)] sm:w-full sm:max-w-none",
              )}
            >
              <Tile
                item={item}
                overflowCount={isLast && overflowCount > 0 ? overflowCount : undefined}
                onClick={() => setLightboxIndex(isLast && overflowCount > 0 ? maxVisible - 1 : i)}
              />
            </div>
          );
        })}
      </div>

      {/* ── Lightbox ──────────────────────────────────────────── */}
      {lightboxIndex !== null && (
        <MediaLightbox
          items={items}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
