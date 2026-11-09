"use client";

import { useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { MediaLightbox } from "@/components/media/MediaLightbox";
import type { MediaGalleryItem } from "@/lib/media/galleryTypes";

/** Compact article gallery: photographs first, supported social/video items last. */
export function CollectionEventMediaGallery({ items, title, slideClassName = "aspect-[3/4]" }: { items: MediaGalleryItem[]; title: string; slideClassName?: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const select = (index: number) => {
    const next = Math.max(0, Math.min(items.length - 1, index));
    setActive(next);
    viewport.current?.scrollTo({ left: next * viewport.current.clientWidth, behavior: "smooth" });
  };
  return (
    <>
      <div className="group relative overflow-hidden rounded-2xl bg-[#EFE7DD]" aria-label={`Галерея: ${title}`}>
        {items.length === 0 ? (
          <div className="flex aspect-[3/4] items-center justify-center text-[#B4ABA0]">
            <Calendar className="size-9" aria-hidden="true" />
          </div>
        ) : (
          <div ref={viewport} onScroll={(event) => {
            const width = event.currentTarget.clientWidth;
            if (width > 0) setActive(Math.max(0, Math.min(items.length - 1, Math.round(event.currentTarget.scrollLeft / width))));
          }} className="flex w-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map((item, index) => {
              const video = item.type !== "image";
              const poster = item.type === "image" ? item.src : item.posterSrc;
              const label = item.type === "youtube" ? "Видео" : item.type === "instagram" && /instagram\.com\/p\//i.test(item.url) ? "Пост" : "Reels";
              return (
                <button key={item.id} type="button" onClick={() => setLightbox(index)}
                  aria-label={video ? `Открыть ${label}` : `Открыть фото ${index + 1}`}
                  className={`relative flex ${slideClassName} w-full shrink-0 snap-start items-center justify-center overflow-hidden bg-[#EFE7DD] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#E86A3A]`}>
                  {poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={poster} alt={item.type === "image" ? (item.alt || title) : ""} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-contain" />
                  ) : video ? <span className="font-medium text-[#6B6259]">{label}</span> : null}
                  {video ? <span className="absolute inset-0 flex items-center justify-center"><span className="flex size-12 items-center justify-center rounded-full bg-black/55 text-white"><Play className="size-6 fill-current" aria-hidden="true" /></span></span> : null}
                </button>
              );
            })}
          </div>
        )}
        {items.length > 1 ? (
          <>
            <button type="button" onClick={() => select(active - 1)} disabled={active === 0} aria-label="Предыдущее медиа" className="absolute left-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#141210] shadow-sm disabled:opacity-35"><ChevronLeft className="size-5" /></button>
            <button type="button" onClick={() => select(active + 1)} disabled={active === items.length - 1} aria-label="Следующее медиа" className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#141210] shadow-sm disabled:opacity-35"><ChevronRight className="size-5" /></button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-2" role="group" aria-label="Слайды галереи">
              {items.map((item, index) => <button key={item.id} type="button" aria-label={`Слайд ${index + 1} из ${items.length}`} aria-current={active === index ? "true" : undefined} onClick={() => select(index)} className={`h-1.5 rounded-full bg-white transition-all ${active === index ? "w-4" : "w-1.5 opacity-55"}`} />)}
            </div>
          </>
        ) : null}
      </div>
      {lightbox !== null ? <MediaLightbox items={items} startIndex={lightbox} onClose={() => setLightbox(null)} /> : null}
    </>
  );
}
