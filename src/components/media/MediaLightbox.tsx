"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaGalleryItem } from "@/lib/media/galleryTypes";
import { InstagramReelEmbed } from "./InstagramReelEmbed";

type SlideDirection = -1 | 1;

export function nextLightboxIndex(index: number, total: number, direction: SlideDirection) {
  return (index + direction + total) % total;
}

/* ─── Single item renderer ──────────────────────────────────── */
function LightboxItem({ item }: { item: MediaGalleryItem }) {
  if (item.type === "reels") {
    // Официальный embed.js-плеер: Reels воспроизводится инлайн в модалке.
    return <InstagramReelEmbed url={item.url} title={item.title} />;
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
  const [transition, setTransition] = useState<{
    from: number;
    to: number;
    direction: SlideDirection;
    moving: boolean;
  } | null>(null);
  const total = items.length;
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const didSwipeRef = useRef(false);

  const navigate = useCallback((direction: SlideDirection) => {
    if (total <= 1 || transition) return;
    const to = nextLightboxIndex(idx, total, direction);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIdx(to);
      return;
    }
    setTransition({ from: idx, to, direction, moving: false });
  }, [idx, total, transition]);
  const prev = useCallback(() => navigate(-1), [navigate]);
  const next = useCallback(() => navigate(1), [navigate]);

  useEffect(() => {
    if (!transition || transition.moving) return;
    const frame = requestAnimationFrame(() => {
      setTransition((value) => value ? { ...value, moving: true } : null);
    });
    return () => cancelAnimationFrame(frame);
  }, [transition]);

  useEffect(() => {
    if (!transition?.moving) return;
    const timer = window.setTimeout(() => {
      setIdx(transition.to);
      setTransition(null);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [transition]);

  function handleTouchStart(event: React.TouchEvent) {
    const touch = event.touches[0];
    if (!touch) return;
    didSwipeRef.current = false;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event: React.TouchEvent) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch || total <= 1) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy)) return;
    didSwipeRef.current = true;
    if (dx < 0) next();
    else prev();
  }

  function handleBackdropClick() {
    if (didSwipeRef.current) {
      didSwipeRef.current = false;
      return;
    }
    onClose();
  }

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
      onClick={handleBackdropClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
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
            "flex items-center justify-center",
          )}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Items: keep outgoing and incoming media in one fixed viewport so images and embeds do not resize the dialog. */}
      <div className="relative flex h-[88vh] w-[88vw] items-center justify-center overflow-hidden" data-lightbox-slide-viewport>
        {transition ? (
          <>
            <div
              data-lightbox-slide="outgoing"
              className="absolute inset-0 flex items-center justify-center transition-transform duration-[260ms] ease-out motion-reduce:transition-none"
              style={{ transform: transition.moving ? `translateX(${-transition.direction * 100}%)` : "translateX(0)" }}
            >
              <LightboxItem item={items[transition.from]} />
            </div>
            <div
              data-lightbox-slide="incoming"
              className="absolute inset-0 flex items-center justify-center transition-transform duration-[260ms] ease-out motion-reduce:transition-none"
              style={{ transform: transition.moving ? "translateX(0)" : `translateX(${transition.direction * 100}%)` }}
            >
              <LightboxItem item={items[transition.to]} />
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" data-lightbox-slide="current">
            <LightboxItem item={current} />
          </div>
        )}
      </div>

      {total > 1 && total <= 10 && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5" data-lightbox-dots aria-hidden="true">
          {items.map((item, index) => (
            <span key={item.id} className={cn("h-1 w-1 rounded-full", index === idx ? "bg-white" : "bg-white/45")} />
          ))}
        </div>
      )}

      {/* Next */}
      {total > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); next(); }}
          aria-label="Следующее"
          className={cn(
            "absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full p-2.5 text-white transition-colors",
            "bg-white/10 hover:bg-white/20",
            "flex items-center justify-center",
          )}
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

    </div>
  );
}
