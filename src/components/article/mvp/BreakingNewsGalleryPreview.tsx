"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({
  urls,
  startIndex,
  onClose,
}: {
  urls: string[];
  startIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);
  const total = urls.length;

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр фотографии"
    >
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрыть"
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Prev */}
      {total > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); prev(); }}
          aria-label="Предыдущее фото"
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 transition-colors"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Image */}
      <div
        className="relative max-h-[90vh] max-w-[92vw] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={idx}
          src={urls[idx]}
          alt={`Фото ${idx + 1} из ${total}`}
          className="max-h-[88vh] max-w-[88vw] rounded-xl object-contain shadow-2xl"
        />
        {total > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
            {idx + 1} / {total}
          </div>
        )}
      </div>

      {/* Next */}
      {total > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); next(); }}
          aria-label="Следующее фото"
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 transition-colors"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}

// ─── Gallery preview ──────────────────────────────────────────────────────────

const MAX_VISIBLE = 3;

export function BreakingNewsGalleryPreview({
  urls,
}: {
  /** All gallery image URLs (nulls filtered out before passing here). */
  urls: string[];
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (urls.length === 0) return null;

  const visible = urls.slice(0, MAX_VISIBLE);
  const extraCount = Math.max(0, urls.length - MAX_VISIBLE);

  return (
    <>
      {/* ── Preview strip ─────────────────────────────────────────────────── */}
      <div
        className={cn(
          // Mobile: horizontal scroll strip
          "flex gap-2 overflow-x-auto snap-x snap-mandatory pb-0.5 -mx-4 px-4 sm:mx-0 sm:px-0",
          // Desktop: grid (respect count)
          "sm:grid sm:overflow-visible sm:pb-0",
          visible.length === 1 && "sm:grid-cols-1",
          visible.length === 2 && "sm:grid-cols-2",
          visible.length >= 3 && "sm:grid-cols-3",
          "sm:gap-2 mb-8 md:mb-10",
        )}
        role="list"
        aria-label="Фотогалерея"
      >
        {visible.map((url, i) => {
          const isLast = i === MAX_VISIBLE - 1;
          const showOverlay = isLast && extraCount > 0;

          return (
            <div
              key={i}
              role="listitem"
              className={cn(
                // Mobile: fixed-width card with horizontal scroll snap
                "relative shrink-0 snap-center cursor-pointer overflow-hidden rounded-xl",
                "h-48 w-[min(72vw,260px)]",
                // Desktop: fixed height, full grid width
                "sm:h-52 sm:w-full sm:max-w-none",
                "border border-border/40 bg-muted/30",
              )}
              onClick={() => setLightboxIndex(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Фото ${i + 1}`}
                className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.03]"
                draggable={false}
              />

              {/* "+N" overlay */}
              {showOverlay && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/55">
                  <span className="text-2xl font-semibold text-white drop-shadow-md select-none">
                    +{extraCount}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Lightbox ──────────────────────────────────────────────────────── */}
      {lightboxIndex !== null && (
        <Lightbox
          urls={urls}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
