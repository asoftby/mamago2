"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { EventPageMedia } from "@/lib/event/eventPageTypes";

export function EventMediaStack({
  media,
  className,
}: {
  media: EventPageMedia;
  className?: string;
}) {
  const { posterUrl, posterAlt, reel, trailerYoutubeId, trailerLabel } = media;
  const trailerRef = useRef<HTMLDivElement>(null);
  const reelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const targets = [trailerRef.current, reelRef.current].filter(Boolean) as Element[];
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).style.opacity = "1";
            (e.target as HTMLElement).style.transform = "none";
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.1 },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  const revealStyle: React.CSSProperties = {
    opacity: 0,
    transform: "translateY(14px)",
    transition: "opacity 0.9s cubic-bezier(0.2,0.7,0.2,1), transform 0.9s cubic-bezier(0.2,0.7,0.2,1)",
  };

  return (
    <aside className={cn("flex flex-col gap-3.5", className)}>
      {/* Poster — 4:5 portrait */}
      <div
        className="relative overflow-hidden rounded-[18px] bg-[#E8E0D4]"
        style={{ aspectRatio: "4/5" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={posterUrl}
          alt={posterAlt}
          className="h-full w-full object-cover"
          loading="eager"
          decoding="async"
        />
      </div>

      {/* Trailer — 16:9 */}
      {trailerYoutubeId && (
        <div
          ref={trailerRef}
          className="group relative cursor-pointer overflow-hidden rounded-[14px] bg-black"
          style={{ ...revealStyle, aspectRatio: "16/9" }}
        >
          <img
            src={posterUrl}
            alt={trailerLabel ?? "Трейлер"}
            className="h-full w-full object-cover opacity-50 transition-opacity group-hover:opacity-70"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-[rgba(20,18,16,0.18)]">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FAF7F1] pl-1 text-[18px] text-[#C24E22] shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition-transform group-hover:scale-110">
              ▶
            </div>
          </div>
          <span className="absolute bottom-2.5 left-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[rgba(250,247,241,0.85)]">
            {trailerLabel ?? "трейлер"} · 0:42
          </span>
        </div>
      )}

      {/* Reel — 9:16 vertical */}
      {reel && (
        <div
          ref={reelRef}
          className="relative overflow-hidden rounded-[14px] bg-[#E8E0D4]"
          style={{ ...revealStyle, aspectRatio: "9/16" }}
        >
          <iframe
            title={reel.label}
            src={reel.iframeSrc}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
          />
          <span className="absolute left-3 top-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[rgba(250,247,241,0.85)]">
            ↗ reels
          </span>
        </div>
      )}
    </aside>
  );
}
