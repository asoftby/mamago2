"use client";
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

  const isRemoteAbsolute =
    posterUrl.startsWith("http://") || posterUrl.startsWith("https://");

  return (
    <div className={cn("flex w-full flex-col gap-6", className)}>
      {/* 1) Poster — portrait anchor (narrow column); remote URLs как в MediaCover (вне next/image allowlist) */}
      <div className="w-full max-w-[280px] sm:max-w-[300px] lg:max-w-[266px]">
        <div className="w-full overflow-hidden rounded-[18px] bg-muted shadow-[var(--shadow-card)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- произвольные URL и естественная высота постера */}
          <img
            src={posterUrl}
            alt={posterAlt}
            className="block h-auto w-full object-contain"
            loading={isRemoteAbsolute ? "eager" : "lazy"}
            decoding="async"
          />
        </div>
      </div>

      {/* 2) Trailer — 16:9 */}
      {trailerYoutubeId && (
        <div className="w-full space-y-2">
          <p className="text-[12px] font-medium text-muted-foreground">
            {trailerLabel ?? "Трейлер"}
          </p>
          <div
            className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-black shadow-sm"
            style={{ aspectRatio: "16 / 9" }}
          >
            <iframe
              title={trailerLabel ?? "Трейлер"}
              src={`https://www.youtube.com/embed/${trailerYoutubeId}`}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
            />
          </div>
        </div>
      )}

      {/* 3) Reel — vertical embed, in-page */}
      {reel && (
        <div className="w-full space-y-2">
          <p className="text-center text-[12px] font-medium text-muted-foreground lg:text-left">
            {reel.label}
          </p>
          <div
            className="relative mx-auto w-full max-w-[260px] overflow-hidden rounded-xl border border-border/60 bg-black shadow-sm lg:mx-0"
            style={{ aspectRatio: "9 / 16" }}
          >
            <iframe
              title={reel.label}
              src={reel.iframeSrc}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
            />
          </div>
        </div>
      )}
    </div>
  );
}
