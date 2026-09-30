"use client";

import Image from "next/image";
import { Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MediaLightbox } from "@/components/media/MediaLightbox";
import type { EventPageMedia } from "@/lib/event/eventPageTypes";
import type { MediaGalleryItem } from "@/lib/media/galleryTypes";
import { canOptimizeWithNextImage } from "@/lib/media/nextImagePolicy";
import { cn } from "@/lib/utils";

export type PublicationMediaColumnProps = {
  media: EventPageMedia;
  galleryItems?: MediaGalleryItem[];
  galleryMaxVisible?: number;
  className?: string;
};

function itemPoster(item: MediaGalleryItem): string | null {
  return item.type === "image" ? item.src : item.posterSrc;
}

function GalleryImage({ item, priority, thumbnail = false }: { item: MediaGalleryItem; priority: boolean; thumbnail?: boolean }) {
  const [src, setSrc] = useState(itemPoster(item) || "/og-default.jpg");
  const alt = item.type === "image" ? (item.alt ?? "Фото") : "";
  const className = "absolute inset-0 h-full w-full object-cover";
  const onError = () => setSrc((current) => current === "/og-default.jpg" ? current : "/og-default.jpg");

  if (item.type === "image" && canOptimizeWithNextImage(src)) {
    return <Image src={src} alt={alt} fill className={className} sizes={thumbnail ? "64px" : "(min-width: 1024px) 440px, 100vw"} priority={priority} onError={onError} />;
  }
  // External legacy images and provider posters stay usable without widening remotePatterns.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} loading={priority ? "eager" : "lazy"} onError={onError} />;
}

/** One responsive hero DOM shared by Event and Offer publication pages. */
export function PublicationMediaColumn({ media, galleryItems, className }: PublicationMediaColumnProps) {
  const items = useMemo<MediaGalleryItem[]>(() => {
    const poster = media.posterUrl?.trim();
    const rest = (galleryItems ?? []).filter((item) => item.type !== "image" || item.src.trim() !== poster);
    if (media.trailerYoutubeId && !rest.some((item) => item.type === "youtube" && item.embedId === media.trailerYoutubeId)) {
      rest.push({
        type: "youtube",
        id: "publication-youtube-video",
        url: `https://www.youtube.com/watch?v=${media.trailerYoutubeId}`,
        embedId: media.trailerYoutubeId,
        posterSrc: `https://img.youtube.com/vi/${media.trailerYoutubeId}/hqdefault.jpg`,
        title: media.trailerLabel ?? "Трейлер",
      });
    }
    return poster ? [{ type: "image", id: "publication-poster", src: poster, alt: media.posterAlt }, ...rest] : rest;
  }, [galleryItems, media.posterAlt, media.posterUrl, media.trailerLabel, media.trailerYoutubeId]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const announceTimer = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [announcedIndex, setAnnouncedIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const select = useCallback((index: number) => {
    const bounded = Math.max(0, Math.min(index, items.length - 1));
    setActiveIndex(bounded);
    const viewport = viewportRef.current;
    viewport?.scrollTo({ left: bounded * (viewport.clientWidth || 0), behavior: "smooth" });
    thumbRefs.current[bounded]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [items.length]);

  useEffect(() => {
    if (announceTimer.current) window.clearTimeout(announceTimer.current);
    announceTimer.current = window.setTimeout(() => setAnnouncedIndex(activeIndex), 180);
    return () => { if (announceTimer.current) window.clearTimeout(announceTimer.current); };
  }, [activeIndex]);

  if (items.length === 0) return null;

  return (
    <div className={cn("min-w-0 space-y-2.5", className)} tabIndex={0} onKeyDown={(event) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        select(activeIndex + (event.key === "ArrowRight" ? 1 : -1));
      }
    }} aria-label="Галерея публикации">
      <div className="relative overflow-hidden rounded-[18px] bg-[#E8E0D4]">
        <div ref={viewportRef} className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" onScroll={(event) => {
          const node = event.currentTarget;
          if (node.clientWidth) setActiveIndex(Math.max(0, Math.min(Math.round(node.scrollLeft / node.clientWidth), items.length - 1)));
        }}>
          {items.map((item, index) => {
            const isVideo = item.type !== "image";
            return <button key={item.id} type="button" className="group relative aspect-[4/5] w-full shrink-0 snap-start overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#EF8759]" onClick={() => setLightboxIndex(index)} aria-label={isVideo ? `Смотреть ${item.title ?? "видео"}` : `Открыть фото ${index + 1}`}>
              <GalleryImage item={item} priority={index === 0} />
              {isVideo ? <span className="absolute inset-0 flex items-center justify-center bg-black/25"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm transition-transform group-hover:scale-105"><Play className="h-6 w-6 translate-x-px fill-white text-white" aria-hidden /></span></span> : null}
            </button>;
          })}
        </div>
        {items.length > 1 ? <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-2.5 py-1 text-xs text-white backdrop-blur-sm" role="status" aria-live="polite">{announcedIndex + 1} / {items.length}</div> : null}
      </div>

      {items.length > 2 ? <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="list" aria-label="Миниатюры галереи">
        {items.map((item, index) => <button key={item.id} ref={(node) => { thumbRefs.current[index] = node; }} type="button" role="listitem" aria-label={`Показать ${item.type === "image" ? `фото ${index + 1}` : item.title ?? "видео"}`} aria-current={activeIndex === index ? "true" : undefined} onClick={() => select(index)} className={cn("relative h-16 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-[#E8E0D4]", activeIndex === index ? "border-[#E86A3A]" : "border-transparent")}>
          <GalleryImage item={item} priority={false} thumbnail />
          {item.type !== "image" ? <span className="absolute inset-0 flex items-center justify-center bg-black/25"><Play className="h-4 w-4 fill-white text-white" aria-hidden /></span> : null}
        </button>)}
      </div> : null}

      {lightboxIndex !== null ? <MediaLightbox items={items} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} /> : null}
    </div>
  );
}
