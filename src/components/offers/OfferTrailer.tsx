"use client";

import { useState } from "react";
import { Play, X } from "lucide-react";
import Image from "next/image";

interface OfferTrailerProps {
  videoUrl: string;
  thumbnail?: string | null;
  duration?: string | null;
  label?: string | null;
}

function getEmbedUrl(url: string): string {
  if (url.includes("youtube.com/watch")) {
    try {
      const id = new URL(url).searchParams.get("v");
      return `https://www.youtube.com/embed/${id}?autoplay=1`;
    } catch { return url; }
  }
  if (url.includes("youtu.be/")) {
    const id = url.split("youtu.be/")[1]?.split("?")[0];
    return `https://www.youtube.com/embed/${id}?autoplay=1`;
  }
  if (url.includes("vimeo.com/")) {
    const id = url.split("vimeo.com/")[1]?.split("?")[0];
    return `https://player.vimeo.com/video/${id}?autoplay=1`;
  }
  return url;
}

/**
 * Video Trailer — компактный блок справа от описания
 * Показывает превью с play button и подписью
 * По клику открывает модальный плеер
 */
export function OfferTrailer({ videoUrl, thumbnail, duration, label }: OfferTrailerProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="space-y-3">
        {/* Video Preview Card */}
        <button
          type="button"
          aria-label="Смотреть видео"
          onClick={() => setModalOpen(true)}
          className="group relative w-full aspect-video overflow-hidden rounded-2xl bg-neutral-100 shadow-sm hover:shadow-md transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF8759]"
        >
          {thumbnail ? (
            <Image
              src={thumbnail}
              alt="Видео превью"
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              sizes="(max-width: 1024px) 100vw, 420px"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#FFF7F3] to-[#F5F5F5]" />
          )}

          {/* Overlay */}
          <div className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/30" />

          {/* Play Button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 shadow-xl transition-transform duration-300 group-hover:scale-110">
              <Play className="h-6 w-6 fill-[#EF8759] text-[#EF8759] ml-0.5" />
            </div>
          </div>

          {/* Duration badge */}
          {duration && (
            <div className="absolute bottom-3 right-3 rounded-lg bg-black/60 px-2.5 py-1 text-[12px] font-bold text-white backdrop-blur-sm">
              {duration}
            </div>
          )}
        </button>

        {/* Caption */}
        <p className="text-[13px] text-gray-500 text-center">
          {label || "Смотрите, как проходят занятия"}
        </p>
      </div>

      {/* Video Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Видео"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
          onClick={() => setModalOpen(false)}
        >
          <button
            type="button"
            aria-label="Закрыть"
            onClick={() => setModalOpen(false)}
            className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <div
            className="relative w-full max-w-5xl aspect-video"
            onClick={(e) => e.stopPropagation()}
          >
            {videoUrl.endsWith(".mp4") || videoUrl.endsWith(".webm") ? (
              <video
                src={videoUrl}
                controls
                autoPlay
                className="h-full w-full rounded-2xl"
              />
            ) : (
              <iframe
                src={getEmbedUrl(videoUrl)}
                className="h-full w-full rounded-2xl"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
