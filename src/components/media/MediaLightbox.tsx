"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaGalleryItem } from "@/lib/media/galleryTypes";

/* ─── Instagram embed URL helper ────────────────────────────── */
function toInstagramEmbedUrl(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:reel|p)\/([\w-]+)/i);
  if (!match) return null;
  return `https://www.instagram.com/p/${match[1]}/embed/`;
}

/* ─── Single item renderer ──────────────────────────────────── */
function LightboxItem({ item }: { item: MediaGalleryItem }) {
  if (item.type === "reels") {
    const embedSrc = toInstagramEmbedUrl(item.url);
    return (
      <div
        className="mx-auto"
        style={{ width: "min(90vw, calc(88svh * 9 / 16))" }}
        onClick={(e) => e.stopPropagation()}
      >
        {embedSrc && (
          /*
           * Crop Instagram's own header (~60 px) and footer (~56 px).
           * The iframe is made taller than the container and shifted up so
           * only the video area is visible through overflow:hidden.
           */
          <div
            className="relative w-full overflow-hidden rounded-[18px] bg-black"
            style={{ aspectRatio: "9 / 14", maxHeight: "88svh" }}
          >
            <iframe
              title={item.title ?? "Instagram Reels"}
              src={embedSrc}
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
              scrolling="no"
              style={{
                position: "absolute",
                top: "-60px",
                left: 0,
                width: "100%",
                height: "calc(100% + 116px)",
                border: "none",
              }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <img
      key={item.id}
      src={item.src}
      alt={item.alt ?? "Фото"}
      className="max-h-[88vh] max-w-[88vw] rounded-xl object-contain shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    />
  );
}

/* ─── Lightbox ──────────────────────────────────────────────── */
interface MediaLightboxProps {
  items: MediaGalleryItem[];
  startIndex: number;
  onClose: () => void;
}

export function MediaLightbox({ items, startIndex, onClose }: MediaLightboxProps) {
  const [idx, setIdx] = useState(startIndex);
  const total = items.length;

  const prev = useCallback(() => setIdx((i) => (i - 1 + total) % total), [total]);
  const next = useCallback(() => setIdx((i) => (i + 1) % total), [total]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, prev, next]);

  const current = items[idx];
  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/92 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр медиа"
    >
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрыть"
        className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <X className="h-4.5 w-4.5" />
      </button>

      {/* Counter */}
      {total > 1 && (
        <div className="absolute left-4 top-4 z-10 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
          {idx + 1} / {total}
        </div>
      )}

      {/* Prev */}
      {total > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); prev(); }}
          aria-label="Предыдущее"
          className={cn(
            "absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full p-2.5 text-white transition-colors",
            "bg-white/10 hover:bg-white/20",
            "hidden md:flex items-center justify-center",
          )}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Item */}
      <div className="flex items-center justify-center">
        <LightboxItem item={current} />
      </div>

      {/* Next */}
      {total > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); next(); }}
          aria-label="Следующее"
          className={cn(
            "absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full p-2.5 text-white transition-colors",
            "bg-white/10 hover:bg-white/20",
            "hidden md:flex items-center justify-center",
          )}
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Mobile tap zones */}
      {total > 1 && (
        <>
          <div
            className="absolute left-0 top-0 bottom-0 w-1/3 md:hidden"
            onClick={(e) => { e.stopPropagation(); prev(); }}
          />
          <div
            className="absolute right-0 top-0 bottom-0 w-1/3 md:hidden"
            onClick={(e) => { e.stopPropagation(); next(); }}
          />
        </>
      )}
    </div>
  );
}
